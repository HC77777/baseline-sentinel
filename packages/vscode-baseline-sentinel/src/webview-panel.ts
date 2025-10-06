import * as vscode from 'vscode';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function openBaselineSentinelPanel(context: vscode.ExtensionContext) {
  // If panel already exists, just reveal it
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  // Create new webview panel
  currentPanel = vscode.window.createWebviewPanel(
    'baselineSentinel',
    'Baseline Sentinel Dashboard',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  // Set the HTML content
  currentPanel.webview.html = getWebviewContent(context);

  // Handle messages from the webview
  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'getStatus':
          await sendStatusUpdate(currentPanel!);
          break;
        case 'setupGitHub':
          await handleSetupGitHub();
          break;
        case 'saveToken':
          await handleSaveToken(message.token);
          break;
        case 'enableAutoSync':
          await handleEnableAutoSync();
          break;
        case 'toggleAutoReport':
          await handleToggleAutoReport();
          break;
        case 'importResults':
          await vscode.commands.executeCommand('baseline.importCIResults');
          break;
        case 'fixAll':
          await vscode.commands.executeCommand('baseline.fixAllInFile');
          break;
        case 'generateReport':
          await vscode.commands.executeCommand('baseline.generateWorkspaceReport');
          break;
        case 'saveOpenAIKey':
          await handleSaveOpenAIKey(message.apiKey);
          break;
        case 'toggleOpenAIReports':
          await handleToggleOpenAIReports();
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  // Send initial status
  sendStatusUpdate(currentPanel);

  // Clean up when panel is closed
  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    null,
    context.subscriptions
  );
}

function getRepositoryInfo(): { owner: string; repo: string } | null {
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    const git = gitExtension?.getAPI(1);
    if (!git || git.repositories.length === 0) {
      return null;
    }
    const repo = git.repositories[0];
    const remote = repo.state.remotes.find((r: any) => r.name === 'origin');
    if (!remote) {
      return null;
    }
    const match = remote.fetchUrl?.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (!match) {
      return null;
    }
    return { owner: match[1], repo: match[2] };
  } catch (error) {
    return null;
  }
}

async function sendStatusUpdate(panel: vscode.WebviewPanel) {
  const config = vscode.workspace.getConfiguration('baseline-sentinel');
  const repoInfo = getRepositoryInfo();
  const hasToken = !!config.get<string>('githubToken');
  const autoSyncEnabled = config.get('autoSyncEnabled', false);
  const autoReportEnabled = config.get('autoSendReportOnSave', false);
  const hasOpenAIKey = !!config.get<string>('openaiApiKey');
  const useOpenAIReports = config.get('useOpenAIReports', true);

  panel.webview.postMessage({
    type: 'statusUpdate',
    data: {
      repoDetected: !!repoInfo,
      repoName: repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : 'No repository',
      hasToken,
      autoSyncEnabled,
      autoReportEnabled,
      hasOpenAIKey,
      useOpenAIReports,
      workspaceName: vscode.workspace.name || 'No workspace',
    },
  });
}

async function handleSetupGitHub() {
  await vscode.commands.executeCommand('baseline.setupGitHub');
  if (currentPanel) {
    await sendStatusUpdate(currentPanel);
  }
}

