export type FeatureType = 'css-property' | 'js-property';
export type FixType = 'add-css-declaration' | 'replace-property' | 'remove-css-declaration' | 'add-comment-warning' | 'recommend-polyfill' | 'replace-css-declaration' | 'TODO';
/**
 * A Fix represents a single, concrete action to be taken to remediate a Finding.
 */
export interface Fix {
    type: FixType;
    description: string;
    payload: any;
}
/**
 * A Remediation is a collection of one or more Fixes for a given web feature.
 */
export interface Remediation {
    featureId: string;
    fixes: Fix[];
}
/**
 * A Finding represents a single issue found in the source code.
 * It includes a reference to the fix that can resolve it.
 */
export interface Finding {
    featureId: string;
    type: FeatureType;
    message: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    fixId: string;
    mdnUrl?: string;
}
/**
 * The main scanning function. It delegates to the appropriate language-specific scanner.
 */
export declare function scanCode(content: string, language: 'css' | 'javascript' | 'typescript' | 'typescriptreact' | 'html'): Promise<Finding[]>;
/**
 * Scans a string of CSS content using PostCSS to find non-baseline features.
 */
export declare function scanCss(cssContent: string): Promise<Finding[]>;
/**
 * Scans a string of JavaScript content using Babel to find deprecated APIs.
 */
export declare function scanJs(jsContent: string): Promise<Finding[]>;
/**
 * Scans HTML content for non-Baseline features
 * Checks: HTML elements, attributes, inline styles, and inline scripts
 */
export declare function scanHtml(htmlContent: string): Promise<Finding[]>;
/**
 * A helper function to get a remediation from the database.
 */
export declare function getRemediation(fixId: string): Remediation | undefined;
