/**
 * Workspace-wide Report Generator
 * Scans entire workspace and generates compatibility report
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { scanCode, Finding } from 'baseline-fixer-core';

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
 * Find all supported files in workspace
 */
function findSupportedFiles(rootPath: string): string[] {
  const results: string[] = [];
  const extensions = ['.css', '.js', '.ts', '.tsx', '.jsx', '.html'];
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out'];

  function walk(dir: string) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          if (!excludeDirs.includes(item.name)) {
            walk(fullPath);
          }
        } else if (item.isFile()) {
          const ext = path.extname(item.name);
          if (extensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  walk(rootPath);
  return results;
}

/**
 * Get language from file extension
 */
function getLanguageFromPath(filePath: string): 'css' | 'javascript' | 'typescript' | 'typescriptreact' | 'html' | null {
  const ext = path.extname(filePath);
  if (ext === '.css') return 'css';
  if (ext === '.html') return 'html';
  if (ext === '.ts' || ext === '.tsx') return ext === '.tsx' ? 'typescriptreact' : 'typescript';
  if (ext === '.js' || ext === '.jsx') return 'javascript';
  return null;
}

/**
 * Scan entire workspace
 */
export async function scanWorkspace(): Promise<ScanResults> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error('No workspace folder open');
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const files = findSupportedFiles(rootPath);

  const results: ScanResults = {
    totalIssues: 0,
    fileReports: [],
    totalFiles: files.length
  };

  // Show progress
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Baseline Sentinel: Scanning workspace...',
    cancellable: false
  }, async (progress) => {
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const language = getLanguageFromPath(filePath);
      
      if (!language) continue;

      progress.report({
        message: `${i + 1}/${files.length} files`,
        increment: (1 / files.length) * 100
      });

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const findings = await scanCode(content, language);

        if (findings.length > 0) {
          const relativePath = path.relative(rootPath, filePath);
          results.fileReports.push({ path: relativePath, findings });
          results.totalIssues += findings.length;
        }
      } catch (error) {
        console.error(`[Workspace Report] Error scanning ${filePath}:`, error);
      }
    }

    return results;
  });
}

/**
 * Call OpenAI API to enhance report
 */
