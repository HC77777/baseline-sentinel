import * as vscode from 'vscode';
import { getRemediation, Fix } from 'baseline-fixer-core';

/**
 * Provides the "Quick Fix" options for our diagnostics.
 */
export class FixProvider implements vscode.CodeActionProvider {

  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
    const actions: vscode.CodeAction[] = [];
    
    // For each diagnostic that has a fixId, create a quick fix
    const diagnosticActions = context.diagnostics
      .filter(diagnostic => diagnostic.code)
      .map(diagnostic => this.createFixAction(document, diagnostic));
    
    actions.push(...diagnosticActions);
    
    // If there are multiple fixable diagnostics, add a "Fix All" action
    // (but not for HTML files - too complex with embedded content)
    if (diagnosticActions.length > 1 && document.languageId !== 'html') {
      const fixAllAction = new vscode.CodeAction(
        `Fix all ${diagnosticActions.length} Baseline Sentinel issues`,
        vscode.CodeActionKind.QuickFix
      );
      fixAllAction.edit = new vscode.WorkspaceEdit();
      
      // Sort diagnostics from bottom to top, then right to left to avoid overlapping ranges
      const sortedDiagnostics = context.diagnostics
        .filter(d => d.code)
        .sort((a, b) => {
          const lineDiff = b.range.start.line - a.range.start.line;
          if (lineDiff !== 0) return lineDiff;
          return b.range.start.character - a.range.start.character;
        });
      
      const processedInsertPositions = new Set<string>();
      
      // Apply all fixes to the workspace edit
      for (const diagnostic of sortedDiagnostics) {
        const fixId = typeof diagnostic.code === 'object' && diagnostic.code.value ?
          diagnostic.code.value as string :
          diagnostic.code as string;
        const remediation = getRemediation(fixId);
        if (!remediation || remediation.fixes.length === 0) {
          continue;
        }
        
        const fix = remediation.fixes[0];
        
        // For insert operations (comments), track the insert position to avoid overlaps
        if (fix.type === 'add-comment-warning' || fix.type === 'recommend-polyfill' || fix.type === 'add-css-declaration') {
          const line = document.lineAt(diagnostic.range.start.line);
          const insertPosKey = `${line.range.start.line}:${line.range.start.character}`;
          if (processedInsertPositions.has(insertPosKey)) {
            continue;
          }
          processedInsertPositions.add(insertPosKey);
        }
        
        this.applyFix(document, diagnostic, fix, fixAllAction.edit);
      }
      
      actions.unshift(fixAllAction); // Add "Fix All" at the beginning
    }
    
    return actions;
  }

  private createFixAction(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    // Check if diagnostic.code is the rich object or a simple string
    const fixId = typeof diagnostic.code === 'object' && diagnostic.code.value ?
      diagnostic.code.value as string :
      diagnostic.code as string;

    console.log(`[FixProvider] Attempting to find a fix for fixId: '${fixId}'`);
    const remediation = getRemediation(fixId);
    
    // This should always find a remediation, but we check just in case.
    if (!remediation || remediation.fixes.length === 0) {
      // This should not happen if the diagnostic was created correctly.
      // We return an empty action as a fallback.
      console.log(`[FixProvider] ...No remediation found.`);
      return new vscode.CodeAction('No fix available.', vscode.CodeActionKind.Empty);
    }

    // For now, we only handle the first fix in the list.
    const fix = remediation.fixes[0];
    console.log(`[FixProvider] ...Found fix: '${fix.description}'`);
    const action = new vscode.CodeAction(fix.description, vscode.CodeActionKind.QuickFix);
    
    action.edit = new vscode.WorkspaceEdit();
    this.applyFix(document, diagnostic, fix, action.edit);
    
    action.isPreferred = true; // Mark this as the primary fix.
    return action;
  }

  private applyFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, fix: Fix, edit: vscode.WorkspaceEdit) {
    if (fix.type === 'add-css-declaration') {
      const line = document.lineAt(diagnostic.range.start.line);
      // ROBUST METHOD: Use the line's actual whitespace to get the indentation.
      const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
      
      const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
      const newText = `${indentation}${fix.payload.property}: ${fix.payload.value};${eol}`;
      
      // Insert the new line just before the line with the issue.
      edit.insert(document.uri, line.range.start, newText);
    } else if (fix.type === 'replace-property') {
      // For a replacement, we use the diagnostic's range directly.
      edit.replace(document.uri, diagnostic.range, fix.payload.new);
    } else if (fix.type === 'remove-css-declaration') {
      // For a removal, we delete the entire line containing the diagnostic.
      const line = document.lineAt(diagnostic.range.start.line);
      edit.delete(document.uri, line.rangeIncludingLineBreak);
    } else if (fix.type === 'add-comment-warning') {
      const line = document.lineAt(diagnostic.range.start.line);
      const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
      const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
      const isHtml = document.languageId === 'html' || document.fileName.endsWith('.html');
      const isCss = document.languageId === 'css' || document.fileName.endsWith('.css');
      let comment: string;
      if (isHtml) {
        comment = `<!-- ${fix.payload?.message || 'Warning'} -->`;
      } else if (isCss) {
        comment = `/* ${fix.payload?.message || 'Warning'} */`;
      } else {
        comment = `// ${fix.payload?.message || 'Warning'}`;
      }
      const newText = `${indentation}${comment}${eol}`;
      edit.insert(document.uri, line.range.start, newText);
    } else if (fix.type === 'recommend-polyfill') {
      const line = document.lineAt(diagnostic.range.start.line);
      const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
      const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
      const isHtml = document.languageId === 'html' || document.fileName.endsWith('.html');
      const isCss = document.languageId === 'css' || document.fileName.endsWith('.css');
      let comment: string;
      if (isHtml) {
        comment = `<!-- ${fix.payload?.message || 'Consider adding a polyfill.'} -->`;
      } else if (isCss) {
        comment = `/* ${fix.payload?.message || 'Consider adding a polyfill.'} */`;
      } else {
        comment = `// ${fix.payload?.message || 'Consider adding a polyfill.'}`;
      }
      const newText = `${indentation}${comment}${eol}`;
      edit.insert(document.uri, line.range.start, newText);
    }
  }
}
