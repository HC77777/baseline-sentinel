# 🔑 How to Get a GitHub Personal Access Token

## Why You Need This

The GitHub token lets VS Code automatically check your CI results. It's like a password that:
- ✅ Only reads your CI results (can't modify code)
- ✅ You control (revoke anytime)
- ✅ Works 24/7 in the background
- ✅ Free (5,000 API calls/hour, we use ~30)

---

## Step-by-Step Guide (2 Minutes)

### Step 1: Go to GitHub Settings

1. Go to https://github.com
2. Click your **profile picture** (top right)
3. Click **Settings**
4. Scroll down to **Developer settings** (bottom of left sidebar)
5. Click **Personal access tokens**
6. Click **Tokens (classic)**

OR use this direct link: https://github.com/settings/tokens

### Step 2: Create New Token

1. Click **"Generate new token"**
2. Click **"Generate new token (classic)"**
3. You may need to confirm your password

### Step 3: Configure Token

**Name your token:**
```
Baseline Sentinel Auto-Sync
```

**Expiration:**
- Choose: `90 days` (or `No expiration` if you trust your machine)

**Select scopes (IMPORTANT - Only check these):**
- ✅ `repo` → `public_repo` (if your repos are public)
- ✅ `repo` → Full `repo` access (if your repos are private)
- ✅ `actions` → `read:actions` (to read CI results)

**DO NOT check:**
- ❌ admin
- ❌ delete_repo  
- ❌ workflow (write)
- ❌ Any other permissions

### Step 4: Generate and Copy

1. Scroll to bottom
2. Click **"Generate token"**
3. **IMPORTANT:** Copy the token immediately!
   ```
   ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. **Save it somewhere safe** (you'll need it in VS Code)
5. ⚠️ **You can only see this once!** If you lose it, generate a new one.

---

## Using the Token in VS Code

### First Time Setup:

1. Open VS Code
2. Press `Cmd+Shift+P`
3. Run: `Baseline Sentinel: Enable Auto-Sync`
4. Paste your token when prompted
5. Choose "Yes" to save it
6. Done! Auto-sync is now active

### The Token is Stored:

- ✅ Encrypted on your machine
- ✅ Never sent anywhere except GitHub
- ✅ Only you have access

---

## What Permissions Allow:

### ✅ What the token CAN do:
- Read your repository list
- Check CI workflow status
- Download CI artifacts
- Read commit information

### ❌ What the token CANNOT do:
- Modify your code
- Delete anything
- Push commits
- Change repository settings
- Access other people's private repos

---

## Security Best Practices

### ✅ DO:
- Use a descriptive name ("Baseline Sentinel")
- Set an expiration (90 days is good)
- Only give minimal permissions
- Revoke if you suspect compromise

### ❌ DON'T:
- Share your token with anyone
- Commit it to git
- Give it more permissions than needed
- Use the same token for multiple tools

---

## Revoking a Token

If you want to stop auto-sync or need to revoke:

1. Go to: https://github.com/settings/tokens
2. Find "Baseline Sentinel Auto-Sync"
3. Click **"Delete"**
4. Done! The token stops working immediately

---

## Troubleshooting

### "Token is invalid"
- Make sure you copied the entire token
- Check it hasn't expired
- Verify you gave `repo` and `actions` permissions

### "API rate limit exceeded"
- This shouldn't happen (we only use 30 requests/hour)
- Free tier allows 5,000/hour
- Wait 1 hour or generate a new token

### "Cannot access repository"
- For private repos, you need full `repo` scope
- For public repos, `public_repo` is enough
- Make sure the token has `read:actions` checked

---

## Example: What It Looks Like

Your token will look like this:
```
ghp_1A2b3C4d5E6f7G8h9I0jK1lM2nO3pQ4rS5tU
```

Starts with `ghp_`, followed by 40 random characters.

---

## Quick Reference

| Setting | Value |
|---------|-------|
| **Name** | Baseline Sentinel Auto-Sync |
| **Expiration** | 90 days |
| **Scopes** | `repo` + `read:actions` |
| **Cost** | Free |
| **Usage** | ~30 API calls/hour |
| **Limit** | 5,000 calls/hour |

---

## Summary

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it, set 90 days expiration
4. Check: `repo` + `read:actions`
5. Generate and copy token
6. Paste in VS Code when prompted
7. Auto-sync works forever! ✨

**Estimated time:** 2 minutes  
**One-time setup:** Never do this again

