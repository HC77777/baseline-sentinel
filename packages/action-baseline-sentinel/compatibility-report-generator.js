/**
 * Compatibility Report Generator
 * Generates comprehensive compatibility reports with Web Platform API data and OpenAI insights
 */

const fs = require('fs').promises;
const path = require('path');
const {
  getMultipleFeaturesData,
  calculateCompatibility,
  calculateCodebaseCompatibility
} = require('./web-platform-api');
const {
  generateExecutiveSummary,
  generateRiskAssessment,
  generateMigrationGuide
} = require('./openai-report-generator');

/**
 * Extract unique feature IDs from scan results
 * @param {Object} scanResults - Results from baseline scanner
 * @returns {Set<string>} Unique feature IDs
 */
function extractFeatureIds(scanResults) {
  const featureIds = new Set();
  
  scanResults.fileReports.forEach(fileReport => {
    fileReport.findings.forEach(finding => {
      // Extract base feature ID (e.g., "backdrop-filter" from "css.properties.backdrop-filter")
      const parts = finding.featureId.split('.');
      let baseId = parts[parts.length - 1];
      
      // Convert to Web Platform API format
      // css.properties.backdrop-filter -> backdrop-filter
      // javascript.builtins.Array.at -> array-at
      if (parts[0] === 'javascript' && parts[1] === 'builtins') {
        baseId = `${parts[2]}-${parts[3]}`.toLowerCase();
      }
      
      featureIds.add(baseId);
    });
  });
  
  return featureIds;
}

/**
 * Enrich findings with Web Platform API data
 * @param {Object} scanResults - Results from baseline scanner
 * @returns {Promise<Object>} Enriched scan results with compatibility data
 */
async function enrichWithCompatibilityData(scanResults) {
  console.log('[Compatibility Report] Extracting feature IDs...');
  const featureIds = extractFeatureIds(scanResults);
  
  console.log(`[Compatibility Report] Querying Web Platform API for ${featureIds.size} features...`);
  const featuresData = await getMultipleFeaturesData(Array.from(featureIds));
  
  console.log(`[Compatibility Report] Retrieved data for ${featuresData.size} features`);
  
  // Calculate overall compatibility
  const compatibility = calculateCodebaseCompatibility(featuresData);
  
  // Enrich each finding with compatibility data
  const enrichedFileReports = scanResults.fileReports.map(fileReport => ({
    ...fileReport,
    findings: fileReport.findings.map(finding => {
      const parts = finding.featureId.split('.');
      let baseId = parts[parts.length - 1];
      
      if (parts[0] === 'javascript' && parts[1] === 'builtins') {
        baseId = `${parts[2]}-${parts[3]}`.toLowerCase();
      }
      
      const featureData = featuresData.get(baseId);
      const compat = calculateCompatibility(featureData);
      
      return {
        ...finding,
        compatibility: compat,
        featureData: featureData ? {
          name: featureData.name,
          baseline: featureData.baseline,
          spec_links: featureData.spec?.links || []
        } : null
      };
    })
  }));
  
  return {
    ...scanResults,
    fileReports: enrichedFileReports,
    compatibility,
    breakdown: compatibility.breakdown,
    featuresData: Array.from(featuresData.values())
  };
}

/**
 * Group findings by feature and priority
 * @param {Object} enrichedResults - Enriched scan results
 * @returns {Array} Grouped findings
 */
