/**
 * Workspace-wide Report Generator
 * Scans entire workspace and generates compatibility report
 */
import { Finding } from 'baseline-fixer-core';
interface FileReport {
    path: string;
    findings: Finding[];
}
interface ScanResults {
    totalIssues: number;
    fileReports: FileReport[];
    totalFiles: number;
}
/**
 * Scan entire workspace
 */
export declare function scanWorkspace(): Promise<ScanResults>;
/**
 * Generate comprehensive compatibility report
 */
export declare function generateCompatibilityReport(scanResults: ScanResults, openaiApiKey?: string): Promise<{
    markdown: string;
    json: any;
}>;
/**
 * Save report to workspace
 */
export declare function saveReportToWorkspace(markdown: string, json: any): Promise<string>;
/**
 * Generate and display workspace report
 */
export declare function generateWorkspaceReport(): Promise<void>;
export {};
