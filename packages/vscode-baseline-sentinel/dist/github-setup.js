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
exports.setupGitHubAction = setupGitHubAction;
exports.isGitHubActionSetup = isGitHubActionSetup;
exports.promptGitHubActionSetup = promptGitHubActionSetup;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Sets up GitHub Actions for Baseline Sentinel
 */
async function setupGitHubAction() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const workflowDir = path.join(rootPath, '.github', 'workflows');
    const workflowFile = path.join(workflowDir, 'baseline-sentinel.yml');
    // Check if workflow already exists
    if (fs.existsSync(workflowFile)) {
        const overwrite = await vscode.window.showWarningMessage('Baseline Sentinel workflow already exists. Overwrite?', 'Yes', 'No');
        if (overwrite !== 'Yes') {
            return;
        }
    }
    // Create workflow content that clones baseline-sentinel and runs the scanner
    const workflowContent = `name: Baseline Sentinel

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  schedule:
    # Weekly scan every Monday at 9 AM UTC
    - cron: '0 9 * * 1'
  workflow_dispatch: # Manual trigger

jobs:
  scan:
    name: Scan for Non-Baseline Features
    runs-on: ubuntu-latest
    steps:
      - name: Checkout project
        uses: actions/checkout@v4
        with:
          path: project

      - name: Checkout Baseline Sentinel
        uses: actions/checkout@v4
        with:
          repository: HC77777/baseline-sentinel
          path: baseline-sentinel

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install and Build
        run: |
          cd baseline-sentinel
          pnpm install
          pnpm run build

      - name: Run Scan & Generate Compatibility Report
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
        run: |
          cd baseline-sentinel
          node packages/action-baseline-sentinel/index.js ../project github
        continue-on-error: true

      - name: Upload Baseline Scan Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: baseline-results
          path: |
            baseline-sentinel/baseline-results.json
            baseline-sentinel/baseline-compatibility-report.md
            baseline-sentinel/baseline-compatibility-data.json
          retention-days: 90
      
      - name: Comment PR with Report Summary
        if: github.event_name == 'pull_request' && always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            try {
              const report = fs.readFileSync('baseline-sentinel/baseline-compatibility-report.md', 'utf8');
              const summary = report.split('\\n').slice(0, 30).join('\\n');
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: summary + '\\n\\n[View full report in artifacts]'
              });
            } catch (error) {
              console.log('No report file found or PR comment failed');
            }
`;
    // Create directories if needed
    if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
    }
    // Write workflow file
    try {
        fs.writeFileSync(workflowFile, workflowContent, 'utf-8');
        const openFile = await vscode.window.showInformationMessage('✅ GitHub Action configured! Commit and push this file to enable automatic scanning.', 'Open File', 'Got It');
        if (openFile === 'Open File') {
            const doc = await vscode.workspace.openTextDocument(workflowFile);
            await vscode.window.showTextDocument(doc);
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to create workflow file: ${error}`);
    }
}
/**
 * Checks if GitHub Action is set up
 */
function isGitHubActionSetup() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return false;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const workflowFile = path.join(rootPath, '.github', 'workflows', 'baseline-sentinel.yml');
    return fs.existsSync(workflowFile);
}
/**
 * Shows a notification to set up GitHub Actions if not already done
 */
async function promptGitHubActionSetup() {
    if (isGitHubActionSetup()) {
        return; // Already set up
    }
    const response = await vscode.window.showInformationMessage('🛡️ Enable Baseline Sentinel scanning on GitHub?', 'Set Up Now', 'Later', 'Don\'t Ask Again');
    if (response === 'Set Up Now') {
        await setupGitHubAction();
    }
    else if (response === 'Don\'t Ask Again') {
        vscode.workspace.getConfiguration('baseline-sentinel').update('hideGitHubSetup', true, true);
    }
}