function groupFindingsByFeature(enrichedResults) {
  const featureMap = new Map();
  
  enrichedResults.fileReports.forEach(fileReport => {
    fileReport.findings.forEach(finding => {
      const key = finding.featureId;
      
      if (!featureMap.has(key)) {
        featureMap.set(key, {
          featureId: finding.featureId,
          feature: finding.featureData?.name || finding.featureId,
          status: finding.compatibility.status,
          compatibility: finding.compatibility,
          files: new Set(),
          count: 0,
          autoFixable: !!finding.fixId
        });
      }
      
      const group = featureMap.get(key);
      group.files.add(fileReport.path);
      group.count++;
    });
  });
  
  // Convert to array and sort by priority (limited -> newly -> widely)
  const grouped = Array.from(featureMap.values()).map(item => ({
    ...item,
    files: Array.from(item.files),
    fileCount: item.files.length
  }));
  
  const priority = { limited: 0, newly: 1, widely: 2, unknown: 3 };
  grouped.sort((a, b) => {
    const priorityDiff = priority[a.status] - priority[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    return b.count - a.count; // Then by usage count
  });
  
  return grouped;
}

/**
 * Generate markdown compatibility report
 * @param {Object} enrichedResults - Enriched scan results
 * @param {Object} aiInsights - Generated AI insights (optional)
 * @returns {string} Markdown report
 */
function generateMarkdownReport(enrichedResults, aiInsights = {}) {
  const { compatibility, breakdown, totalIssues, fileReports } = enrichedResults;
  const groupedFindings = groupFindingsByFeature(enrichedResults);
  
  const now = new Date().toISOString().split('T')[0];
  
  let report = `# 🛡️ Baseline Sentinel - Browser Compatibility Report\n\n`;
  report += `**Generated:** ${now}\n`;
  report += `**Total Files Scanned:** ${fileReports.length}\n`;
  report += `**Total Compatibility Issues:** ${totalIssues}\n\n`;
  report += `---\n\n`;
  
  // Executive Summary
  report += `## 🎯 Executive Summary\n\n`;
  if (aiInsights.executiveSummary) {
    report += `${aiInsights.executiveSummary}\n\n`;
  } else {
    report += `Your codebase has **${totalIssues} compatibility issues** across ${fileReports.length} files. `;
    report += `The overall browser compatibility score is **${compatibility.overall}%**. `;
    report += `${breakdown.limited} features have limited browser support and require immediate attention.\n\n`;
  }
  
  // Compatibility Score Card
  report += `## 📊 Browser Compatibility Score\n\n`;
  report += `\`\`\`\n`;
  report += `Overall Compatibility: ${compatibility.overall}%\n`;
  report += `├─ Chrome:   ${'█'.repeat(Math.floor(compatibility.chrome / 5))}${'░'.repeat(20 - Math.floor(compatibility.chrome / 5))} ${compatibility.chrome}%\n`;
  report += `├─ Firefox:  ${'█'.repeat(Math.floor(compatibility.firefox / 5))}${'░'.repeat(20 - Math.floor(compatibility.firefox / 5))} ${compatibility.firefox}%\n`;
  report += `├─ Safari:   ${'█'.repeat(Math.floor(compatibility.safari / 5))}${'░'.repeat(20 - Math.floor(compatibility.safari / 5))} ${compatibility.safari}%\n`;
  report += `└─ Edge:     ${'█'.repeat(Math.floor(compatibility.edge / 5))}${'░'.repeat(20 - Math.floor(compatibility.edge / 5))} ${compatibility.edge}%\n`;
  report += `\`\`\`\n\n`;
  
  // Baseline Status Breakdown
  report += `## 📈 Baseline Status Distribution\n\n`;
  report += `| Status | Count | Percentage | Recommendation |\n`;
  report += `|--------|-------|------------|----------------|\n`;
  report += `| ✅ Widely Available | ${breakdown.widely} | ${Math.round(breakdown.widely / totalIssues * 100)}% | Safe to use |\n`;
  report += `| ⚠️ Newly Available | ${breakdown.newly} | ${Math.round(breakdown.newly / totalIssues * 100)}% | Use with fallbacks |\n`;
  report += `| ❌ Limited Support | ${breakdown.limited} | ${Math.round(breakdown.limited / totalIssues * 100)}% | Requires polyfills |\n`;
  report += `| ❔ Unknown | ${breakdown.unknown} | ${Math.round(breakdown.unknown / totalIssues * 100)}% | Manual review needed |\n\n`;
  
  // Risk Assessment
  report += `## ⚠️ Risk Assessment\n\n`;
  if (aiInsights.riskAssessment) {
    report += `${aiInsights.riskAssessment}\n\n`;
  } else {
    const riskLevel = compatibility.overall < 70 ? 'HIGH' : compatibility.overall < 85 ? 'MEDIUM' : 'LOW';
    report += `**Overall Risk Level:** ${riskLevel}\n\n`;
    report += `- **Browser Impact:** ${compatibility.safari < 80 ? 'Safari users may experience degraded functionality' : 'Good cross-browser support'}\n`;
    report += `- **Technical Debt:** ${breakdown.limited} features require polyfills or refactoring\n`;
    report += `- **Recommended Timeline:** ${breakdown.limited > 5 ? 'Address within 1-2 weeks' : 'Address within 1 month'}\n\n`;
  }
  
  // Top Issues by Priority
  report += `## 🔴 Critical Compatibility Issues\n\n`;
  const criticalIssues = groupedFindings.filter(f => f.status === 'limited').slice(0, 10);
  if (criticalIssues.length > 0) {
    criticalIssues.forEach((issue, index) => {
      report += `### ${index + 1}. \`${issue.feature}\` (${issue.status})\n\n`;
      report += `**Browser Compatibility:** Overall ${issue.compatibility.overall}%\n`;
      report += `- Chrome: ${issue.compatibility.chrome}% | Firefox: ${issue.compatibility.firefox}% | Safari: ${issue.compatibility.safari}% | Edge: ${issue.compatibility.edge}%\n\n`;
      report += `**Usage:** Found in ${issue.fileCount} file(s), ${issue.count} occurrence(s)\n\n`;
      report += `**Files:**\n`;
      issue.files.slice(0, 5).forEach(file => {
        report += `- \`${file}\`\n`;
      });
      if (issue.files.length > 5) {
        report += `- ... and ${issue.files.length - 5} more\n`;
      }
      report += `\n**Action:** ${issue.autoFixable ? '✅ Auto-fixable with Quick Fix' : '⚠️ Manual fix required'}\n\n`;
      report += `---\n\n`;
    });
  } else {
    report += `🎉 No critical compatibility issues found!\n\n`;
  }
  
  // Baseline Newly Features
  report += `## ⚠️ Baseline Newly Available Features\n\n`;
  const newlyFeatures = groupedFindings.filter(f => f.status === 'newly').slice(0, 10);
  if (newlyFeatures.length > 0) {
    report += `These features are available in modern browsers but should have fallbacks:\n\n`;
    report += `| Feature | Compatibility | Files | Auto-Fix |\n`;
    report += `|---------|---------------|-------|----------|\n`;
    newlyFeatures.forEach(issue => {
      report += `| \`${issue.feature}\` | ${issue.compatibility.overall}% | ${issue.fileCount} | ${issue.autoFixable ? '✅' : '❌'} |\n`;
    });
    report += `\n`;
  }
  
  // Migration Guide
  report += `## 🚀 Migration Guide\n\n`;
  if (aiInsights.migrationGuide) {
    report += `${aiInsights.migrationGuide}\n\n`;
  } else {
    report += `### Priority 1: Address Limited Support Features\n\n`;
    criticalIssues.slice(0, 3).forEach(issue => {
      report += `- Replace or add polyfill for \`${issue.feature}\` in ${issue.fileCount} file(s)\n`;
    });
    report += `\n### Priority 2: Add Fallbacks for Newly Available Features\n\n`;
    newlyFeatures.slice(0, 3).forEach(issue => {
      report += `- Add fallback for \`${issue.feature}\` in ${issue.fileCount} file(s)\n`;
    });
    report += `\n### Priority 3: Test in Target Browsers\n\n`;
    report += `- Test in Safari (${compatibility.safari}% compatibility)\n`;
    report += `- Test in Firefox (${compatibility.firefox}% compatibility)\n`;
    report += `- Verify fallbacks work correctly\n\n`;
  }
  
  // Full Feature List
  report += `## 📋 Complete Feature List\n\n`;
  report += `<details>\n<summary>Click to expand all ${groupedFindings.length} features</summary>\n\n`;
  report += `| Feature | Status | Compatibility | Files | Occurrences |\n`;
  report += `|---------|--------|---------------|-------|-------------|\n`;
  groupedFindings.forEach(issue => {
    const statusIcon = issue.status === 'widely' ? '✅' : issue.status === 'newly' ? '⚠️' : '❌';
    report += `| ${statusIcon} \`${issue.feature}\` | ${issue.status} | ${issue.compatibility.overall}% | ${issue.fileCount} | ${issue.count} |\n`;
  });
  report += `\n</details>\n\n`;
  
  // Footer
  report += `---\n\n`;
  report += `*Generated by Baseline Sentinel | [View Documentation](https://github.com/HC77777/baseline-sentinel)*\n`;
  report += `*Powered by [Web Platform Dashboard API](https://web.dev/articles/web-platform-dashboard-baseline)*\n`;
  
  return report;
}

/**
 * Generate complete compatibility report
 * @param {Object} scanResults - Raw scan results
 * @param {string} [openaiApiKey] - OpenAI API key (optional)
 * @returns {Promise<{markdown: string, json: Object}>}
 */
async function generateCompatibilityReport(scanResults, openaiApiKey = null) {
  console.log('[Compatibility Report] Starting report generation...');
  
  // Enrich with Web Platform API data
  const enrichedResults = await enrichWithCompatibilityData(scanResults);
  
  console.log(`[Compatibility Report] Compatibility score: ${enrichedResults.compatibility.overall}%`);
  
  // Generate AI insights if API key provided
  let aiInsights = {};
  if (openaiApiKey) {
    console.log('[Compatibility Report] Generating AI insights...');
    try {
      const groupedFindings = groupFindingsByFeature(enrichedResults);
      const scanData = {
        totalIssues: enrichedResults.totalIssues,
        compatibility: enrichedResults.compatibility,
        breakdown: enrichedResults.breakdown,
        criticalFeatures: groupedFindings.filter(f => f.status === 'limited').map(f => f.feature)
      };
      
      aiInsights.executiveSummary = await generateExecutiveSummary(scanData, openaiApiKey);
      aiInsights.riskAssessment = await generateRiskAssessment(scanData, openaiApiKey);
      aiInsights.migrationGuide = await generateMigrationGuide(groupedFindings, openaiApiKey);
      
      console.log('[Compatibility Report] AI insights generated successfully');
    } catch (error) {
      console.error('[Compatibility Report] AI insights generation failed:', error.message);
    }
  }
  
  // Generate markdown report
  const markdown = generateMarkdownReport(enrichedResults, aiInsights);
  
  // Prepare JSON export
  const json = {
    generated: new Date().toISOString(),
    summary: {
      totalIssues: enrichedResults.totalIssues,
      totalFiles: enrichedResults.fileReports.length,
      compatibility: enrichedResults.compatibility,
      breakdown: enrichedResults.breakdown
    },
    groupedFindings: groupFindingsByFeature(enrichedResults),
    fileReports: enrichedResults.fileReports,
    aiInsights
  };
  
  return { markdown, json };
}

/**
 * Save report to files
 * @param {string} markdown - Markdown report
 * @param {Object} json - JSON report data
 * @param {string} outputDir - Output directory
 */
async function saveReports(markdown, json, outputDir = '.') {
  const markdownPath = path.join(outputDir, 'baseline-compatibility-report.md');
  const jsonPath = path.join(outputDir, 'baseline-compatibility-data.json');
  
  await fs.writeFile(markdownPath, markdown, 'utf8');
  await fs.writeFile(jsonPath, JSON.stringify(json, null, 2), 'utf8');
  
  console.log(`[Compatibility Report] Saved to ${markdownPath}`);
  console.log(`[Compatibility Report] Saved to ${jsonPath}`);
  
  return { markdownPath, jsonPath };
}

module.exports = {
  enrichWithCompatibilityData,
  groupFindingsByFeature,
  generateMarkdownReport,
  generateCompatibilityReport,
  saveReports
};

