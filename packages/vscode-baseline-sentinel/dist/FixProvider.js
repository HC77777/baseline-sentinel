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
exports.FixProvider = void 0;
const vscode = __importStar(require("vscode"));
const baseline_fixer_core_1 = require("baseline-fixer-core");
/**
 * Provides the "Quick Fix" options for our diagnostics.
 */
class FixProvider {
    static providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];
    provideCodeActions(document, range, context, token) {
        const actions = [];
        // For each diagnostic that has a fixId, create a quick fix
        const diagnosticActions = context.diagnostics
            .filter(diagnostic => diagnostic.code)
            .map(diagnostic => this.createFixAction(document, diagnostic));
        actions.push(...diagnosticActions);
        // If there are multiple fixable diagnostics, add a "Fix All" action
        if (diagnosticActions.length > 1) {
            const fixAllAction = new vscode.CodeAction(`Fix all ${diagnosticActions.length} Baseline Sentinel issues`, vscode.CodeActionKind.QuickFix);
            fixAllAction.edit = new vscode.WorkspaceEdit();
            // Apply all fixes to the workspace edit
            for (const diagnostic of context.diagnostics.filter(d => d.code)) {
                const fixId = typeof diagnostic.code === 'object' && diagnostic.code.value ?
                    diagnostic.code.value :
                    diagnostic.code;
                const remediation = (0, baseline_fixer_core_1.getRemediation)(fixId);
                if (remediation && remediation.fixes.length > 0) {
                    this.applyFix(document, diagnostic, remediation.fixes[0], fixAllAction.edit);
                }
            }
            actions.unshift(fixAllAction); // Add "Fix All" at the beginning
        }
        return actions;
    }
    createFixAction(document, diagnostic) {
        // Check if diagnostic.code is the rich object or a simple string
        const fixId = typeof diagnostic.code === 'object' && diagnostic.code.value ?
            diagnostic.code.value :
            diagnostic.code;
        console.log(`[FixProvider] Attempting to find a fix for fixId: '${fixId}'`);
        const remediation = (0, baseline_fixer_core_1.getRemediation)(fixId);
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
    applyFix(document, diagnostic, fix, edit) {
        if (fix.type === 'add-css-declaration') {
            const line = document.lineAt(diagnostic.range.start.line);
            // ROBUST METHOD: Use the line's actual whitespace to get the indentation.
            const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
            const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
            const newText = `${indentation}${fix.payload.property}: ${fix.payload.value};${eol}`;
            // Insert the new line just before the line with the issue.
            edit.insert(document.uri, line.range.start, newText);
        }
        else if (fix.type === 'replace-property') {
            // For a replacement, we use the diagnostic's range directly.
            edit.replace(document.uri, diagnostic.range, fix.payload.new);
        }
        else if (fix.type === 'remove-css-declaration') {
            // For a removal, we delete the entire line containing the diagnostic.
            const line = document.lineAt(diagnostic.range.start.line);
            edit.delete(document.uri, line.rangeIncludingLineBreak);
        }
        else if (fix.type === 'add-comment-warning') {
            const line = document.lineAt(diagnostic.range.start.line);
            const indentation = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
            const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
            const isCss = document.languageId === 'css' || document.fileName.endsWith('.css');
            const comment = isCss ? `/* ${fix.payload?.message || 'Warning'} */` : `// ${fix.payload?.message || 'Warning'}`;
            const newText = `${indentation}${comment}${eol}`;
            edit.insert(document.uri, line.range.start, newText);
        }
        else if (fix.type === 'recommend-polyfill') {
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
}
exports.FixProvider = FixProvider;
