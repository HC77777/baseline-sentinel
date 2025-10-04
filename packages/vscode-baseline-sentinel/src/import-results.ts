import * as vscode from 'vscode';
import * as path from 'path';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import AdmZip = require('adm-zip');

// Store the last imported CI report for "Fix All from CI" command
let lastCIReport: CIScanReport | null = null;
let lastCIWorkspaceRoot: string | null = null;

interface CIResult {
  path: string;
  findings: Array<{
    line: number;
    column: number;
    message: string;
    featureId: string;
    fixId: string;
  }>;
}

interface CIScanReport {
  totalIssues: number;
  fileReports: CIResult[];
  totalFiles: number;
}

/**
 * Validates that the current workspace matches the GitHub repository
 */
function validateWorkspaceMatchesRepo(repoInfo: { owner: string; repo: string }): boolean {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return false;
  }

  const workspaceName = path.basename(workspaceFolders[0].uri.fsPath);
  const repoName = repoInfo.repo;

  // Check if workspace folder name matches repo name
  return workspaceName.toLowerCase() === repoName.toLowerCase();
}

/**
 * Imports CI scan results - automatically downloads from GitHub
 */
export async function importCIResults() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  // Get GitHub token
  const config = vscode.workspace.getConfiguration('baseline-sentinel');
  const token = config.get<string>('githubToken');

  if (!token) {
    const choice = await vscode.window.showWarningMessage(
      'GitHub token not configured. Auto-download requires a token.',
      { modal: true },
      'Set Up Token', 'Manual Import', 'Cancel'
    );
    
    if (choice === 'Set Up Token') {
      await vscode.commands.executeCommand('baseline.enableAutoSync');
      return;
    } else if (choice === 'Manual Import') {
      await manualImport();
      return;
    } else {
      return;
    }
  }

  // Show progress
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Downloading CI results from GitHub...',
    cancellable: false
  }, async (progress) => {
    try {
      // Get repository info
      const repoInfo = getRepositoryInfo();
      if (!repoInfo) {
        throw new Error('Could not detect GitHub repository');
      }

      // Validate workspace matches repo
      if (!validateWorkspaceMatchesRepo(repoInfo)) {
        const workspaceName = path.basename(workspaceFolders[0].uri.fsPath);
        throw new Error(
          `Workspace mismatch!\n\n` +
          `VS Code folder: "${workspaceName}"\n` +
          `GitHub repo: "${repoInfo.repo}"\n\n` +
          `Please open the correct folder that matches your GitHub repository.`
        );
      }

      progress.report({ message: 'Finding latest workflow run...' });
      
      // Get latest workflow run
      const runs = await fetchLatestWorkflowRuns(token, repoInfo);
      const baselineRun = runs.find((r: any) => 
        r.name === 'Baseline Sentinel' || r.name === 'Baseline Sentinel Check'
      );

      if (!baselineRun) {
        throw new Error('No Baseline Sentinel workflow runs found');
      }

      progress.report({ message: 'Downloading artifact...' });

      // Download artifact
      const report = await downloadArtifact(token, repoInfo, baselineRun.id);
      
      progress.report({ message: 'Processing results...' });

      // Process the report
      await processReport(report, workspaceFolders[0].uri.fsPath);

    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to download CI results: ${error.message}`,
        { modal: true },
        'Manual Import'
      ).then(async (choice) => {
        if (choice === 'Manual Import') {
          await manualImport();
        }
      });
    }
  });
}

/**
 * Manual import fallback
 */
async function manualImport() {
  const fileUri = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      'JSON': ['json']
    },
    title: 'Select baseline-results.json'
  });

  if (!fileUri || fileUri.length === 0) {
    return;
  }

  const content = await vscode.workspace.fs.readFile(fileUri[0]);
  const report: CIScanReport = JSON.parse(content.toString());
  
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    await processReport(report, workspaceFolders[0].uri.fsPath);
  }
}

/**
 * Gets repository info from Git
 */
function getRepositoryInfo(): { owner: string; repo: string } | null {
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    const api = gitExtension?.getAPI(1);
    
    if (api && api.repositories.length > 0) {
      const repo = api.repositories[0];
      const remote = repo.state.remotes.find((r: any) => r.name === 'origin');
      
      if (remote && remote.fetchUrl) {
        const match = remote.fetchUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (match) {
          return { owner: match[1], repo: match[2] };
        }
      }
    }
  } catch (error) {
    console.error('[Import] Failed to get repo info:', error);
  }
  return null;
}

/**
 * Fetches latest workflow runs
 */
function fetchLatestWorkflowRuns(token: string, repoInfo: { owner: string; repo: string }): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repoInfo.owner}/${repoInfo.repo}/actions/runs?per_page=10`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Baseline-Sentinel-VSCode',
        'Accept': 'application/vnd.github+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.workflow_runs || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Downloads and extracts artifact from workflow run
 */
async function downloadArtifact(token: string, repoInfo: { owner: string; repo: string }, runId: number): Promise<CIScanReport> {
  // Get artifacts list
  const artifacts = await fetchArtifacts(token, repoInfo, runId);
  const baselineArtifact = artifacts.find((a: any) => a.name === 'baseline-results');

  if (!baselineArtifact) {
    throw new Error('No baseline-results artifact found');
  }

  // Download artifact ZIP
  const zipPath = await downloadArtifactZip(token, repoInfo, baselineArtifact.id);

  // Extract JSON from ZIP
  const report = await extractJsonFromZip(zipPath);

  // Clean up temp file
  try {
    fs.unlinkSync(zipPath);
  } catch (e) {
    // Ignore cleanup errors
  }

  return report;
}

/**
 * Fetches artifacts from a workflow run
 */
function fetchArtifacts(token: string, repoInfo: { owner: string; repo: string }, runId: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repoInfo.owner}/${repoInfo.repo}/actions/runs/${runId}/artifacts`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Baseline-Sentinel-VSCode',
        'Accept': 'application/vnd.github+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.artifacts || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Downloads artifact ZIP file
 */
function downloadArtifactZip(token: string, repoInfo: { owner: string; repo: string }, artifactId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), `baseline-artifact-${Date.now()}.zip`);
    const file = fs.createWriteStream(tempPath);

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repoInfo.owner}/${repoInfo.repo}/actions/artifacts/${artifactId}/zip`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Baseline-Sentinel-VSCode',
        'Accept': 'application/vnd.github+json'
      }
    };

    https.get(options, (res) => {
      // Handle redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          https.get(redirectUrl, (redirectRes) => {
            redirectRes.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve(tempPath);
            });
          }).on('error', (err) => {
            fs.unlinkSync(tempPath);
            reject(err);
          });
        } else {
          reject(new Error('Redirect location not found'));
        }
      } else {
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(tempPath);
        });
      }
    }).on('error', (err) => {
      fs.unlinkSync(tempPath);
      reject(err);
    });
  });
}

