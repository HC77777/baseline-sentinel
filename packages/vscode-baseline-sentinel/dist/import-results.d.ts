/**
 * Imports CI scan results - automatically downloads from GitHub
 */
export declare function importCIResults(): Promise<void>;
/**
 * Shows instructions for downloading CI results
 */
export declare function showDownloadInstructions(): Promise<void>;
/**
 * Fixes all issues from the last imported CI scan
 * Called by the cloud icon button in the editor title bar
 */
export declare function fixAllFromCI(): Promise<void>;