async function enhanceReportWithOpenAI(baseReport: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create the payload object first
    const payload = {
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert technical writer who creates beautiful, visual, and easy-to-understand documentation. You excel at using emojis, diagrams, box drawings, and visual elements to make complex technical information accessible and engaging.'
        },
        {
          role: 'user',
          content: `Transform this browser compatibility report into a beautiful, professional, and highly visual document that anyone can understand.

ORIGINAL REPORT:
${baseReport}

ENHANCEMENT REQUIREMENTS:

1. **VISUAL DESIGN** - Make it colorful and engaging:
   • Use emojis strategically (✅ ❌ ⚠️ 🎯 💡 🔴 🟡 🟢 ⭐ 📊 🚀 🔧 💻 🌐 📱 🎨)
   • Add visual separators with box-drawing characters (─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ═ ║ ╔ ╗ ╚ ╝)
   • Create ASCII diagrams where helpful
   • Use progress bars and visual indicators

2. **EXECUTIVE SUMMARY** (2-3 sentences at top):
   • Quick overview of compatibility status
   • Highlight most critical issue
   • Recommended immediate action

3. **VISUAL HIERARCHY**:
   • Clear sections with emoji headers
   • Use callout boxes with ┌─────┐ style borders
   • Color-code severity (🔴 Critical, 🟡 Moderate, 🟢 Low)
   • Add visual flow diagrams for recommendations

4. **COMPATIBILITY VISUALIZATION**:
   • Enhance the browser bars with emojis (🌐 Chrome, 🦊 Firefox, 🧭 Safari, 🌀 Edge)
   • Add visual indicators for each score
   • Create a visual "health meter" for overall compatibility

5. **ISSUE PRESENTATION**:
   • Group issues with visual containers
   • Use tree diagrams (├──, └──) to show relationships
   • Add "Impact Meter" with visual bars
   • Include quick fix indicators (⚡ auto-fixable, 🔧 manual fix)

6. **RECOMMENDATIONS SECTION**:
   • Create a visual action plan with numbered steps in boxes
   • Use ✓ checkboxes for action items
   • Add priority indicators (🔥 Urgent, ⏰ Soon, 📅 Later)
   • Include estimated time with ⏱️

7. **DATA PRESERVATION**:
   • Keep ALL numbers, percentages, file names EXACTLY as they are
   • Maintain all table data
   • Preserve all technical terms

8. **USER EXPERIENCE**:
   • Write in clear, friendly language
   • Explain technical terms in parentheses
   • Add helpful hints with 💡
   • Include motivational elements

OUTPUT: A beautifully formatted markdown report that's both professional and visually stunning.`
        }
      ],
      temperature: 0.8,
      max_tokens: 4000
    };

    // Stringify the payload
    let data: string;
    try {
      data = JSON.stringify(payload);
      console.log('[OpenAI] Payload size:', data.length, 'bytes');
    } catch (error: any) {
      reject(new Error(`Failed to stringify payload: ${error.message}`));
      return;
    }

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    console.log('[OpenAI] Sending request to OpenAI API...');

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('[OpenAI] Response status:', res.statusCode);
        
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(responseData);
            const enhancedReport = json.choices[0].message.content;
            console.log('[OpenAI] Successfully enhanced report');
            resolve(enhancedReport);
          } catch (error: any) {
            console.error('[OpenAI] Failed to parse response:', error);
            reject(new Error(`Failed to parse OpenAI response: ${error.message}`));
          }
        } else {
          console.error('[OpenAI] API error:', res.statusCode, responseData);
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
 * Generate comprehensive compatibility report
 */
export async function generateCompatibilityReport(scanResults: ScanResults, openaiApiKey?: string): Promise<{ markdown: string; json: any }> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error('No workspace folder open');
  }

  console.log('[Workspace Report] Generating comprehensive compatibility report...');
  
  // Generate the base report with all data
  const baseReport = generateDetailedMarkdownReport(scanResults);
  
  let finalReport = baseReport;
  
  // If OpenAI key provided, enhance the report
  if (openaiApiKey) {
    try {
      console.log('[Workspace Report] Enhancing report with OpenAI...');
      finalReport = await enhanceReportWithOpenAI(baseReport, openaiApiKey);
      console.log('[Workspace Report] Report enhanced successfully!');
    } catch (error: any) {
      console.error('[Workspace Report] OpenAI enhancement failed:', error.message);
      console.log('[Workspace Report] Using base report without AI enhancement');
      // Keep base report if OpenAI fails
    }
  }
  
  const json = {
    scanResults,
    enhanced: !!openaiApiKey,
    generatedAt: new Date().toISOString()
  };
  
  return { markdown: finalReport, json };
}

/**
 * Calculate estimated browser compatibility scores
 */
function calculateCompatibilityScores(results: ScanResults): {
  overall: number;
  chrome: number;
  firefox: number;
  safari: number;
  edge: number;
} {
  if (results.totalIssues === 0) {
    return { overall: 100, chrome: 100, firefox: 100, safari: 100, edge: 100 };
  }

  // Simple estimation: each issue reduces compatibility
  // This is a rough estimate; in CI with Web Platform API, we get real data
  const baseScore = 100;
  const penalty = Math.min(results.totalIssues * 2, 40); // Max 40% penalty
  
  return {
    overall: Math.max(baseScore - penalty, 50),
    chrome: Math.max(baseScore - penalty + 10, 60),
    firefox: Math.max(baseScore - penalty - 5, 50),
    safari: Math.max(baseScore - penalty - 10, 45),
    edge: Math.max(baseScore - penalty + 10, 60)
  };
}

/**
 * Generate detailed markdown report with all findings
 * This is the base report that OpenAI will enhance
 */
