import * as vscode from 'vscode';
import { scanCode, Finding, getRemediation, Fix } from 'baseline-fixer-core';
import { FixProvider } from './FixProvider';
import { setupGitHubAction, promptGitHubActionSetup } from './github-setup';
import { importCIResults, showDownloadInstructions, fixAllFromCI } from './import-results';
import { startGitHubAutoSync, stopGitHubAutoSync, enableAutoSync } from './github-auto-sync';
import { openBaselineSentinelPanel } from './webview-panel';
import { generateWorkspaceReport } from './workspace-report';

let diagnosticCollection: vscode.DiagnosticCollection;
// Store the latest findings for the hover provider
let latestFindings: Map<string, Finding[]> = new Map();
// A debounce timer for on-the-fly diagnostics
let debounceTimer: NodeJS.Timeout;
// Output channel for logging
export let outputChannel: vscode.OutputChannel;


export async function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('Baseline Sentinel');
  context.subscriptions.push(outputChannel);
  
  outputChannel.appendLine('🚀 Baseline Sentinel activated!');
  console.log('🚀 Baseline Sentinel activated!');
  
  // Create a diagnostic collection to hold our warnings.
  diagnosticCollection = vscode.languages.createDiagnosticCollection('baselineSentinel');
  context.subscriptions.push(diagnosticCollection);

  const supportedLanguages = ['css', 'javascript', 'typescript', 'typescriptreact', 'html'];

  // Run the scanner on the active editor when the extension is activated.
  if (vscode.window.activeTextEditor) {
    console.log(`[activate] Active editor: ${vscode.window.activeTextEditor.document.uri.fsPath}, language: ${vscode.window.activeTextEditor.document.languageId}`);
    if (supportedLanguages.includes(vscode.window.activeTextEditor.document.languageId)) {
      updateDiagnostics(vscode.window.activeTextEditor.document);
    }
  } else {
    console.log('[activate] No active editor');
  }

  // === NEW: Run scanner as the user types (with debounce) ===
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          updateDiagnostics(event.document);
        }, 500); // 500ms delay for performance
      }
    })
  );

  // Run the scanner whenever a document is opened or saved (as a fallback).
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateDiagnostics)
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      await updateDiagnostics(document);
      // Auto-send report to chat for vibe coders (if enabled)
      await autoSendReportOnSave(document);
    })
  );

  // Register our Quick Fix provider for all supported languages.
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(supportedLanguages, new FixProvider(), {
      providedCodeActionKinds: FixProvider.providedCodeActionKinds
    })
  );

  // Register our new Hover provider for all supported languages
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(supportedLanguages, {
      provideHover(document, position, token) {
        const findings = latestFindings.get(document.uri.toString());
        if (!findings) {
          return null;
        }

        for (const finding of findings) {
          const range = new vscode.Range(
            new vscode.Position(finding.line - 1, finding.column - 1),
            new vscode.Position(finding.endLine - 1, finding.endColumn - 1)
          );

          if (range.contains(position) && finding.mdnUrl) {
            const message = new vscode.MarkdownString(finding.message);
            message.appendMarkdown(`\n\n[Read more on MDN](${finding.mdnUrl})`);
            message.isTrusted = true;
            // By providing the range, we give VS Code a more precise instruction
            // on what to replace, which resolves conflicts with other hover providers.
            return new vscode.Hover(message, range);
          }
        }

        return null;
      }
    })
  );

  // A placeholder for our "Apply Fixes" command. We'll implement this later.
  const command = vscode.commands.registerCommand('baseline.applyFixesFromReport', () => {
    vscode.window.showInformationMessage('Apply Fixes from Report command will be implemented in Phase 3.');
  });
  context.subscriptions.push(command);

  // === NEW: Command to fix all issues in the current file ===
  const fixAllCommand = vscode.commands.registerCommand('baseline.fixAllInFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found.');
      return;
    }

    const diagnostics = diagnosticCollection.get(editor.document.uri);
    if (!diagnostics || diagnostics.length === 0) {
      vscode.window.showInformationMessage('No Baseline Sentinel issues found in this file.');
      return;
    }

    const fixableDiagnostics = diagnostics.filter(d => d.code);
    if (fixableDiagnostics.length === 0) {
      vscode.window.showInformationMessage('No auto-fixable issues found in this file.');
      return;
    }

    const edit = new vscode.WorkspaceEdit();
    let fixedCount = 0;

    for (const diagnostic of fixableDiagnostics) {
      const fixId = typeof diagnostic.code === 'object' && diagnostic.code.value ?
        diagnostic.code.value as string :
        diagnostic.code as string;
      
      const remediation = getRemediation(fixId);
      if (remediation && remediation.fixes.length > 0) {
        const fix = remediation.fixes[0];
        applyFixToEdit(editor.document, diagnostic, fix, edit);
        fixedCount++;
      }
    }

    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
      // Immediately re-scan the document to update diagnostics
      await updateDiagnostics(editor.document);
      vscode.window.showInformationMessage(`Fixed ${fixedCount} Baseline Sentinel issue(s).`);
    } else {
      vscode.window.showErrorMessage('Failed to apply fixes.');
    }
  });
  context.subscriptions.push(fixAllCommand);

  // === NEW: Command to set up GitHub Actions ===
  const setupGitHubCommand = vscode.commands.registerCommand('baseline.setupGitHub', async () => {
    await setupGitHubAction();
  });
  context.subscriptions.push(setupGitHubCommand);

  // Prompt user to set up GitHub Actions (once)
  const hideGitHubSetup = vscode.workspace.getConfiguration('baseline-sentinel').get('hideGitHubSetup', false);
  if (!hideGitHubSetup) {
    // Delay prompt by 5 seconds to avoid interrupting startup
    setTimeout(() => {
      promptGitHubActionSetup();
    }, 5000);
  }

  // Start auto-sync if enabled
  await startGitHubAutoSync(context);

  // === NEW: Command to import CI results ===
  const importCICommand = vscode.commands.registerCommand('baseline.importCIResults', async () => {
    await importCIResults();
  });
  context.subscriptions.push(importCICommand);

  // === NEW: Command to show download instructions ===
  const downloadCommand = vscode.commands.registerCommand('baseline.downloadGitHubResults', async () => {
    await showDownloadInstructions();
  });
  context.subscriptions.push(downloadCommand);

  // === NEW: Command to enable auto-sync ===
  const enableSyncCommand = vscode.commands.registerCommand('baseline.enableAutoSync', async () => {
    await enableAutoSync(context);
  });
  context.subscriptions.push(enableSyncCommand);

  // === NEW: Command to fix all from last CI scan ===
  const fixAllFromCICommand = vscode.commands.registerCommand('baseline.fixAllFromCI', async () => {
    await fixAllFromCI();
  });
  context.subscriptions.push(fixAllFromCICommand);

  // === NEW: A command to generate a report and copy it to the clipboard ===
  // === NEW: Command to open Baseline Sentinel Dashboard ===
  const dashboardCommand = vscode.commands.registerCommand('baseline.openDashboard', () => {
    openBaselineSentinelPanel(context);
  });
  context.subscriptions.push(dashboardCommand);

  // === NEW: Command to generate workspace-wide compatibility report ===
  const generateReportCommand = vscode.commands.registerCommand('baseline.generateWorkspaceReport', async () => {
    await generateWorkspaceReport();
  });
  context.subscriptions.push(generateReportCommand);

  const reportCommand = vscode.commands.registerCommand('baseline.sendReportToChat', () => {
    let report = '## Baseline Sentinel Report\n\n';
    let issueCount = 0;

    diagnosticCollection.forEach((uri, diagnostics) => {
      if (diagnostics.length > 0) {
        const filePath = vscode.workspace.asRelativePath(uri);
        report += `### 📄 ${filePath}\n\n`;
        diagnostics.forEach(diag => {
          issueCount++;
          // The diagnostic message is always a string. The HoverProvider handles the MarkdownString.
          report += `*   **L${diag.range.start.line + 1}:** ${diag.message}\n`;
        });
        report += '\n';
      }
    });

    if (issueCount === 0) {
      vscode.window.showInformationMessage('Baseline Sentinel: No issues found.');
      return;
    }

    vscode.env.clipboard.writeText(report);
    vscode.window.showInformationMessage('Baseline Sentinel report copied to clipboard. Paste it into the chat.');
  });
  context.subscriptions.push(reportCommand);
}

