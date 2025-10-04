/**
 * Sets up GitHub Actions for Baseline Sentinel
 */
export declare function setupGitHubAction(): Promise<void>;
/**
 * Checks if GitHub Action is set up
 */
export declare function isGitHubActionSetup(): boolean;
/**
 * Shows a notification to set up GitHub Actions if not already done
 */
export declare function promptGitHubActionSetup(): Promise<void>;
