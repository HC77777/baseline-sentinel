# ⚡ Quick Start: Enable Auto-Sync in 2 Minutes

## What is This?

**Auto-Sync** = VS Code automatically checks GitHub for CI results every 2 minutes and notifies you! No more manual downloads.

---

## 🚀 Setup (2 Minutes)

### Step 1: Get GitHub Token (90 seconds)

1. **Go to:** https://github.com/settings/tokens
2. **Click:** "Generate new token (classic)"
3. **Name it:** `Baseline Sentinel`
4. **Expiration:** `90 days`
5. **Check these boxes ONLY:**
   - ✅ `repo` (or just `public_repo` if you only have public repos)
   - ✅ `actions` → `read:actions`
6. **Click:** "Generate token" (at bottom)
7. **Copy the token** (starts with `ghp_...`)

⚠️ **Save it somewhere!** You can only see it once.

---

### Step 2: Enable in VS Code (30 seconds)

1. **Press:** `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. **Type:** `Enable Auto-Sync`
3. **Select:** `Baseline Sentinel: Enable Auto-Sync (Polling)`
4. **Paste** your token
5. **Done!** ✅

You'll see: "✅ Auto-sync enabled! VS Code will check for new CI results every 2 minutes."

---

## 🎯 Test It

### 1. Push Some Code:
```bash
cd sample-web-app
echo "// test" >> src/app.js
git add -A
git commit -m "test auto-sync"
git push
```

### 2. Wait for CI:
- Go to GitHub Actions page
- Watch "Baseline Sentinel" workflow run
- Wait for it to complete (~1-2 minutes)

### 3. Get Notification:
Within 2 minutes of CI completing, you'll see:

```
┌─────────────────────────────────────┐
│ 🔔 New CI scan completed!          │
│    Results are ready.               │
│                                     │
│  [Import Results] [View on GitHub] │
└─────────────────────────────────────┘
```

### 4. Import & Fix:
- Click **"Import Results"**
- Select the downloaded `baseline-results.json`
- See all issues in VS Code!
- Click the wand icon to fix all 🪄

---

## ⚙️ How to Disable

### Temporarily:
```
VS Code Settings → Search "Auto Sync"
Uncheck "Auto Sync Enabled"
```

### Permanently:
```
Cmd+Shift+P → "Baseline Sentinel: Enable Auto-Sync"
Delete the token → Save
```

Or revoke the token on GitHub: https://github.com/settings/tokens

---

## 🔒 Is It Safe?

**Yes!** The token:
- ✅ Only **reads** your CI results
- ✅ Cannot modify/delete code
- ✅ Stored securely in VS Code
- ✅ Never shared with anyone
- ✅ You can revoke anytime

**API Usage:**
- 30 requests/hour (checks every 2 minutes)
- GitHub allows 5,000/hour
- 0.6% of your limit

---

## 📖 Need More Details?

- **[GITHUB-TOKEN-GUIDE.md](GITHUB-TOKEN-GUIDE.md)** - Complete token guide
- **[AUTO-SYNC-GUIDE.md](AUTO-SYNC-GUIDE.md)** - Full feature documentation
- **[POLLING-IMPLEMENTATION.md](POLLING-IMPLEMENTATION.md)** - Technical details

---

## ❓ Quick FAQ

**Q: Do I need a paid GitHub account?**  
A: No! Free accounts get 5,000 API calls/hour.

**Q: Will this drain my battery?**  
A: No! A tiny 1KB request every 2 minutes uses negligible resources.

**Q: What if I work on multiple repos?**  
A: Auto-sync works with whatever repo is currently open in VS Code.

**Q: Can I change the 2-minute interval?**  
A: Yes, but not recommended. Edit `src/github-auto-sync.ts` line 39.

---

## 🎉 That's It!

You're now set up for **zero-effort CI monitoring**!

Every time you push code:
1. GitHub runs CI
2. VS Code auto-detects completion
3. You get a notification
4. One click to import & fix

🚀 **Enjoy automated Baseline Sentinel!**

