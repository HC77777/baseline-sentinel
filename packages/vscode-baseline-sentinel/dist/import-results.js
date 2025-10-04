"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCIResults = importCIResults;
exports.showDownloadInstructions = showDownloadInstructions;
exports.fixAllFromCI = fixAllFromCI;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const AdmZip = require("adm-zip");
const baseline_fixer_core_1 = require("baseline-fixer-core");
// Store the last imported CI report for "Fix All from CI" command
let lastCIReport = null;
let lastCIWorkspaceRoot = null;
/**
 * Validates that the current workspace matches the GitHub repository
 */
function validateWorkspaceMatchesRepo(repoInfo) {
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
async function importCIResults() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }
    // Get GitHub token
    const config = vscode.workspace.getConfiguration('baseline-sentinel');
    const token = config.get('githubToken');
    if (!token) {
        const choice = await vscode.window.showWarningMessage('GitHub token not configured. Auto-download requires a token.', { modal: true }, 'Set Up Token', 'Manual Import', 'Cancel');
        if (choice === 'Set Up Token') {
            await vscode.commands.executeCommand('baseline.enableAutoSync');
            return;
        }
        else if (choice === 'Manual Import') {
            await manualImport();
            return;
        }
        else {
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
                throw new Error(`Workspace mismatch!\n\n` +
                    `VS Code folder: "${workspaceName}"\n` +
                    `GitHub repo: "${repoInfo.repo}"\n\n` +
                    `Please open the correct folder that matches your GitHub repository.`);
            }
            progress.report({ message: 'Finding latest workflow run...' });
            // Get latest workflow run
            const runs = await fetchLatestWorkflowRuns(token, repoInfo);
            const baselineRun = runs.find((r) => r.name === 'Baseline Sentinel' || r.name === 'Baseline Sentinel Check');
            if (!baselineRun) {
                throw new Error('No Baseline Sentinel workflow runs found');
            }
            progress.report({ message: 'Downloading artifact...' });
            // Download artifact
            const report = await downloadArtifact(token, repoInfo, baselineRun.id);
            progress.report({ message: 'Processing results...' });
            // Process the report
            await processReport(report, workspaceFolders[0].uri.fsPath);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to download CI results: ${error.message}`, { modal: true }, 'Manual Import').then(async (choice) => {
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
    const report = JSON.parse(content.toString());
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        await processReport(report, workspaceFolders[0].uri.fsPath);
    }
}
/**
 * Gets repository info from Git
 */
function getRepositoryInfo() {
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        const api = gitExtension?.getAPI(1);
        if (api && api.repositories.length > 0) {
            const repo = api.repositories[0];
            const remote = repo.state.remotes.find((r) => r.name === 'origin');
            if (remote && remote.fetchUrl) {
                const match = remote.fetchUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
                if (match) {
                    return { owner: match[1], repo: match[2] };
                }
            }
        }
    }
    catch (error) {
        console.error('[Import] Failed to get repo info:', error);
    }
    return null;
}
/**
 * Fetches latest workflow runs
 */
function fetchLatestWorkflowRuns(token, repoInfo) {
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
                }
                catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}
/**
 * Downloads and extracts artifact from workflow run
 */
async function downloadArtifact(token, repoInfo, runId) {
    // Get artifacts list
    const artifacts = await fetchArtifacts(token, repoInfo, runId);
    const baselineArtifact = artifacts.find((a) => a.name === 'baseline-results');
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
    }
    catch (e) {
        // Ignore cleanup errors
    }
    return report;
}
/**
 * Fetches artifacts from a workflow run
 */
function fetchArtifacts(token, repoInfo, runId) {
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
                }
                catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}
/**
 * Downloads artifact ZIP file
 */
function downloadArtifactZip(token, repoInfo, artifactId) {
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
                }
                else {
                    reject(new Error('Redirect location not found'));
                }
            }
            else {
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
async function extractJsonFromZip(zipPath) {
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
async function processReport(report, workspaceRoot) {
    // Store for "Fix All from CI" button
    lastCIReport = report;
    lastCIWorkspaceRoot = workspaceRoot;
    // Display summary
    const proceed = await vscode.window.showInformationMessage(`Found ${report.totalIssues} issue(s) in ${report.fileReports.length} file(s). Review and fix?`, { modal: true }, 'Review', 'Fix All', 'Cancel');
    if (proceed === 'Cancel' || !proceed) {
        return;
    }
    if (proceed === 'Fix All') {
        await applyAllFixes(report, workspaceRoot);
    }
    else if (proceed === 'Review') {
        await openReviewPanel(report, workspaceRoot);
    }
}
/**
 * Opens a panel to review CI issues
 */
async function openReviewPanel(report, workspaceRoot) {
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
    vscode.window.showInformationMessage('📋 Review complete! Use the cloud icon (☁️) in the title bar to "Fix All from CI".');
}
/**
 * Applies all fixes from the CI report
 */
async function applyAllFixes(report, workspaceRoot) {
    let fixedFiles = 0;
    let fixedIssues = 0;
    const edit = new vscode.WorkspaceEdit();
    for (const fileReport of report.fileReports) {
        const filePath = path.join(workspaceRoot, fileReport.path);
        const uri = vscode.Uri.file(filePath);
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            // Apply fixes for each finding
            for (const finding of fileReport.findings) {
                const remediation = (0, baseline_fixer_core_1.getRemediation)(finding.fixId);
                if (!remediation || remediation.fixes.length === 0) {
                    continue;
                }
                const fix = remediation.fixes[0];
                const line = doc.lineAt(finding.line - 1); // Convert 1-based to 0-based
                const range = new vscode.Range(finding.line - 1, 0, finding.line - 1, line.text.length);
                // Apply the fix based on type
                await applyFixToRange(doc, range, fix, edit, finding);
                fixedIssues++;
            }
            fixedFiles++;
        }
        catch (error) {
            console.error(`Failed to fix ${fileReport.path}:`, error);
        }
    }
    // Apply all edits at once
    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
        vscode.window.showInformationMessage(`✅ Fixed ${fixedIssues} issue(s) in ${fixedFiles} file(s)!`, { modal: true });
    }
    else {
        vscode.window.showErrorMessage(`Failed to apply some fixes. Fixed ${fixedIssues} issue(s) in ${fixedFiles} file(s).`, { modal: true });
    }
}
/**
 * Applies a fix to a specific range
 */
async function applyFixToRange(document, range, fix, edit, finding) {
    const line = document.lineAt(range.start.line);
    const lineText = line.text;
    switch (fix.type) {
        case 'add-css-declaration': {
            const payload = fix.payload;
            const indentation = lineText.match(/^\s*/)?.[0] || '';
            const newDeclaration = `${indentation}${payload.property}: ${payload.value};`;
            edit.insert(document.uri, line.range.start, newDeclaration + '\n');
            break;
        }
        case 'remove-css-declaration': {
            edit.delete(document.uri, line.rangeIncludingLineBreak);
            break;
        }
        case 'replace-property': {
            const payload = fix.payload;
            const newText = lineText.replace(payload.old, payload.new);
            edit.replace(document.uri, line.range, newText);
            break;
        }
        case 'replace-css-declaration': {
            const payload = fix.payload;
            let newText = lineText.replace(payload.oldProperty, payload.newProperty);
            if (payload.newValue) {
                newText = newText.replace(/:\s*[^;]+;/, `: ${payload.newValue};`);
            }
            edit.replace(document.uri, line.range, newText);
            break;
        }
        case 'add-comment-warning':
        case 'recommend-polyfill': {
            const payload = fix.payload;
            const indentation = lineText.match(/^\s*/)?.[0] || '';
            const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
            // Determine comment syntax based on file type
            let comment;
            if (document.languageId === 'css') {
                comment = `/* ${payload.message} */`;
            }
            else {
                comment = `// ${payload.message}`;
            }
            const newText = `${indentation}${comment}${eol}`;
            edit.insert(document.uri, line.range.start, newText);
            break;
        }
    }
}
/**
 * Shows instructions for downloading CI results
 */
