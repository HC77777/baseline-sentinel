/**
 * Checks if a given web feature (represented by its BCD key) is part of Baseline.
 * This function uses the official `compute-baseline` package.
 * @param bcdKey The MDN Browser Compatibility Data key for the feature (e.g., 'css.properties.backdrop-filter').
 * @returns True if the feature's Baseline status is 'low' or 'high', false otherwise.
 */
export declare function isFeatureBaseline(bcdKey: string | null): boolean;
/**
 * A new helper function that finds the BCD key before checking the baseline status.
 * @param propertyName The name of the JS property (e.g., 'keyCode').
 */
export declare function isJsPropertyBaseline(propertyName: string): boolean;
export declare function isCssPropertyBaseline(propertyName: string): [boolean, string | null];
