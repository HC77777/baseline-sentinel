/**
 * OpenAI-Powered Report Generator
 * Generates high-quality compatibility reports using GPT
 */

const https = require('https');

/**
 * Call OpenAI API
 * @param {string} prompt - The prompt to send to GPT
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Generated text
 */
async function callOpenAI(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a web development expert specializing in browser compatibility and web standards. Generate detailed, actionable reports about browser compatibility issues.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(responseData);
            const text = json.choices[0].message.content;
            resolve(text);
          } catch (error) {
            reject(new Error(`Failed to parse OpenAI response: ${error.message}`));
          }
        } else {
          reject(new Error(`OpenAI API error (${res.statusCode}): ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`OpenAI API request failed: ${error.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('OpenAI API request timed out'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Generate executive summary using OpenAI
 * @param {Object} scanData - Scan results with compatibility data
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Executive summary
 */
async function generateExecutiveSummary(scanData, apiKey) {
  const { totalIssues, compatibility, breakdown } = scanData;
  
  const prompt = `Generate a concise executive summary (3-4 sentences) for a web compatibility report with these findings:

- Total compatibility issues: ${totalIssues}
- Overall browser compatibility: ${compatibility.overall}%
- Chrome: ${compatibility.chrome}%, Firefox: ${compatibility.firefox}%, Safari: ${compatibility.safari}%, Edge: ${compatibility.edge}%
- Baseline Widely features: ${breakdown.widely}, Newly: ${breakdown.newly}, Limited: ${breakdown.limited}

Focus on the most critical compatibility risks and recommended priorities.`;

  try {
    return await callOpenAI(prompt, apiKey);
  } catch (error) {
    console.error('[OpenAI] Executive summary generation failed:', error.message);
    return `Your codebase has ${totalIssues} compatibility issues with an overall browser compatibility score of ${compatibility.overall}%. Safari support (${compatibility.safari}%) appears to be the weakest area requiring attention.`;
  }
}

/**
 * Generate risk assessment using OpenAI
 * @param {Object} scanData - Scan results with compatibility data
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Risk assessment
 */
async function generateRiskAssessment(scanData, apiKey) {
  const { compatibility, breakdown, criticalFeatures } = scanData;
  
  const prompt = `Provide a risk assessment for a web project with these compatibility metrics:

Browser Compatibility:
- Overall: ${compatibility.overall}%
- Chrome: ${compatibility.chrome}%, Firefox: ${compatibility.firefox}%, Safari: ${compatibility.safari}%, Edge: ${compatibility.edge}%

Feature Distribution:
- Baseline Widely (safe): ${breakdown.widely}
- Baseline Newly (caution): ${breakdown.newly}
- Limited support (risky): ${breakdown.limited}

Most critical features: ${criticalFeatures.slice(0, 5).join(', ')}

Assess:
1. Browser compatibility impact (LOW/MEDIUM/HIGH)
2. User experience risk
3. Recommended priority actions

Keep it concise (3-4 paragraphs).`;

  try {
    return await callOpenAI(prompt, apiKey);
  } catch (error) {
    console.error('[OpenAI] Risk assessment generation failed:', error.message);
    return generateFallbackRiskAssessment(scanData);
  }
}

/**
 * Generate fallback risk assessment (no AI)
 */
function generateFallbackRiskAssessment(scanData) {
  const { compatibility, breakdown } = scanData;
  
  let riskLevel = 'LOW';
  if (compatibility.overall < 70) riskLevel = 'HIGH';
  else if (compatibility.overall < 85) riskLevel = 'MEDIUM';
  
  return `**Browser Compatibility Impact:** ${riskLevel}

With an overall compatibility score of ${compatibility.overall}%, ${riskLevel === 'HIGH' ? 'significant browser compatibility issues exist that could impact a substantial portion of your users' : riskLevel === 'MEDIUM' ? 'moderate compatibility issues exist that should be addressed' : 'your codebase has good browser support'}.

Safari compatibility (${compatibility.safari}%) is ${compatibility.safari < 80 ? 'a concern' : 'acceptable'}, and you have ${breakdown.limited} features with limited browser support that require polyfills or fallbacks.

**Recommended Actions:**
1. ${breakdown.limited > 0 ? `Address ${breakdown.limited} limited-support features immediately` : 'Continue monitoring Baseline Newly features'}
2. ${compatibility.safari < 80 ? 'Add Safari-specific fallbacks for critical features' : 'Test thoroughly in Safari and Firefox'}
3. Implement feature detection and progressive enhancement`;
}

/**
 * Generate migration guide using OpenAI
 * @param {Array} topIssues - Top compatibility issues
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Migration guide
 */
async function generateMigrationGuide(topIssues, apiKey) {
  const issuesList = topIssues.slice(0, 8).map((issue, i) => 
    `${i + 1}. ${issue.feature} (${issue.status}) - used in ${issue.fileCount} files`
  ).join('\n');
  
  const prompt = `Create a prioritized migration guide for these browser compatibility issues:

${issuesList}

Organize into:
1. Quick Wins (< 30 min) - Simple fixes
2. Medium Effort (1-2 hours) - Moderate complexity
3. Complex Changes (2-4 hours) - Significant refactoring

For each category, provide 2-3 specific actionable steps. Keep it practical and concise.`;

  try {
    return await callOpenAI(prompt, apiKey);
  } catch (error) {
    console.error('[OpenAI] Migration guide generation failed:', error.message);
    return generateFallbackMigrationGuide(topIssues);
  }
}

/**
 * Generate fallback migration guide (no AI)
 */
function generateFallbackMigrationGuide(topIssues) {
  const quickWins = topIssues.filter(i => i.autoFixable).slice(0, 3);
  const mediumEffort = topIssues.filter(i => !i.autoFixable && i.status === 'newly').slice(0, 3);
  const complexChanges = topIssues.filter(i => i.status === 'limited').slice(0, 3);
  
  let guide = '### Quick Wins (< 30 minutes)\n\n';
  quickWins.forEach(issue => {
    guide += `- Fix \`${issue.feature}\` using Quick Fixes in ${issue.fileCount} file(s)\n`;
  });
  
  guide += '\n### Medium Effort (1-2 hours)\n\n';
  mediumEffort.forEach(issue => {
    guide += `- Add fallback for \`${issue.feature}\` (Baseline Newly) in ${issue.fileCount} file(s)\n`;
  });
  
  guide += '\n### Complex Changes (2-4 hours)\n\n';
  complexChanges.forEach(issue => {
    guide += `- Implement polyfill or alternative for \`${issue.feature}\` (limited support) in ${issue.fileCount} file(s)\n`;
  });
  
  return guide;
}

module.exports = {
  callOpenAI,
  generateExecutiveSummary,
  generateRiskAssessment,
  generateMigrationGuide
};