/**
 * Analyzes a text document for baseline issues and updates the diagnostics.
 * @param document The document to analyze.
 */
async function updateDiagnostics(document: vscode.TextDocument): Promise<void> {
  const supportedLanguages = ['css', 'javascript', 'typescript', 'typescriptreact', 'html'];
  console.log(`[extension] updateDiagnostics called for ${document.languageId} file: ${document.uri.fsPath}`);
  if (!supportedLanguages.includes(document.languageId)) {
    console.log(`[extension] Language ${document.languageId} not supported, skipping`);
    return;
  }
  console.log(`[extension] Scanning document: ${document.uri.fsPath}`);

  const findings = await scanCode(document.getText(), document.languageId as any); // Allow 'any' here as core handles it
  console.log(`[extension] Found ${findings.length} issues for ${document.languageId} file.`);
  
  // Store findings for the hover provider
  latestFindings.set(document.uri.toString(), findings);

  const diagnostics = findings.map(findingToDiagnostic);
  
  diagnosticCollection.set(document.uri, diagnostics);
}

/**
 * Converts a Finding from our core engine into a VS Code Diagnostic object.
 * @param finding The Finding to convert.
 */
function findingToDiagnostic(finding: Finding): vscode.Diagnostic {
  // Convert from 1-based to 0-based positions
  const startLine = Math.max(0, finding.line - 1);
  const startCol = Math.max(0, finding.column - 1);
  const endLine = Math.max(0, (finding.endLine || finding.line) - 1);
  const endCol = Math.max(0, (finding.endColumn || finding.column + 10) - 1);
  
  const range = new vscode.Range(
    new vscode.Position(startLine, startCol),
    new vscode.Position(endLine, endCol)
  );

  console.log(`[extension] Creating diagnostic for '${finding.featureId}' at line ${finding.line}, col ${finding.column}, range: ${startLine}:${startCol} to ${endLine}:${endCol}`);

  const diagnostic = new vscode.Diagnostic(range, finding.message, vscode.DiagnosticSeverity.Warning);
  diagnostic.code = finding.fixId; // Store the fixId for our Quick Fix provider later.
  diagnostic.source = 'Baseline Sentinel';

  return diagnostic;
}

