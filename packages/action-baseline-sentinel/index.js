#!/usr/bin/env node

/**
 * Baseline Sentinel CLI - GitHub Action Entry Point
 * Scans a codebase for non-Baseline web features and reports findings.
 */

const fs = require('fs');
const path = require('path');
const { scanCode } = require('baseline-fixer-core');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

/**
 * Recursively finds all supported files in a directory
 */
function findFiles(dir, extensions = ['.css', '.js', '.ts', '.tsx', '.jsx']) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    // Skip node_modules, .git, dist, build, etc.
    if (item.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out'].includes(item.name)) {
        continue;
      }
      results.push(...findFiles(fullPath, extensions));
    } else if (item.isFile()) {
      const ext = path.extname(item.name);
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Determines the language based on file extension
 */
function getLanguageFromPath(filePath) {
  const ext = path.extname(filePath);
  if (ext === '.css') return 'css';
  if (ext === '.ts' || ext === '.tsx') return 'typescript';
  if (ext === '.js' || ext === '.jsx') return 'javascript';
  return null;
}

/**
 * Scans all files in the target directory or a single file
 */
async function scanDirectory(targetPath) {
  console.log(`${colors.cyan}${colors.bold}Baseline Sentinel - CI Scanner${colors.reset}`);
  console.log(`${colors.cyan}Scanning: ${targetPath}${colors.reset}\n`);

  const stat = fs.statSync(targetPath);
  let files = [];
  
  if (stat.isFile()) {
    // Single file mode
    files = [targetPath];
    targetPath = path.dirname(targetPath);
  } else {
    // Directory mode
    files = findFiles(targetPath);
  }
  
  console.log(`Found ${files.length} file(s) to scan.\n`);

  let totalIssues = 0;
  const fileReports = [];
  let scannedCount = 0;

  for (const filePath of files) {
    const language = getLanguageFromPath(filePath);
    if (!language) continue;

    try {
      scannedCount++;
      if (files.length > 10 && scannedCount % 10 === 0) {
        process.stdout.write(`\rScanning... ${scannedCount}/${files.length}`);
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const findings = await scanCode(content, language);

      if (findings.length > 0) {
        totalIssues += findings.length;
        const relativePath = path.relative(targetPath, filePath);
        fileReports.push({ path: relativePath, findings });
      }
    } catch (error) {
      console.error(`\n${colors.red}Error scanning ${filePath}: ${error.message}${colors.reset}`);
    }
  }

  if (files.length > 10) {
    process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear progress line
  }

  return { totalIssues, fileReports, totalFiles: files.length };
}

/**
 * Formats the scan results for console output
 */
function formatConsoleReport(results) {
  const { totalIssues, fileReports, totalFiles } = results;

  console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (totalIssues === 0) {
    console.log(`${colors.green}${colors.bold}✓ No Baseline issues found!${colors.reset}`);
    console.log(`Scanned ${totalFiles} files.\n`);
    return 0;
  }

  console.log(`${colors.red}${colors.bold}✗ Found ${totalIssues} Baseline issue(s) in ${fileReports.length} file(s)${colors.reset}\n`);

  for (const { path, findings } of fileReports) {
    console.log(`${colors.bold}📄 ${path}${colors.reset}`);
    for (const finding of findings) {
      console.log(`  ${colors.yellow}Line ${finding.line}:${finding.column}${colors.reset} - ${finding.message}`);
    }
    console.log('');
  }

  return 1; // Exit code 1 for CI failure
}

/**
 * Generates a GitHub Actions annotation format
 */
function generateGitHubAnnotations(results, workspaceDir) {
  const { fileReports } = results;

  for (const { path: filePath, findings } of fileReports) {
    for (const finding of findings) {
      // GitHub Actions annotation format
      console.log(
        `::warning file=${filePath},line=${finding.line},col=${finding.column}::${finding.message}`
      );
    }
  }
}

/**
 * Generates a JSON report for programmatic use
 */
function generateJsonReport(results) {
  return JSON.stringify(results, null, 2);
}

/**
 * Saves results to a file for CI artifacts
 */
function saveResultsToFile(results, filename = 'baseline-results.json') {
  try {
    fs.writeFileSync(filename, generateJsonReport(results), 'utf-8');
    console.log(`${colors.cyan}Results saved to ${filename}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Failed to save results: ${error.message}${colors.reset}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || process.cwd();
  const format = args[1] || 'console'; // console, json, or github

  if (!fs.existsSync(targetDir)) {
    console.error(`${colors.red}Error: Directory not found: ${targetDir}${colors.reset}`);
    process.exit(1);
  }

  const results = await scanDirectory(targetDir);

  // Always save results to file for CI artifacts
  saveResultsToFile(results);

  if (format === 'json') {
    console.log(generateJsonReport(results));
    process.exit(results.totalIssues > 0 ? 1 : 0);
  } else if (format === 'github') {
    generateGitHubAnnotations(results, targetDir);
    const exitCode = formatConsoleReport(results);
    process.exit(exitCode);
  } else {
    const exitCode = formatConsoleReport(results);
    process.exit(exitCode);
  }
}

main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
