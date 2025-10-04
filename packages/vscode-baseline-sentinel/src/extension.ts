import * as vscode from 'vscode';
import { scanCode, Finding, getRemediation, Fix } from 'baseline-fixer-core';
import { FixProvider } from './FixProvider';
import { setupGitHubAction, promptGitHubActionSetup } from './github-setup';
import { importCIResults, showDownloadInstructions } from './import-results';
import { startGitHubAutoSync, stopGitHubAutoSync, enableAutoSync } from './github-auto-sync';

let diagnosticCollection: vscode.DiagnosticCollection;
// Store the latest findings for the hover provider
let latestFindings: Map<string, Finding[]> = new Map();
// A debounce timer for on-the-fly diagnostics
let debounceTimer: NodeJS.Timeout;


export async function activate(context: vscode.ExtensionContext) {
  // Create a diagnostic collection to hold our warnings.
  diagnosticCollection = vscode.languages.createDiagnosticCollection('baselineSentinel');
  context.subscriptions.push(diagnosticCollection);

  const supportedLanguages = ['css', 'javascript', 'typescript', 'typescriptreact'];

  // Run the scanner on the active editor when the extension is activated.
  if (vscode.window.activeTextEditor && supportedLanguages.includes(vscode.window.activeTextEditor.document.languageId)) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
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
    vscode.workspace.onDidSaveTextDocument(updateDiagnostics)
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

  // === NEW: A command to generate a report and copy it to the clipboard ===
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
  const supportedLanguages = ['css', 'javascript', 'typescript', 'typescriptreact'];
  if (!supportedLanguages.includes(document.languageId)) {
    return;
  }
  console.log(`[extension] Scanning document: ${document.uri.fsPath}`);

  const findings = await scanCode(document.getText(), document.languageId as any); // Allow 'any' here as core handles it
  console.log(`[extension] Found ${findings.length} issues.`);
  
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
  const range = new vscode.Range(
    new vscode.Position(finding.line - 1, finding.column - 1),
    new vscode.Position(finding.endLine - 1, finding.endColumn - 1)
  );

  console.log(`[extension] Creating diagnostic for '${finding.featureId}' at line ${finding.line}, col ${finding.column}`);

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

export function deactivate() {
  diagnosticCollection.clear();
  stopGitHubAutoSync();
}