/**
 * Helper function to apply a fix to a WorkspaceEdit
 */
function applyFixToEdit(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, fix: Fix, edit: vscode.WorkspaceEdit) {
  if (fix.type === 'add-css-declaration') {
    const line = document.lineAt(diagnostic.range.start.line);
    const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
    const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
    const newText = `${indentation}${fix.payload.property}: ${fix.payload.value};${eol}`;
    edit.insert(document.uri, line.range.start, newText);
  } else if (fix.type === 'replace-property') {
    edit.replace(document.uri, diagnostic.range, fix.payload.new);
  } else if (fix.type === 'remove-css-declaration') {
    const line = document.lineAt(diagnostic.range.start.line);
    edit.delete(document.uri, line.rangeIncludingLineBreak);
  } else if (fix.type === 'add-comment-warning') {
    const line = document.lineAt(diagnostic.range.start.line);
    const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
    const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
    const isCss = document.languageId === 'css' || document.fileName.endsWith('.css');
    const comment = isCss ? `/* ${fix.payload?.message || 'Warning'} */` : `// ${fix.payload?.message || 'Warning'}`;
    const newText = `${indentation}${comment}${eol}`;
    edit.insert(document.uri, line.range.start, newText);
  } else if (fix.type === 'recommend-polyfill') {
    const line = document.lineAt(diagnostic.range.start.line);
    const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
    const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
    const isCss = document.languageId === 'css' || document.fileName.endsWith('.css');
    const comment = isCss
      ? `/* ${fix.payload?.message || 'Consider adding a polyfill.'} */`
      : `// ${fix.payload?.message || 'Consider adding a polyfill.'}`;
    const newText = `${indentation}${comment}${eol}`;
    edit.insert(document.uri, line.range.start, newText);
  }
}

