# Baseline Sentinel - GitHub Action & CLI

A GitHub Action and CLI tool that scans your codebase for non-Baseline web features and reports compatibility issues.

## What is Baseline?

[Baseline](https://web.dev/baseline/) is a set of web platform features that are safe to use across all major browsers. This tool helps you identify features that may not work for all your users.

## Usage

### As a CLI Tool

```bash
# Scan current directory
npx action-baseline-sentinel

# Scan specific directory
npx action-baseline-sentinel ./src

# Output as JSON
npx action-baseline-sentinel ./src json

# Output with GitHub Actions annotations
npx action-baseline-sentinel ./src github
```

### As a GitHub Action

Add this workflow to `.github/workflows/baseline-check.yml`:

```yaml
name: Baseline Sentinel Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  baseline-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm run build
      
      - name: Run Baseline Sentinel
        run: |
          cd packages/action-baseline-sentinel
          node index.js ../../ github
        continue-on-error: true
```

## Features

- ✅ Scans CSS, JavaScript, and TypeScript files
- ✅ Detects non-Baseline features automatically
- ✅ Provides line-by-line reports
- ✅ Integrates with GitHub Actions
- ✅ Supports multiple output formats (console, JSON, GitHub annotations)
- ✅ Respects `.gitignore` patterns (skips `node_modules`, `dist`, etc.)

## Example Output

```
Baseline Sentinel - CI Scanner
Scanning: /workspace/my-project

Found 42 files to scan.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ Found 5 Baseline issue(s) in 2 file(s)

📄 src/styles.css
  Line 12:3 - The CSS property 'backdrop-filter' is not part of Baseline.
  Line 24:3 - The ':has()' selector is not part of Baseline.

📄 src/app.ts
  Line 45:7 - 'Array.prototype.at()' is not Baseline.
  Line 67:10 - 'Promise.allSettled()' is not Baseline.
  Line 89:15 - The Clipboard API ('navigator.clipboard') is not Baseline.
```

## Exit Codes

- `0`: No issues found
- `1`: Issues found (fails CI by default)

## Configuration

The tool automatically scans:
- CSS files (`.css`)
- JavaScript files (`.js`, `.jsx`)
- TypeScript files (`.ts`, `.tsx`)

It automatically skips:
- `node_modules/`
- `.git/`
- `dist/`, `build/`, `out/`
- `coverage/`
- `.next/`

## License

MIT

