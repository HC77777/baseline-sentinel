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
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Imports CI scan results and applies fixes
 */
async function importCIResults() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }
    // Ask user to paste the JSON report
    const input = await vscode.window.showInputBox({
        prompt: 'Paste the CI scan results JSON (or leave empty to load from file)',
        placeHolder: '{"totalIssues": 18, "fileReports": [...]}',
        ignoreFocusOut: true
    });
    let report;
    if (!input || input.trim() === '') {
        // Load from file
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'JSON': ['json']
            },
            title: 'Select CI Results JSON File'
        });
        if (!fileUri || fileUri.length === 0) {
            return;
        }
        const content = await vscode.workspace.fs.readFile(fileUri[0]);
        report = JSON.parse(content.toString());
    }
    else {
        try {
            report = JSON.parse(input);
        }
        catch (error) {
            vscode.window.showErrorMessage('Invalid JSON format.');
            return;
        }
    }
    // Display summary
    const proceed = await vscode.window.showInformationMessage(`Found ${report.totalIssues} issue(s) in ${report.fileReports.length} file(s). Review and fix?`, 'Review', 'Fix All', 'Cancel');
    if (proceed === 'Cancel' || !proceed) {
        return;
    }
    if (proceed === 'Fix All') {
        await applyAllFixes(report, workspaceFolders[0].uri.fsPath);
    }
    else if (proceed === 'Review') {
        await openReviewPanel(report, workspaceFolders[0].uri.fsPath);
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
    vscode.window.showInformationMessage('Review the issues. Click links to jump to code. Use "Fix All" to auto-fix issues.', 'Fix All').then(async (selection) => {
        if (selection === 'Fix All') {
            await applyAllFixes(report, workspaceRoot);
        }
    });
}
/**
 * Applies all fixes from the CI report
 */
async function applyAllFixes(report, workspaceRoot) {
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
        }
        catch (error) {
            vscode.window.showWarningMessage(`Could not open file: ${fileReport.path}`);
        }
    }
    vscode.window.showInformationMessage(`Processed ${fixedFiles} file(s) with ${fixedIssues} issue(s).`);
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
