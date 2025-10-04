# 🚀 Baseline Sentinel - Quick Start (Copy-Paste Solution)

## Add to ANY Project in 1 Minute

This workflow will scan your entire project for non-Baseline web features on every push and PR.

### Copy This File to Your Project

Create `.github/workflows/baseline-sentinel.yml`:

```yaml
name: Baseline Sentinel Check

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  baseline-scan:
    name: Scan for Non-Baseline Web Features
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout your project
        uses: actions/checkout@v4
        with:
          path: project

      - name: Checkout Baseline Sentinel
        uses: actions/checkout@v4
        with:
          repository: YOUR_USERNAME/baseline-sentinel
          path: baseline-sentinel

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install and Build Baseline Sentinel
        run: |
          cd baseline-sentinel
          pnpm install
          pnpm run build

      - name: Scan Your Project
        run: |
          cd baseline-sentinel
          node packages/action-baseline-sentinel/index.js ../project github
        continue-on-error: true

      - name: Comment Results Summary
        if: always()
        run: |
          echo "✅ Baseline Sentinel scan completed!"
          echo "Check the logs above for any compatibility issues."
```

### Before Using:

1. Push the `baseline-sentinel` project to your GitHub account
2. Replace `YOUR_USERNAME/baseline-sentinel` in the workflow with your actual username
3. Copy the workflow to your other projects

---

## Even Easier: Single-File Action

If you want it even simpler, I can create a composite action that you can reference like:

```yaml
- uses: YOUR_USERNAME/baseline-sentinel@main
  with:
    path: '.'
```

Let me know and I'll create that!

---

## Test Locally First

Before pushing, test it locally:

```bash
# From the baseline-sentinel directory
node packages/action-baseline-sentinel/index.js /path/to/your/project console

# Example:
cd /Users/haricharanvallem7/OG/baseline-sentinel
node packages/action-baseline-sentinel/index.js ~/my-app console
```