function generateDetailedMarkdownReport(results: ScanResults): string {
  const now = new Date().toISOString().split('T')[0];
  const compat = calculateCompatibilityScores(results);
  
  let report = `# 🛡️ Baseline Sentinel - Browser Compatibility Report\n\n`;
  report += `**Generated:** ${now}\n`;
  report += `**Total Files Scanned:** ${results.totalFiles}\n`;
  report += `**Total Compatibility Issues:** ${results.totalIssues}\n\n`;
  report += `---\n\n`;

  if (results.totalIssues === 0) {
    report += `## ✅ Excellent! No Compatibility Issues Found\n\n`;
    report += `Your codebase uses only Baseline-compatible web features. This means your code will work reliably across all modern browsers without polyfills or fallbacks.\n\n`;
    
    // Show perfect scores
    report += `## 📊 Browser Compatibility Score\n\n`;
    report += `\`\`\`\n`;
    report += `Overall Compatibility: 100%\n`;
    report += `├─ Chrome:   ${'█'.repeat(20)} 100%\n`;
    report += `├─ Firefox:  ${'█'.repeat(20)} 100%\n`;
    report += `├─ Safari:   ${'█'.repeat(20)} 100%\n`;
    report += `└─ Edge:     ${'█'.repeat(20)} 100%\n`;
    report += `\`\`\`\n\n`;
    
    report += `**What this means:**\n`;
    report += `- ✅ Works in Chrome, Firefox, Safari, and Edge\n`;
    report += `- ✅ No browser-specific hacks needed\n`;
    report += `- ✅ Future-proof and standards-compliant\n`;
    report += `- ✅ Optimal user experience across all platforms\n\n`;
    return report;
  }

  // Browser Compatibility Score Card
  report += `## 📊 Browser Compatibility Score\n\n`;
  report += `\`\`\`\n`;
  report += `Overall Compatibility: ${compat.overall}%\n`;
  report += `├─ Chrome:   ${'█'.repeat(Math.floor(compat.chrome / 5))}${'░'.repeat(20 - Math.floor(compat.chrome / 5))} ${compat.chrome}%\n`;
  report += `├─ Firefox:  ${'█'.repeat(Math.floor(compat.firefox / 5))}${'░'.repeat(20 - Math.floor(compat.firefox / 5))} ${compat.firefox}%\n`;
  report += `├─ Safari:   ${'█'.repeat(Math.floor(compat.safari / 5))}${'░'.repeat(20 - Math.floor(compat.safari / 5))} ${compat.safari}%\n`;
  report += `└─ Edge:     ${'█'.repeat(Math.floor(compat.edge / 5))}${'░'.repeat(20 - Math.floor(compat.edge / 5))} ${compat.edge}%\n`;
  report += `\`\`\`\n\n`;
  
  report += `*Note: Scores are estimates. For precise browser compatibility data, run scans via GitHub Actions with Web Platform API integration.*\n\n`;

  // Summary section
  report += `## 📊 Summary\n\n`;
  report += `This report identifies **${results.totalIssues} non-Baseline features** across **${results.fileReports.length} files** in your codebase. Non-Baseline features may not work consistently across all browsers and may require polyfills, fallbacks, or alternative implementations.\n\n`;
  
  // Group findings by feature for better overview
  const featureMap = new Map<string, { files: Set<string>; count: number; message: string }>();
  
  results.fileReports.forEach(fileReport => {
    fileReport.findings.forEach(finding => {
      const key = finding.featureId;
      if (!featureMap.has(key)) {
        featureMap.set(key, {
          files: new Set(),
          count: 0,
          message: finding.message
        });
      }
      const data = featureMap.get(key)!;
      data.files.add(fileReport.path);
      data.count++;
    });
  });

  // Most problematic features
  const sortedFeatures = Array.from(featureMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  report += `### Top Compatibility Issues\n\n`;
  report += `| Feature | Files Affected | Total Occurrences | Impact |\n`;
  report += `|---------|----------------|-------------------|--------|\n`;
  
  sortedFeatures.forEach(([featureId, data]) => {
    const impact = data.files.size > 3 ? '🔴 High' : data.files.size > 1 ? '🟡 Medium' : '🟢 Low';
    report += `| \`${featureId}\` | ${data.files.size} | ${data.count} | ${impact} |\n`;
  });
  report += `\n`;

  // Files Overview (not detailed)
  report += `## 📋 Files Overview\n\n`;
  
  // Sort files by number of issues (most problematic first)
  const sortedFileReports = [...results.fileReports].sort((a, b) => b.findings.length - a.findings.length);

  report += `| File | Issues | Severity |\n`;
  report += `|------|--------|----------|\n`;
  
  for (const fileReport of sortedFileReports) {
    const severity = fileReport.findings.length > 10 ? '🔴 Critical' : fileReport.findings.length > 5 ? '🟡 Moderate' : '🟢 Low';
    report += `| \`${fileReport.path}\` | ${fileReport.findings.length} | ${severity} |\n`;
  }
  report += `\n`;

  // Recommendations section
  report += `## 💡 Recommendations\n\n`;
  
  report += `### ⚡ Immediate Actions (This Week)\n\n`;
  report += `1. **Review high-impact features** - Focus on issues affecting 3+ files\n`;
  report += `2. **Apply Quick Fixes** - Use VS Code's lightbulb menu for auto-fixes\n`;
  report += `3. **Add browser fallbacks** - Ensure critical features have backups\n`;
  report += `4. **Test in browsers** - Verify in Chrome, Firefox, Safari, and Edge\n\n`;
  
  report += `### 🔧 Long-term Improvements (This Month)\n\n`;
  report += `1. **Feature detection** - Use \`@supports\` (CSS) and \`if ('feature' in object)\` (JS)\n`;
  report += `2. **Polyfill strategy** - Add polyfills for frequently-used features\n`;
  report += `3. **Set baseline target** - Example: "Only Baseline Newly Available or better"\n`;
  report += `4. **Automated scanning** - Weekly GitHub Actions scans to catch issues early\n\n`;
  
  report += `### 🎯 Success Metrics\n\n`;
  report += `- **Target:** 85%+ overall compatibility\n`;
  report += `- **Safari focus:** Improve Safari score (typically lowest)\n`;
  report += `- **Issue reduction:** Aim to fix 50% of issues in first sprint\n`;

  report += `---\n\n`;
  report += `*Generated by Baseline Sentinel | For more details, visit the [Web Platform Dashboard](https://web.dev/baseline)*\n`;

  return report;
}

/**
 * Save report to workspace
 */
export async function saveReportToWorkspace(markdown: string, json: any): Promise<string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error('No workspace folder open');
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const reportPath = path.join(rootPath, 'baseline-sentinel-report.md');
  const jsonPath = path.join(rootPath, 'baseline-sentinel-report.json');

  fs.writeFileSync(reportPath, markdown, 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf-8');

  return reportPath;
}

/**
 * Generate and display workspace report
 */
export async function generateWorkspaceReport() {
  try {
    // Scan workspace
    const results = await scanWorkspace();

    if (results.totalIssues === 0) {
      vscode.window.showInformationMessage(
        `✅ Workspace scan complete! No compatibility issues found in ${results.totalFiles} files.`,
        { modal: true }
      );
      return;
    }

    // Get OpenAI settings
    const config = vscode.workspace.getConfiguration('baseline-sentinel');
    const openaiApiKey = config.get<string>('openaiApiKey');
    const useOpenAI = config.get<boolean>('useOpenAIReports', true);
    
    // Determine if we should use OpenAI
    const shouldUseOpenAI = useOpenAI && !!openaiApiKey;
    
    console.log('[Workspace Report] OpenAI API Key configured:', !!openaiApiKey);
    console.log('[Workspace Report] Use OpenAI Reports setting:', useOpenAI);
    console.log('[Workspace Report] Will use OpenAI:', shouldUseOpenAI);
    
    if (shouldUseOpenAI) {
      console.log('[Workspace Report] OpenAI key length:', openaiApiKey?.length);
      console.log('[Workspace Report] Will enhance report with AI');
    } else if (!useOpenAI) {
      console.log('[Workspace Report] OpenAI enhancement disabled by user setting');
    } else if (!openaiApiKey) {
      console.log('[Workspace Report] No OpenAI API key configured');
    }

    // Generate report
    const { markdown, json } = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: shouldUseOpenAI ? 'Generating AI-enhanced report...' : 'Generating standard report...',
      cancellable: false
    }, async () => {
      return await generateCompatibilityReport(results, shouldUseOpenAI ? openaiApiKey : undefined);
    });

    // Save report
    const reportPath = await saveReportToWorkspace(markdown, json);

    // Show success message
    const action = await vscode.window.showInformationMessage(
      `✅ Report generated! Found ${results.totalIssues} issues in ${results.fileReports.length} files.`,
      { modal: true },
      'Open Report',
      'Copy to Clipboard'
    );

    if (action === 'Open Report') {
      const doc = await vscode.workspace.openTextDocument(reportPath);
      await vscode.window.showTextDocument(doc, { preview: false });
    } else if (action === 'Copy to Clipboard') {
      await vscode.env.clipboard.writeText(markdown);
      vscode.window.showInformationMessage('Report copied to clipboard!');
    }

  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to generate report: ${error.message}`,
      { modal: true }
    );
  }
}

