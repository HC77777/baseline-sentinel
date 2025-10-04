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
exports.startGitHubAutoSync = startGitHubAutoSync;
exports.stopGitHubAutoSync = stopGitHubAutoSync;
exports.enableAutoSync = enableAutoSync;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
let syncInterval = null;
let lastCheckedTime = null;
/**
 * Starts auto-sync (polling GitHub for new CI results)
 */
async function startGitHubAutoSync(context) {
    const config = vscode.workspace.getConfiguration('baseline-sentinel');
    const enabled = config.get('autoSyncEnabled', false);
    if (!enabled) {
        return;
    }
    const token = config.get('githubToken');
    if (!token) {
        vscode.window.showWarningMessage('GitHub token not configured. Auto-sync disabled.', { modal: true }, 'Set Up Token').then(async (choice) => {
            if (choice === 'Set Up Token') {
                await enableAutoSync(context);
            }
        });
        return;
    }
    const repoInfo = getRepositoryInfo();
    if (!repoInfo) {
        return;
    }
    // Poll every 30 seconds
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    console.log('[Auto-Sync] Starting GitHub polling...');
    syncInterval = setInterval(async () => {
        await checkForNewResults(token, repoInfo);
    }, 30000); // 30 seconds
    // Check immediately on startup
    await checkForNewResults(token, repoInfo);
}
/**
 * Stops auto-sync
 */
function stopGitHubAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('[Auto-Sync] Stopped.');
    }
}
/**
 * Gets repository info from current workspace
 */
function getRepositoryInfo() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return null;
    }
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
        console.error('[Auto-Sync] Failed to get repo info:', error);
    }
    return null;
}
/**
 * Checks GitHub for new workflow results
 */
async function checkForNewResults(token, repoInfo) {
    try {
        console.log(`[Auto-Sync] Checking ${repoInfo.owner}/${repoInfo.repo}...`);
        const runs = await fetchLatestWorkflowRuns(token, repoInfo);
        if (!runs || runs.length === 0) {
            return;
        }
        const baselineRun = runs.find((r) => r.name === 'Baseline Sentinel' || r.name === 'Baseline Sentinel Check');
        if (!baselineRun || baselineRun.status !== 'completed') {
            console.log('[Auto-Sync] No completed Baseline runs found.');
            return;
        }
        const runCompletedAt = new Date(baselineRun.updated_at);
        // Skip if we've already notified about this run
        if (lastCheckedTime && runCompletedAt <= lastCheckedTime) {
            return;
        }
        lastCheckedTime = runCompletedAt;
        // Try to download the artifact
        const artifactData = await fetchArtifactData(token, repoInfo, baselineRun.id);
        if (artifactData) {
            await showResultsNotification(artifactData);
        }
    }
    catch (error) {
        console.error('[Auto-Sync] Error:', error?.message || error);
    }
}
/**
 * Fetches latest workflow runs
 */
function fetchLatestWorkflowRuns(token, repoInfo) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${repoInfo.owner}/${repoInfo.repo}/actions/runs?per_page=5`,
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
 * Fetches artifact data from a workflow run
 * Note: For simplicity, we'll show a notification to download manually
 * Full artifact download requires complex ZIP extraction
 */
async function fetchArtifactData(token, repoInfo, runId) {
    // For now, we'll return a signal that results are available
    // Full implementation would require downloading and unzipping the artifact
    return {
        totalIssues: -1, // -1 signals "unknown, needs manual download"
        fileReports: [],
        totalFiles: 0
    };
}
/**
 * Shows notification about new CI results
 */
async function showResultsNotification(data) {
    const choice = await vscode.window.showInformationMessage('🔔 New CI scan completed! Automatically download and import results?', { modal: true }, 'Import Now', 'View on GitHub', 'Dismiss');
    if (choice === 'Import Now') {
        // Automatically download and import
        vscode.commands.executeCommand('baseline.importCIResults');
    }
    else if (choice === 'View on GitHub') {
        vscode.commands.executeCommand('baseline.downloadGitHubResults');
    }
}
/**
 * Enables auto-sync feature
 */
async function enableAutoSync(context) {
    const token = await vscode.window.showInputBox({
        prompt: 'Paste your GitHub Personal Access Token',
        password: true,
        placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || !value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                return 'Token should start with "ghp_" or "github_pat_"';
            }
            if (value.length < 40) {
                return 'Token seems too short. Make sure you copied the entire token.';
            }
            return null;
        }
    });
    if (!token) {
        return;
    }
    // Save the token
    const config = vscode.workspace.getConfiguration('baseline-sentinel');
    await config.update('githubToken', token, vscode.ConfigurationTarget.Global);
    await config.update('autoSyncEnabled', true, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('✅ Auto-sync enabled! VS Code will check for new CI results every 30 seconds.', 'Got It');
    // Start syncing immediately
    await startGitHubAutoSync(context);
}
