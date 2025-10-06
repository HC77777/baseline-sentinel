/**
 * Web Platform Dashboard API Client
 * Query browser compatibility data from https://api.webstatus.dev
 * Based on: https://web.dev/articles/web-platform-dashboard-baseline
 */

const https = require('https');

const API_BASE = 'api.webstatus.dev';
const API_PATH = '/v1/features';

/**
 * Query the Web Platform Dashboard API
 * @param {string} query - Search query (e.g., "id:grid" or "baseline_status:newly")
 * @param {string} [pageToken] - Pagination token for next page
 * @returns {Promise<{data: Array, metadata: Object}>}
 */
async function queryWebPlatformAPI(query, pageToken = null) {
  return new Promise((resolve, reject) => {
    let path = `${API_PATH}?q=${encodeURIComponent(query)}`;
    if (pageToken) {
      path += `&page_token=${encodeURIComponent(pageToken)}`;
    }

    const options = {
      hostname: API_BASE,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Baseline-Sentinel/1.0',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request failed: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('API request timed out'));
    });

    req.end();
  });
}

/**
 * Get feature data by ID with retry logic
 * @param {string} featureId - Feature identifier (e.g., "grid", "backdrop-filter")
 * @returns {Promise<Object|null>} Feature data or null if not found
 */
async function getFeatureData(featureId) {
  try {
    const { data } = await queryWebPlatformAPI(`id:${featureId}`);
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error(`[Web Platform API] Error fetching ${featureId}:`, error.message);
    return null;
  }
}

/**
 * Get enriched data for multiple features
 * @param {Array<string>} featureIds - Array of feature IDs
 * @returns {Promise<Map<string, Object>>} Map of featureId -> feature data
 */
async function getMultipleFeaturesData(featureIds) {
  const results = new Map();
  
  // Batch queries to avoid rate limiting (5 features per query using OR)
  const batchSize = 5;
  for (let i = 0; i < featureIds.length; i += batchSize) {
    const batch = featureIds.slice(i, i + batchSize);
    const query = batch.map(id => `id:${id}`).join(' OR ');
    
    try {
      const { data } = await queryWebPlatformAPI(query);
      if (data) {
        data.forEach(feature => {
          results.set(feature.feature_id, feature);
        });
      }
      
      // Rate limiting: wait 200ms between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[Web Platform API] Batch query failed:`, error.message);
    }
  }
  
  return results;
}

/**
 * Calculate browser compatibility percentage for a feature
 * @param {Object} featureData - Feature data from API
 * @returns {Object} Compatibility scores by browser
 */
function calculateCompatibility(featureData) {
  if (!featureData || !featureData.baseline) {
    return {
      overall: 0,
      chrome: 0,
      firefox: 0,
      safari: 0,
      edge: 0,
      status: 'unknown'
    };
  }

  const { baseline } = featureData;
  const status = baseline.status;

  // Baseline Widely = 100% (30+ months in all browsers)
  if (status === 'widely') {
    return {
      overall: 100,
      chrome: 100,
      firefox: 100,
      safari: 100,
      edge: 100,
      status: 'widely'
    };
  }

  // Baseline Newly = Available in latest versions (85% average)
  if (status === 'newly') {
    return {
      overall: 85,
      chrome: 100,
      firefox: 90,
      safari: 80,
      edge: 100,
      status: 'newly'
    };
  }

  // Limited = Poor support (30% average)
  return {
    overall: 30,
    chrome: 50,
    firefox: 30,
    safari: 20,
    edge: 50,
    status: 'limited'
  };
}

/**
 * Calculate overall codebase compatibility score
 * @param {Map<string, Object>} featuresData - Map of feature data
 * @returns {Object} Aggregated compatibility scores
 */
function calculateCodebaseCompatibility(featuresData) {
  if (featuresData.size === 0) {
    return {
      overall: 100,
      chrome: 100,
      firefox: 100,
      safari: 100,
      edge: 100,
      breakdown: {
        widely: 0,
        newly: 0,
        limited: 0,
        unknown: 0
      }
    };
  }

  let totalOverall = 0;
  let totalChrome = 0;
  let totalFirefox = 0;
  let totalSafari = 0;
  let totalEdge = 0;
  
  const breakdown = {
    widely: 0,
    newly: 0,
    limited: 0,
    unknown: 0
  };

  featuresData.forEach((data) => {
    const compat = calculateCompatibility(data);
    totalOverall += compat.overall;
    totalChrome += compat.chrome;
    totalFirefox += compat.firefox;
    totalSafari += compat.safari;
    totalEdge += compat.edge;
    breakdown[compat.status]++;
  });

  const count = featuresData.size;

  return {
    overall: Math.round(totalOverall / count),
    chrome: Math.round(totalChrome / count),
    firefox: Math.round(totalFirefox / count),
    safari: Math.round(totalSafari / count),
    edge: Math.round(totalEdge / count),
    breakdown
  };
}

module.exports = {
  queryWebPlatformAPI,
  getFeatureData,
  getMultipleFeaturesData,
  calculateCompatibility,
  calculateCodebaseCompatibility
};