async function handleSaveToken(token: string) {
  const config = vscode.workspace.getConfiguration('baseline-sentinel');
  await config.update('githubToken', token, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage('✅ GitHub token saved!');
  if (currentPanel) {
    await sendStatusUpdate(currentPanel);
  }
}

async function handleEnableAutoSync() {
  const config = vscode.workspace.getConfiguration('baseline-sentinel');
  await config.update('autoSyncEnabled', true, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage('✅ Auto-sync enabled!');
  await vscode.commands.executeCommand('baseline.enableAutoSync');
  if (currentPanel) {
    await sendStatusUpdate(currentPanel);
  }
}

async function handleToggleAutoReport() {
  const config = vscode.workspace.getConfiguration('baseline-sentinel');
  const currentValue = config.get('autoSendReportOnSave', false);
  await config.update('autoSendReportOnSave', !currentValue, vscode.ConfigurationTarget.Global);
  
  if (!currentValue) {
    vscode.window.showInformationMessage('✅ Auto-send report enabled! Reports will be sent to chat when you save files with issues.');
  } else {
    vscode.window.showInformationMessage('Auto-send report disabled.');
  }
  
  if (currentPanel) {
    await sendStatusUpdate(currentPanel);
  }
}

async function handleSaveOpenAIKey(apiKey: string) {
  const config = vscode.workspace.getConfiguration('baseline-sentinel');
  await config.update('openaiApiKey', apiKey, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage('✅ OpenAI API key saved! You can now generate AI-powered reports.');
  if (currentPanel) {
    await sendStatusUpdate(currentPanel);
  }
}

async function handleToggleOpenAIReports() {
  const config = vscode.workspace.getConfiguration('baseline-sentinel');
  const currentValue = config.get('useOpenAIReports', true);
  await config.update('useOpenAIReports', !currentValue, vscode.ConfigurationTarget.Global);
  
  if (!currentValue) {
    vscode.window.showInformationMessage('✅ AI-enhanced reports enabled! Reports will be beautiful and visual.');
  } else {
    vscode.window.showInformationMessage('ℹ️ Standard reports enabled. Reports will be faster but less visual.');
  }
  
  if (currentPanel) {
    await sendStatusUpdate(currentPanel);
  }
}

function getWebviewContent(context: vscode.ExtensionContext): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baseline Sentinel Dashboard</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      padding: 30px 0;
      border-bottom: 2px solid var(--vscode-panel-border);
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header p {
      color: var(--vscode-descriptionForeground);
      font-size: 1.1rem;
    }

    .status-card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .status-row:last-child {
      border-bottom: none;
    }

    .status-label {
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .status-value {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .badge.success {
      background: #10b98144;
      color: #10b981;
    }

    .badge.warning {
      background: #f59e0b44;
      color: #f59e0b;
    }

    .badge.error {
      background: #ef444444;
      color: #ef4444;
    }

    .section {
      margin-bottom: 30px;
    }

    .section h2 {
      font-size: 1.5rem;
      margin-bottom: 15px;
      color: var(--vscode-foreground);
    }

    .step-card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .step-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      flex-shrink: 0;
    }

    .step-title {
      font-size: 1.2rem;
      font-weight: 600;
    }

    .step-description {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 15px;
    }

    .button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: background 0.2s;
    }

    .button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-group {
      margin-bottom: 15px;
    }

    .input-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 600;
    }

    .input-group input {
      width: 100%;
      padding: 8px 12px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 1rem;
    }

    .input-group input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .icon {
      font-size: 1.2rem;
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }

    .quick-action-card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .quick-action-card:hover {
      border-color: var(--vscode-button-background);
      transform: translateY(-2px);
    }

    .quick-action-icon {
      font-size: 2rem;
      margin-bottom: 10px;
    }

    .quick-action-title {
      font-weight: 600;
      margin-bottom: 5px;
    }

    .quick-action-desc {
      font-size: 0.9rem;
      color: var(--vscode-descriptionForeground);
    }

    .info-box {
      background: var(--vscode-textBlockQuote-background);
      border-left: 4px solid var(--vscode-button-background);
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }

    .info-box code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Baseline Sentinel</h1>
      <p>Your Guardian for Web Compatibility</p>
    </div>

    <div class="status-card">
      <h2 style="margin-bottom: 15px;">📊 Current Status</h2>
      <div class="status-row">
        <span class="status-label">Workspace</span>
        <span class="status-value" id="workspace-name">Loading...</span>
      </div>
      <div class="status-row">
        <span class="status-label">GitHub Repository</span>
        <span class="status-value" id="repo-status">
          <span class="badge warning">Not Detected</span>
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">GitHub Token</span>
        <span class="status-value" id="token-status">
          <span class="badge error">Not Configured</span>
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">Auto-Sync</span>
        <span class="status-value" id="autosync-status">
          <span class="badge error">Disabled</span>
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">Auto-Send to Chat (Vibe Mode)</span>
        <span class="status-value" id="autoreport-status">
          <span class="badge error">Disabled</span>
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">OpenAI API (AI Reports)</span>
        <span class="status-value" id="openai-status">
          <span class="badge error">Not Configured</span>
        </span>
      </div>
    </div>

    <div class="section">
      <h2>🚀 Quick Actions</h2>
      <div class="quick-actions">
        <div class="quick-action-card" onclick="generateReport()">
          <div class="quick-action-icon">📊</div>
          <div class="quick-action-title">Generate Report</div>
          <div class="quick-action-desc">Scan entire codebase</div>
        </div>
        <div class="quick-action-card" onclick="importResults()">
          <div class="quick-action-icon">📥</div>
          <div class="quick-action-title">Import CI Results</div>
          <div class="quick-action-desc">Load latest GitHub scan</div>
        </div>
        <div class="quick-action-card" onclick="fixAll()">
          <div class="quick-action-icon">✨</div>
          <div class="quick-action-title">Fix All Issues</div>
          <div class="quick-action-desc">Auto-fix current file</div>
        </div>
        <div class="quick-action-card" onclick="refreshStatus()">
          <div class="quick-action-icon">🔄</div>
          <div class="quick-action-title">Refresh Status</div>
          <div class="quick-action-desc">Update connection info</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>⚙️ GitHub CI Setup</h2>
      
      <div class="step-card">
        <div class="step-header">
          <div class="step-number">1</div>
          <div class="step-title">Connect to GitHub Repository</div>
        </div>
        <p class="step-description">
          Ensure your workspace is linked to a GitHub repository. Open a folder that contains a <code>.git</code> directory.
        </p>
        <div class="info-box" id="repo-info">
          <strong>Repository:</strong> <span id="repo-name">Not detected</span>
        </div>
      </div>

      <div class="step-card">
        <div class="step-header">
          <div class="step-number">2</div>
          <div class="step-title">Set Up GitHub Actions</div>
        </div>
        <p class="step-description">
          Create a GitHub Actions workflow that will automatically scan your code on every push.
        </p>
        <div class="actions">
          <button class="button" onclick="setupGitHub()">🔧 Create Workflow File</button>
        </div>
      </div>

      <div class="step-card">
        <div class="step-header">
          <div class="step-number">3</div>
          <div class="step-title">Configure GitHub Token</div>
        </div>
        <p class="step-description">
          Add a personal access token to enable automatic CI result imports.
        </p>
        <div class="info-box">
          <strong>How to get a token:</strong><br>
          1. Go to GitHub → Settings → Developer settings → Personal access tokens<br>
          2. Click "Generate new token (classic)"<br>
          3. Select <code>repo</code> and <code>workflow</code> scopes<br>
          4. Copy the token and paste below
        </div>
        <div class="input-group">
          <label for="github-token">GitHub Personal Access Token</label>
          <input type="password" id="github-token" placeholder="ghp_xxxxxxxxxxxx">
        </div>
        <div class="actions">
          <button class="button" onclick="saveToken()">💾 Save Token</button>
        </div>
      </div>

      <div class="step-card">
        <div class="step-header">
          <div class="step-number">4</div>
          <div class="step-title">Enable Auto-Sync (Optional)</div>
        </div>
        <p class="step-description">
          Automatically poll GitHub every 5 seconds for new scan results.
        </p>
        <div class="actions">
          <button class="button secondary" onclick="enableAutoSync()">🔄 Enable Auto-Sync</button>
        </div>
      </div>

      <div class="step-card">
        <div class="step-header">
          <div class="step-number">5</div>
          <div class="step-title">Configure OpenAI API (Optional)</div>
        </div>
        <p class="step-description">
          Add an OpenAI API key to enable AI-powered compatibility reports with beautiful visuals, diagrams, and clear explanations.
        </p>
        <div class="info-box">
          <strong>How to get an API key:</strong><br>
          1. Go to <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a><br>
          2. Click "Create new secret key"<br>
          3. Copy the key (starts with sk-...)<br>
          4. Paste below<br><br>
          <strong>Cost:</strong> ~$0.03 per full workspace report (very affordable!)<br>
          <strong>Enhancement:</strong> Beautiful diagrams, emojis, visual elements, and clear language
        </div>
        <div class="input-group">
          <label for="openai-key">OpenAI API Key</label>
          <input type="password" id="openai-key" placeholder="sk-...">
        </div>
        <div class="actions">
          <button class="button" onclick="saveOpenAIKey()">💾 Save OpenAI Key</button>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--vscode-panel-border);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>AI-Enhanced Reports</strong>
              <p style="margin: 5px 0 0 0; color: var(--vscode-descriptionForeground); font-size: 0.9rem;">
                <span id="openai-toggle-status">Enabled</span> - Use OpenAI to beautify reports
              </p>
            </div>
            <button class="button secondary" onclick="toggleOpenAIReports()" id="toggle-openai-btn">
              🎨 Toggle Enhancement
            </button>
          </div>
          <div class="info-box" style="margin-top: 10px; font-size: 0.85rem;">
            <strong>✨ With AI Enhancement:</strong> Colorful emojis, visual diagrams, box drawings, clear explanations<br>
            <strong>⚡ Without AI:</strong> Standard report, faster generation, no API cost
          </div>
        </div>
      </div>

      <div class="step-card">
        <div class="step-header">
          <div class="step-number">6</div>
          <div class="step-title">Auto-Send to Chat (Vibe Mode)</div>
        </div>
        <p class="step-description">
          For "vibe coders": Automatically send scan reports to LLM chat when you save files with issues. Perfect for reviewing all warnings after coding a large section.
        </p>
        <div class="info-box">
          <strong>How it works:</strong><br>
          • Write code freely without interruptions<br>
          • Save your file (Cmd+S / Ctrl+S)<br>
          • If issues are found, a report is automatically sent to your chat (Copilot, Cursor, etc.)<br>
          • Review and fix issues with AI assistance
        </div>
        <div class="actions">
          <button class="button secondary" onclick="toggleAutoReport()">🤖 Toggle Auto-Send to Chat</button>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>📚 Documentation</h2>
      <div class="info-box">
        <strong>Need help?</strong> Check out the documentation files in your extension folder:
        <ul style="margin-top: 10px; margin-left: 20px;">
          <li><code>GITHUB-TOKEN-GUIDE.md</code> - How to get a GitHub token</li>
          <li><code>AUTO-SYNC-GUIDE.md</code> - Auto-sync feature guide</li>
          <li><code>AUTOMATIC-GITHUB-SETUP.md</code> - GitHub Actions setup</li>
        </ul>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Request initial status
    vscode.postMessage({ command: 'getStatus' });

    // Listen for status updates
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'statusUpdate') {
        updateStatus(message.data);
      }
    });

    function updateStatus(data) {
      // Update workspace name
      document.getElementById('workspace-name').textContent = data.workspaceName;

      // Update repo status
      const repoStatus = document.getElementById('repo-status');
      const repoName = document.getElementById('repo-name');
      if (data.repoDetected) {
        repoStatus.innerHTML = '<span class="badge success">✓ Connected</span>';
        repoName.textContent = data.repoName;
        document.getElementById('repo-info').style.background = 'var(--vscode-testing-iconPassed)22';
      } else {
        repoStatus.innerHTML = '<span class="badge warning">Not Detected</span>';
        repoName.textContent = 'No Git repository found';
      }

      // Update token status
      const tokenStatus = document.getElementById('token-status');
      if (data.hasToken) {
        tokenStatus.innerHTML = '<span class="badge success">✓ Configured</span>';
      } else {
        tokenStatus.innerHTML = '<span class="badge error">Not Configured</span>';
      }

      // Update auto-sync status
      const autosyncStatus = document.getElementById('autosync-status');
      if (data.autoSyncEnabled) {
        autosyncStatus.innerHTML = '<span class="badge success">✓ Enabled</span>';
      } else {
        autosyncStatus.innerHTML = '<span class="badge error">Disabled</span>';
      }

      // Update auto-report status
      const autoreportStatus = document.getElementById('autoreport-status');
      if (data.autoReportEnabled) {
        autoreportStatus.innerHTML = '<span class="badge success">✓ Enabled</span>';
      } else {
        autoreportStatus.innerHTML = '<span class="badge error">Disabled</span>';
      }

      // Update OpenAI status
      const openaiStatus = document.getElementById('openai-status');
      if (data.hasOpenAIKey) {
        openaiStatus.innerHTML = '<span class="badge success">✓ Configured</span>';
      } else {
        openaiStatus.innerHTML = '<span class="badge error">Not Configured</span>';
      }

      // Update OpenAI toggle status
      const openaiToggleStatus = document.getElementById('openai-toggle-status');
      const toggleBtn = document.getElementById('toggle-openai-btn');
      if (data.useOpenAIReports) {
        openaiToggleStatus.textContent = '✅ Enabled';
        openaiToggleStatus.style.color = 'var(--vscode-testing-iconPassed)';
        if (toggleBtn) toggleBtn.textContent = '🎨 Disable Enhancement';
      } else {
        openaiToggleStatus.textContent = '⚡ Disabled';
        openaiToggleStatus.style.color = 'var(--vscode-descriptionForeground)';
        if (toggleBtn) toggleBtn.textContent = '🎨 Enable Enhancement';
      }
    }

    function setupGitHub() {
      vscode.postMessage({ command: 'setupGitHub' });
    }

    function saveToken() {
      const token = document.getElementById('github-token').value;
      if (!token) {
        alert('Please enter a token');
        return;
      }
      vscode.postMessage({ command: 'saveToken', token });
      document.getElementById('github-token').value = '';
    }

    function enableAutoSync() {
      vscode.postMessage({ command: 'enableAutoSync' });
    }

    function saveOpenAIKey() {
      const apiKey = document.getElementById('openai-key').value;
      if (!apiKey) {
        alert('Please enter an API key');
        return;
      }
      vscode.postMessage({ command: 'saveOpenAIKey', apiKey });
      document.getElementById('openai-key').value = '';
    }

    function toggleAutoReport() {
      vscode.postMessage({ command: 'toggleAutoReport' });
    }

    function toggleOpenAIReports() {
      vscode.postMessage({ command: 'toggleOpenAIReports' });
    }

    function generateReport() {
      vscode.postMessage({ command: 'generateReport' });
    }

    function importResults() {
      vscode.postMessage({ command: 'importResults' });
    }

    function fixAll() {
      vscode.postMessage({ command: 'fixAll' });
    }

    function refreshStatus() {
      vscode.postMessage({ command: 'getStatus' });
    }
  </script>
</body>
</html>`;
}

