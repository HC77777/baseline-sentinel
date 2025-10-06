# 🚀 Quick Start: Phase 4 Compatibility Reports

Get high-quality, AI-powered browser compatibility reports in 3 steps!

---

## Step 1: Update GitHub Workflow (2 minutes)

### Option A: Use VS Code Extension

1. Open your project in VS Code
2. Click the **Dashboard** icon (📊) in the title bar
3. Click **"Set Up GitHub Actions"**
4. Commit and push the generated `.github/workflows/baseline-sentinel.yml`

### Option B: Manual Setup

1. Copy `.github/workflows/baseline-sentinel.yml` from baseline-sentinel repo
2. Paste into your project at `.github/workflows/baseline-sentinel.yml`
3. Commit and push

✅ **Result**: Weekly scans + on-push scans are now active!

---

## Step 2: Add OpenAI API Key (Optional, 5 minutes)

**Why?** Get AI-powered insights, risk assessments, and migration guides in your reports.

**Cost:** ~$0.03 per report (very affordable!)

### Get API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create account or sign in
3. Click **"Create new secret key"**
4. Copy the key (starts with `sk-...`)

### Add to GitHub

1. Go to your repo on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `OPENAI_API_KEY`
5. Value: Paste your API key
6. Click **"Add secret"**

✅ **Result**: Future reports will include AI-generated insights!

**Note:** Reports work WITHOUT OpenAI too (just less detailed).

---

## Step 3: Trigger Your First Scan (1 minute)

### Option A: Push Code

```bash
git add .
git commit -m "Add Baseline Sentinel workflow"
git push
```

### Option B: Manual Trigger

1. Go to GitHub → **Actions** tab
2. Click **"Baseline Sentinel"** workflow
3. Click **"Run workflow"**
4. Wait 2-3 minutes

✅ **Result**: Your first compatibility report is being generated!

---

## Step 4: Download & Review Report (2 minutes)

1. Go to GitHub → **Actions** → Click on the latest run
2. Scroll to **Artifacts** section
3. Download **baseline-results.zip**
4. Extract and open **baseline-compatibility-report.md**

### What You'll See

```markdown
# 🛡️ Baseline Sentinel - Browser Compatibility Report

**Overall Compatibility: 73%**

## Browser Scores
- Chrome: 95% ✅
- Firefox: 68% ⚠️
- Safari: 68% ⚠️
- Edge: 95% ✅

## Critical Issues (6 found)
1. backdrop-filter - 30% compatibility
2. text-wrap - 25% compatibility
...

## AI Insights
[Executive summary, risk assessment, migration guide]
```

---

## 🎯 What Happens Automatically

Once set up, Baseline Sentinel:

| Trigger | When | What Happens |
|---------|------|--------------|
| **Push** | Every commit to main | Full scan + compatibility report |
| **Pull Request** | On PR creation | Scan + PR comment with summary |
| **Weekly** | Every Monday 9 AM | Full codebase scan + report |
| **Manual** | When you trigger | On-demand scan |

All reports are saved as **GitHub Artifacts** (90-day retention).

---

## 📊 Understanding Your Compatibility Score

| Score | Meaning | Action |
|-------|---------|--------|
| **90-100%** | ✅ Excellent | Ship it! |
| **70-89%** | ⚠️ Good | Add some fallbacks |
| **50-69%** | 🚨 Moderate | Address before release |
| **< 50%** | ❌ Critical | Major refactoring needed |

---

## 💡 Pro Tips

### 1. **Review Weekly Reports**

Check your Monday reports to track:
- Compatibility trends over time
- Impact of new features on browser support
- Technical debt accumulation

### 2. **Use PR Comments**

The workflow automatically posts a summary on PRs:
- See compatibility impact of changes
- Prevent merging incompatible code
- Review before merge

### 3. **Prioritize Fixes**

Reports include 3 priority levels:
- **Quick Wins** (< 30 min) - Do these first!
- **Medium Effort** (1-2 hours) - Plan for this sprint
- **Complex Changes** (2-4 hours) - Add to backlog

### 4. **Auto-Fix When Possible**

Many issues are auto-fixable:
- Look for ✅ indicators in the report
- Use Quick Fixes in VS Code
- Use the "Fix All" wand button

---

## 🔧 Customization

### Change Weekly Scan Time

Edit `.github/workflows/baseline-sentinel.yml`:

```yaml
schedule:
  - cron: '0 14 * * 3'  # Wednesday 2 PM instead
```

[Cron Helper](https://crontab.guru/)

### Scan on Different Branches

```yaml
on:
  push:
    branches: [ main, develop, staging ]
```

### Skip AI Generation (Faster, Free)

Simply don't add `OPENAI_API_KEY` - reports will still be generated without AI insights.

---

## 🐛 Troubleshooting

### "No artifacts found"

**Cause:** Scan found 0 issues (good!)  
**Fix:** Intentionally add a non-Baseline feature to test

### "OpenAI API error"

**Cause:** Invalid/expired API key or rate limit  
**Fix:** Check key in GitHub Secrets, verify OpenAI account billing

### "Report not generated"

**Cause:** Build failed or API timeout  
**Fix:** Check GitHub Actions logs, retry workflow

### "Compatibility score seems wrong"

**Cause:** API data may be cached or missing  
**Fix:** Reports show best-effort estimates based on Baseline status

---

## 📚 Learn More

- **Full Documentation**: [`PHASE-4-COMPATIBILITY-REPORTS.md`](./PHASE-4-COMPATIBILITY-REPORTS.md)
- **Web Platform API**: [Official Guide](https://web.dev/articles/web-platform-dashboard-baseline)
- **Baseline Explained**: [web.dev/baseline](https://web.dev/baseline)

---

## ✨ Next: Phase 4.5 (Coming Soon)

- View reports directly in VS Code Dashboard
- Download button in extension
- Trend charts showing compatibility over time
- Automatic issue creation for critical problems

---

**Ready to improve your browser compatibility?** Push your code and check your first report! 🚀