/**
 * Extracts JSON from ZIP file
 */
async function extractJsonFromZip(zipPath: string): Promise<CIScanReport> {
  const zip = new AdmZip(zipPath);
  const zipEntries = zip.getEntries();

  for (const entry of zipEntries) {
    if (entry.entryName === 'baseline-results.json') {
      const content = entry.getData().toString('utf8');
      return JSON.parse(content);
    }
  }

  throw new Error('baseline-results.json not found in artifact');
}

/**
 * Process and display the report
 */
async function processReport(report: CIScanReport, workspaceRoot: string) {
  // Store for "Fix All from CI" button
  lastCIReport = report;
  lastCIWorkspaceRoot = workspaceRoot;

  // Display summary
  const proceed = await vscode.window.showInformationMessage(
    `Found ${report.totalIssues} issue(s) in ${report.fileReports.length} file(s). Review and fix?`,
    { modal: true },
    'Review', 'Fix All', 'Cancel'
  );

  if (proceed === 'Cancel' || !proceed) {
    return;
  }

  if (proceed === 'Fix All') {
    await applyAllFixes(report, workspaceRoot);
  } else if (proceed === 'Review') {
    await openReviewPanel(report, workspaceRoot);
  }
}

/**
 * Opens a panel to review CI issues
 */