/**
 * Auto-send report to LLM chat when a file is saved (for vibe coders)
 */
async function autoSendReportOnSave(document: vscode.TextDocument): Promise<void> {
  const config = vscode.workspace.getConfiguration('baseline-sentinel');
  const autoSendEnabled = config.get('autoSendReportOnSave', false);
  
  if (!autoSendEnabled) {
    return;
  }

  // Get diagnostics for the saved file
  const diagnostics = diagnosticCollection.get(document.uri);
  if (!diagnostics || diagnostics.length === 0) {
    return; // No issues, nothing to report
  }

  // Generate a focused report for this file
  const filePath = vscode.workspace.asRelativePath(document.uri);
  let report = `## 🔍 Baseline Sentinel Report (Auto-Generated on Save)\n\n`;
  report += `**File:** \`${filePath}\`\n\n`;
  report += `**Issues Found:** ${diagnostics.length}\n\n`;
  report += `---\n\n`;

  diagnostics.forEach((diag, index) => {
    report += `### ${index + 1}. Line ${diag.range.start.line + 1}\n`;
    report += `**Issue:** ${diag.message}\n\n`;
    
    // Include the problematic code snippet
    const line = document.lineAt(diag.range.start.line);
    report += `\`\`\`${document.languageId}\n`;
    report += `${line.text.trim()}\n`;
    report += `\`\`\`\n\n`;
  });

  report += `---\n\n`;
  report += `*Generated by Baseline Sentinel - Use Quick Fixes (💡) to auto-fix these issues.*\n`;

  // Try to send to VS Code Chat API (if available)
  const chatSent = await tryToSendToChat(report, filePath);
  
  if (!chatSent) {
    // Fallback: Copy to clipboard and notify
    vscode.env.clipboard.writeText(report);
    const choice = await vscode.window.showInformationMessage(
      `📋 Baseline Sentinel found ${diagnostics.length} issue(s) in ${filePath}. Report copied to clipboard.`,
      'Open in Chat',
      'Dismiss'
    );
    
    if (choice === 'Open in Chat') {
      // Open the chat panel so user can paste
      vscode.commands.executeCommand('workbench.action.chat.open');
    }
  }
}

/**
 * Try to send the report directly to VS Code Chat API
 * Returns true if successful, false if not available
 */
async function tryToSendToChat(report: string, filePath: string): Promise<boolean> {
  try {
    // VS Code Chat API (available in VS Code 1.90+)
    // Check if the chat API is available
    if (vscode.commands.getCommands) {
      const commands = await vscode.commands.getCommands(true);
      
      // Try GitHub Copilot Chat if available
      if (commands.includes('github.copilot.openChat')) {
        await vscode.commands.executeCommand('github.copilot.openChat', {
          message: report,
          title: `Baseline Issues in ${filePath}`
        });
        vscode.window.showInformationMessage(`✅ Report sent to Copilot Chat!`);
        return true;
      }
      
      // Try generic chat interface
      if (commands.includes('workbench.action.chat.open')) {
        await vscode.commands.executeCommand('workbench.action.chat.open');
        vscode.env.clipboard.writeText(report);
        vscode.window.showInformationMessage(`💬 Chat opened. Report is in your clipboard - paste it now!`);
        return true;
      }
    }
  } catch (error) {
    console.error('[Baseline Sentinel] Failed to send to chat:', error);
  }
  
  return false;
}

export function deactivate() {
  diagnosticCollection.clear();
  stopGitHubAutoSync();
}
