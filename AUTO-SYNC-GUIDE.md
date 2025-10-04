# 🔄 Auto-Sync Feature Guide

## What is Auto-Sync?

**Auto-Sync** (polling) automatically checks your GitHub repository for new CI scan results **every 2 minutes**. When a new scan completes, you get an instant notification in VS Code!

---

## ✨ Benefits

### Without Auto-Sync (Manual):
1. Push code to GitHub
2. Wait for CI to finish
3. Go to GitHub Actions page
4. Find the workflow
5. Download artifact
6. Import into VS Code

⏱️ **Total time:** 3-5 minutes of manual work

### With Auto-Sync (Automatic):
1. Push code to GitHub
2. ✅ **That's it!** VS Code notifies you automatically

⏱️ **Total time:** 0 seconds of manual work

---

## 🚀 Quick Setup (2 Minutes)

### Step 1: Get a GitHub Token

Follow the complete guide: **[GITHUB-TOKEN-GUIDE.md](GITHUB-TOKEN-GUIDE.md)**

**TL;DR:**
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Check: `repo` + `read:actions`
4. Copy token (starts with `ghp_`)

### Step 2: Enable Auto-Sync in VS Code

1. Press `Cmd+Shift+P`
2. Type: `Baseline Sentinel: Enable Auto-Sync (Polling)`
3. Paste your token
4. Done! ✅

---

## 🔔 How It Works

### Automatic Polling:
```
Every 2 minutes:
  ├─ Check GitHub for new workflow runs
  ├─ Look for "Baseline Sentinel" workflows
  ├─ Check if any completed since last check
  └─ If yes → Notify you!
```

### What You'll See:

When a new scan completes:
```
┌────────────────────────────────────────┐
│ 🔔 New CI scan completed! Results     │
│    are ready.                          │
│                                        │
│  [Import Results] [View on GitHub]    │
└────────────────────────────────────────┘
```

Click **"Import Results"** → Downloads and imports the JSON automatically!

---

## 🔐 Security & Privacy

### What the Extension Does:
- ✅ Checks your repo every 2 minutes
- ✅ Only reads CI workflow status
- ✅ Token stored securely in VS Code settings
- ✅ Never shares token with anyone

### What It CANNOT Do:
- ❌ Cannot modify your code
- ❌ Cannot push commits
- ❌ Cannot delete anything
- ❌ Cannot access other repos

### Token Permissions (Minimal):
- `repo` or `public_repo` → Read your repository
- `read:actions` → Read CI workflow results

---

## ⚙️ Configuration

### Enable/Disable Auto-Sync:

**Option 1: Command Palette**
```
Cmd+Shift+P → "Enable Auto-Sync"
```

**Option 2: Settings UI**
```
VS Code Settings → Extensions → Baseline Sentinel
Toggle: "Auto Sync Enabled"
```

**Option 3: settings.json**
```json
{
  "baseline-sentinel.autoSyncEnabled": true,
  "baseline-sentinel.githubToken": "ghp_..."
}
```

### Polling Interval:
- Default: **2 minutes**
- Customizable: Edit `github-auto-sync.ts` (line 39)
- Recommended: Keep at 2 minutes (GitHub rate limits: 5,000/hour)

---

## 🛠️ Troubleshooting

### "GitHub token not configured"
**Fix:** Run `Baseline Sentinel: Enable Auto-Sync (Polling)` and enter your token.

### "API rate limit exceeded"
**Cause:** Too many requests to GitHub (unlikely with 2-minute polling).  
**Fix:** Wait 1 hour or generate a new token.

### "No new results found"
**Possible reasons:**
1. CI hasn't run yet (check GitHub Actions page)
2. Workflow name isn't "Baseline Sentinel" (check workflow YAML)
3. Workflow still running (wait for completion)

### "Cannot access repository"
**Fix:** Make sure your token has:
- `repo` scope (for private repos)
- `public_repo` scope (for public repos)
- `read:actions` scope

### Check Logs:
```
View → Output → Select "Baseline Sentinel" from dropdown
```

Look for `[Auto-Sync]` entries.

---

## 📊 API Usage

### What Gets Called:
```
Every 2 minutes:
  GET /repos/:owner/:repo/actions/runs?per_page=5
  (1 request = checks last 5 workflow runs)
```

### Rate Limits:
- **Free GitHub:** 5,000 requests/hour
- **Our usage:** ~30 requests/hour (1 every 2 minutes)
- **Remaining:** 4,970 requests/hour for other tools

**Verdict:** Polling is safe and won't hit rate limits! ✅

---

## 🎯 Comparison: Manual vs Auto-Sync

| Feature | Manual Import | Auto-Sync (Polling) |
|---------|--------------|---------------------|
| **Setup Time** | 0 seconds | 2 minutes (one-time) |
| **Per-Import Effort** | 3-5 minutes | 0 seconds |
| **Notifications** | None | Automatic |
| **GitHub Token** | Not needed | Required |
| **Best For** | One-time use | Daily development |

---

## 🔄 Complete Workflow Example

### Day 1: Setup
1. Get GitHub token (2 minutes)
2. Run `Enable Auto-Sync` command (10 seconds)
3. Done! ✅

### Every Day After:
```
9:00 AM - You: Write code with `backdrop-filter`
9:05 AM - You: Push to GitHub
9:06 AM - GitHub: CI starts scanning
9:08 AM - GitHub: CI finishes, saves results
9:08 AM - VS Code: 🔔 "New CI scan completed!"
9:08 AM - You: Click "Import Results"
9:09 AM - VS Code: Shows all issues, ready to fix
```

**Total manual work:** 0 seconds! 🎉

---

## 🌟 Pro Tips

### 1. Use with Pre-Commit Hooks:
```bash
# .git/hooks/pre-commit
baseline-sentinel scan . console
```
This catches issues **before** pushing.

### 2. Combine with "Fix All":
1. Auto-sync imports results
2. Click wand icon (Fix All)
3. All issues fixed instantly!

### 3. Multiple Repositories:
Auto-sync works with any repo! Just:
1. Open the repo in VS Code
2. Auto-sync detects it automatically
3. Notifications for that repo's CI

---

## 📚 Related Documentation

- **[GITHUB-TOKEN-GUIDE.md](GITHUB-TOKEN-GUIDE.md)** - How to get a GitHub token
- **[CI-RESULTS-GUIDE.md](CI-RESULTS-GUIDE.md)** - Manual import process
- **[AUTOMATIC-GITHUB-SETUP.md](AUTOMATIC-GITHUB-SETUP.md)** - Setting up CI

---

## ❓ FAQ

### Q: Is my token safe?
**A:** Yes! It's stored in VS Code's secure settings, never sent anywhere except GitHub.

### Q: Can I use this without a token?
**A:** No, polling requires a token. Use manual import instead (no token needed).

### Q: Does this drain battery?
**A:** No! Checking GitHub every 2 minutes uses minimal CPU/network (~1KB per check).

### Q: What if I change repos?
**A:** Auto-sync automatically detects the current repo. Just open a different folder!

### Q: Can I poll more frequently?
**A:** Yes, but not recommended. 2 minutes is optimal (fast enough, respects rate limits).

---

## 🎬 Summary

**Auto-Sync = Zero-Effort CI Integration**

1. ✅ One-time 2-minute setup
2. ✅ Automatic notifications
3. ✅ One-click import
4. ✅ Secure & private
5. ✅ Works with any repo

**Get started now:**
```
Cmd+Shift+P → "Baseline Sentinel: Enable Auto-Sync (Polling)"
```

🚀 **Happy coding with Baseline Sentinel!**