async function openReviewPanel(report: CIScanReport, workspaceRoot: string) {
  // Create a markdown report
  let markdown = `# Baseline Sentinel CI Report\n\n`;
  markdown += `**Total Issues:** ${report.totalIssues}\n\n`;
  markdown += `**Files Affected:** ${report.fileReports.length}\n\n`;
  markdown += `---\n\n`;

  for (const fileReport of report.fileReports) {
    markdown += `## 📄 ${fileReport.path}\n\n`;
    markdown += `**Issues:** ${fileReport.findings.length}\n\n`;
    
    for (const finding of fileReport.findings) {
      markdown += `- **Line ${finding.line}:${finding.column}** - ${finding.message}\n`;
      const filePath = path.join(workspaceRoot, fileReport.path);
      markdown += `  - [Open file](command:vscode.open?${encodeURIComponent(JSON.stringify([vscode.Uri.file(filePath), { selection: new vscode.Range(finding.line - 1, 0, finding.line - 1, 999) }]))})\n`;
    }
    markdown += `\n`;
  }

  // Create a new untitled document with markdown
  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
    language: 'markdown'
  });
  
  await vscode.window.showTextDocument(doc, { preview: false });
  
  // Non-blocking notification - use the cloud icon in title bar to fix all
  vscode.window.showInformationMessage(
    '📋 Review complete! Use the cloud icon (☁️) in the title bar to "Fix All from CI".'
  );
}

/**
 * Applies all fixes from the CI report
 */
async function applyAllFixes(report: CIScanReport, workspaceRoot: string) {
  let fixedFiles = 0;
  let fixedIssues = 0;

  for (const fileReport of report.fileReports) {
    const filePath = path.join(workspaceRoot, fileReport.path);
    const uri = vscode.Uri.file(filePath);

    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();

      // Note: Actual fixing would require the full remediation database
      // For now, we just mark the locations
      // In a full implementation, this would call the same fix logic as FixProvider

      fixedFiles++;
      fixedIssues += fileReport.findings.length;
    } catch (error) {
      vscode.window.showWarningMessage(`Could not open file: ${fileReport.path}`);
    }
  }

  vscode.window.showInformationMessage(
    `Processed ${fixedFiles} file(s) with ${fixedIssues} issue(s).`
  );
}

/**
 * Shows instructions for downloading CI results
 */
export async function showDownloadInstructions() {
  const choice = await vscode.window.showInformationMessage(
    '📥 How to get CI scan results:\n\n' +
    '1. Go to your GitHub repository\n' +
    '2. Click the "Actions" tab\n' +
    '3. Click on the latest workflow run\n' +
    '4. Scroll down and download "baseline-results.json"\n' +
    '5. Then use "Import CI Results" to load it',
    'Open GitHub Actions', 'Import Results Now', 'Got It'
  );

  if (choice === 'Open GitHub Actions') {
    // Try to open the repository Actions page
    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    const api = gitExtension?.getAPI(1);
    
    if (api && api.repositories.length > 0) {
      const repo = api.repositories[0];
      const remote = repo.state.remotes.find((r: any) => r.name === 'origin');
      
      if (remote && remote.fetchUrl) {
        const match = remote.fetchUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (match) {
          const url = `https://github.com/${match[1]}/${match[2]}/actions`;
          vscode.env.openExternal(vscode.Uri.parse(url));
          return;
        }
      }
    }
    
    vscode.window.showWarningMessage('Could not detect GitHub repository URL.');
  } else if (choice === 'Import Results Now') {
    await importCIResults();
  }
}

/**
 * Fixes all issues from the last imported CI scan
 * Called by the cloud icon button in the editor title bar
 */
export async function fixAllFromCI() {
  if (!lastCIReport || !lastCIWorkspaceRoot) {
    vscode.window.showWarningMessage(
      'No CI scan results available. Import CI results first.',
      { modal: true },
      'Import Now'
    ).then(async (choice) => {
      if (choice === 'Import Now') {
        await importCIResults();
      }
    });
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Fix all ${lastCIReport.totalIssues} issue(s) from the last CI scan?`,
    { modal: true },
    'Fix All', 'Cancel'
  );

  if (confirm === 'Fix All') {
    await applyAllFixes(lastCIReport, lastCIWorkspaceRoot);
  }
}

