import * as vscode from 'vscode';
/**
 * Starts auto-sync (polling GitHub for new CI results)
 */
export declare function startGitHubAutoSync(context: vscode.ExtensionContext): Promise<void>;
/**
 * Stops auto-sync
 */
export declare function stopGitHubAutoSync(): void;
/**
 * Enables auto-sync feature
 */
export declare function enableAutoSync(context: vscode.ExtensionContext): Promise<void>;
