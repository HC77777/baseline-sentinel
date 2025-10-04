# 🛡️ Baseline Sentinel - User Guide

**Automatically detect non-Baseline web features in your projects**

Baseline Sentinel helps you write web code that works for everyone by detecting features that aren't yet supported across all major browsers.

---

## 🚀 Quick Start (3 Steps)

### Step 1: Push Baseline Sentinel to GitHub

```bash
cd baseline-sentinel
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/baseline-sentinel.git
git push -u origin main
```

### Step 2: Add to Your Project

In **any other project**, create `.github/workflows/baseline-check.yml`:

```yaml
name: Baseline Sentinel

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: YOUR_USERNAME/baseline-sentinel@main
```

Replace `YOUR_USERNAME` with your GitHub username.

### Step 3: Push and See Results!

```bash
git add .github/workflows/baseline-check.yml
git commit -m "Add Baseline Sentinel"
git push
```

Go to the **Actions** tab on GitHub to see the scan results!

---

## 📊 What You Get

### In VS Code (Local Development)
- ✅ Real-time warnings as you type
- ✅ Quick fixes with one click
- ✅ "Fix All" button to fix an entire file
- ✅ Rich hover tooltips with MDN links
- ✅ Support for CSS, JavaScript, and TypeScript

### In GitHub (CI/CD)
- ✅ Automatic scanning on every push
- ✅ Inline annotations on pull requests
- ✅ Beautiful console output
- ✅ Detailed reports
- ✅ Configurable to pass/fail builds

---

## 💻 Local Testing

Test before pushing:

```bash
# Scan a directory
node packages/action-baseline-sentinel/index.js /path/to/project

# Scan a single file
node packages/action-baseline-sentinel/index.js /path/to/file.js

# Different output formats
node packages/action-baseline-sentinel/index.js . console  # Pretty colors
node packages/action-baseline-sentinel/index.js . json     # JSON output
node packages/action-baseline-sentinel/index.js . github   # GitHub format
```

---

## 🎨 VS Code Extension

### Install
1. Press `F5` in the `baseline-sentinel` project
2. A new VS Code window opens with the extension loaded

### Use
- Open any `.css`, `.js`, `.ts`, or `.tsx` file
- Warnings appear automatically as you type
- Click the 💡 lightbulb for quick fixes
- Click the 🪄 wand icon (top-right) to fix all issues

---

## ⚙️ Configuration

### For GitHub Actions

```yaml
- uses: YOUR_USERNAME/baseline-sentinel@main
  with:
    path: './src'              # Scan only src folder
    fail-on-issues: 'true'     # Fail build if issues found
    format: 'github'           # Output format
```

### For Local Scans

The CLI automatically skips:
- `node_modules/`
- `.git/`
- `dist/`, `build/`, `out/`
- `coverage/`, `.next/`

---

## 📖 Examples

### Example 1: React Project

```yaml
name: Baseline Check
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: YOUR_USERNAME/baseline-sentinel@main
        with:
          path: './src'
```

### Example 2: Monorepo

```yaml
jobs:
  scan-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: YOUR_USERNAME/baseline-sentinel@main
        with:
          path: './packages/frontend'
  
  scan-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: YOUR_USERNAME/baseline-sentinel@main
        with:
          path: './packages/backend'
```

### Example 3: Fail on Issues

```yaml
- uses: YOUR_USERNAME/baseline-sentinel@main
  with:
    fail-on-issues: 'true'  # CI will fail if issues found
```

---

## 🐛 What Gets Detected

### CSS
- Non-Baseline properties (`backdrop-filter`, `text-wrap`, etc.)
- Modern selectors (`:has()`, `:is()`, etc.)
- New at-rules (`@container`, `@layer`, etc.)
- Color functions (`oklch()`, `color-mix()`, etc.)

### JavaScript/TypeScript
- Modern APIs (`Array.at()`, `Object.hasOwn()`, etc.)
- Promise methods (`Promise.allSettled()`, etc.)
- Browser APIs (`navigator.clipboard`, `ResizeObserver`, etc.)
- Deprecated features (`event.keyCode`, etc.)

---

## 🎯 Workflow

1. **Write code** in VS Code → See warnings in real-time
2. **Apply fixes** with Quick Fix or "Fix All" button
3. **Push to GitHub** → Automatic scan runs
4. **Review PR** → See inline annotations
5. **Merge confident** that your code works everywhere!

---

## 🤝 Contributing

Found a feature that should be detected? Open an issue or PR!

## 📄 License

MIT

---

**Questions?** Check `QUICK-START.md` for more details!