async function showDownloadInstructions() {
    const choice = await vscode.window.showInformationMessage('📥 How to get CI scan results:\n\n' +
        '1. Go to your GitHub repository\n' +
        '2. Click the "Actions" tab\n' +
        '3. Click on the latest workflow run\n' +
        '4. Scroll down and download "baseline-results.json"\n' +
        '5. Then use "Import CI Results" to load it', 'Open GitHub Actions', 'Import Results Now', 'Got It');
    if (choice === 'Open GitHub Actions') {
        // Try to open the repository Actions page
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        const api = gitExtension?.getAPI(1);
        if (api && api.repositories.length > 0) {
            const repo = api.repositories[0];
            const remote = repo.state.remotes.find((r) => r.name === 'origin');
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
    }
    else if (choice === 'Import Results Now') {
        await importCIResults();
    }
}
/**
 * Fixes all issues from the last imported CI scan
 * Called by the cloud icon button in the editor title bar
 */
async function fixAllFromCI() {
    if (!lastCIReport || !lastCIWorkspaceRoot) {
        vscode.window.showWarningMessage('No CI scan results available. Import CI results first.', { modal: true }, 'Import Now').then(async (choice) => {
            if (choice === 'Import Now') {
                await importCIResults();
            }
        });
        return;
    }
    const confirm = await vscode.window.showWarningMessage(`Fix all ${lastCIReport.totalIssues} issue(s) from the last CI scan?`, { modal: true }, 'Fix All', 'Cancel');
    if (confirm === 'Fix All') {
        await applyAllFixes(lastCIReport, lastCIWorkspaceRoot);
    }
}
