// @ts-ignore - compute-baseline type definitions are incomplete
import { getStatus } from 'compute-baseline';
import { features } from 'web-features';

const bcdKeyCache = new Map<string, string>();

/**
 * Finds the correct BCD key for a given JS property name by searching the web-features data.
 * @param propertyName The name of the JS property (e.g., 'keyCode').
 * @returns The found BCD key, or null if not found.
 */
function findBcdKeyForJsProperty(propertyName: string): string | null {
  if (bcdKeyCache.has(propertyName)) {
    return bcdKeyCache.get(propertyName)!;
  }

  for (const feature of Object.values(features)) {
    // @ts-ignore - compat_features property exists at runtime
    for (const bcdKey of feature.compat_features || []) {
      // BCD keys for JS properties often look like 'api.SomeInterface.propertyName'
      if (bcdKey.endsWith(`.${propertyName}`)) {
        bcdKeyCache.set(propertyName, bcdKey);
        return bcdKey;
      }
    }
  }

  bcdKeyCache.set(propertyName, null as any);
  return null;
}

const cssPropertyToFeatureIdCache = new Map<string, string | null>();

function findFeatureIdForCssProperty(propertyName: string): string | null {
  const cached = cssPropertyToFeatureIdCache.get(propertyName);
  if (cached !== undefined) {
    return cached;
  }

  for (const [featureId, feature] of Object.entries(features)) {
    // @ts-ignore - css_features property exists at runtime
    if (feature.css_features && feature.css_features.properties) {
      // @ts-ignore - css_features property exists at runtime
      for (const prop of feature.css_features.properties) {
        if (prop === propertyName) {
          cssPropertyToFeatureIdCache.set(propertyName, featureId);
          return featureId;
        }
      }
    }
  }

  cssPropertyToFeatureIdCache.set(propertyName, null);
  return null;
}


/**
 * Checks if a given web feature (represented by its BCD key) is part of Baseline.
 * This function uses the official `compute-baseline` package.
 * @param bcdKey The MDN Browser Compatibility Data key for the feature (e.g., 'css.properties.backdrop-filter').
 * @returns True if the feature's Baseline status is 'low' or 'high', false otherwise.
 */
export function isFeatureBaseline(bcdKey: string | null): boolean {
  if (!bcdKey) {
    return true; // If we can't find a key, we can't check it. Assume it's fine.
  }
  try {
    // We pass null for the featureId as we are only interested in the BCD key's status,
    // as recommended by the web.dev article for linters.
    const status = getStatus(null as any, bcdKey);
    console.log(`[baseline-engine] Checked: ${bcdKey} -> Raw Status:`, status);

    if (!status || typeof status.baseline === 'undefined') {
      // This happens for features that compute-baseline doesn't know about, which we can ignore.
      return true;
    }
    
    const isBaseline = status.baseline === 'low' || status.baseline === 'high';
    console.log(`[baseline-engine] Is '${bcdKey}' baseline? ${isBaseline}`);
    return isBaseline;

  } catch (e) {
    console.error(`[baseline-engine] CRITICAL ERROR checking BCD key '${bcdKey}':`, e);
    return true; // On error, fail open (don't show a warning).
  }
}

/**
 * A new helper function that finds the BCD key before checking the baseline status.
 * @param propertyName The name of the JS property (e.g., 'keyCode').
 */
export function isJsPropertyBaseline(propertyName: string): boolean {
    const bcdKey = findBcdKeyForJsProperty(propertyName);
    return isFeatureBaseline(bcdKey);
}

export function isCssPropertyBaseline(propertyName: string): [boolean, string | null] {
    const featureId = findFeatureIdForCssProperty(propertyName);
    if (!featureId) {
        // If we can't find a feature, we can't check it. Assume it's fine.
        return [true, null];
    }
    const feature = (features as any)[featureId];
    // A feature might have multiple BCD keys. We check all of them.
    // @ts-ignore - compat_features property exists at runtime
    for (const bcdKey of feature.compat_features || []) {
        if (!isFeatureBaseline(bcdKey)) {
            return [false, featureId];
        }
    }
    return [true, featureId];
}
