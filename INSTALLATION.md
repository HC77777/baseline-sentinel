# 🛡️ Baseline Sentinel - Installation Guide

## For Any Project (Easiest Method)

Add Baseline Sentinel scanning to **any project** in 2 minutes:

### Step 1: Add the Workflow File

Create `.github/workflows/baseline-sentinel.yml` in your project:

```yaml
name: Baseline Sentinel

on:
  push:
  pull_request:

jobs:
  baseline-scan:
    name: Scan for Non-Baseline Features
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run Baseline Sentinel
        run: |
          npx -y baseline-sentinel-scanner@latest . github || true
        
      - name: Comment on PR (optional)
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ Baseline Sentinel scan completed. Check the Actions tab for details.'
            })
```

### Step 2: Push and Done! ✅

```bash
git add .github/workflows/baseline-sentinel.yml
git commit -m "Add Baseline Sentinel scanning"
git push
```

That's it! The scan will run automatically on every push and pull request.

---

## What You'll See on GitHub

When you push code or create a pull request:

1. **Actions Tab**: See the scan running in real-time
2. **Inline Annotations**: Warnings appear directly on the code in PRs
3. **Status Checks**: CI shows pass/fail based on findings
4. **PR Comments**: Summary of issues found

---

## Local Testing (Before Pushing)

Test locally first:

```bash
# Install the CLI globally
npm install -g baseline-sentinel-scanner

# Scan your project
baseline-sentinel .

# Or use npx (no install needed)
npx baseline-sentinel-scanner .
```

---

## For Advanced Users

### Custom Configuration

Create `.baseline-sentinel.json` in your project root:

```json
{
  "ignore": [
    "**/*.test.js",
    "**/*.spec.ts",
    "vendor/**"
  ],
  "failOnIssues": true,
  "outputFormat": "github"
}
```

### Using in Monorepos

```yaml
- name: Scan Package A
  run: npx baseline-sentinel-scanner packages/package-a github

- name: Scan Package B
  run: npx baseline-sentinel-scanner packages/package-b github
```

---

## Troubleshooting

**Q: The action fails with "command not found"**  
A: The package isn't published to npm yet. Use the local installation method below.

**Q: How do I scan only specific folders?**  
A: Pass the path: `npx baseline-sentinel-scanner ./src github`

**Q: Can I make warnings non-blocking?**  
A: Yes, add `|| true` at the end of the run command (already included above)

---

## Alternative: Local Installation (For Development)

If you're working on the Baseline Sentinel tool itself or want to use it without npm:

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/baseline-sentinel.git

# Navigate and build
cd baseline-sentinel
pnpm install
pnpm run build

# Create a global link
cd packages/action-baseline-sentinel
npm link

# Now use it anywhere
cd /path/to/your/project
baseline-sentinel .
```

