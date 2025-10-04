# 📥 Getting CI Scan Results into VS Code

## The Complete Workflow (3 Simple Steps)

### Step 1: Push Your Code
```bash
git add .
git commit -m "Your changes"
git push
```

### Step 2: Wait for CI (2-3 minutes)
- Go to your GitHub repository
- Click the **Actions** tab  
- See the "Baseline Sentinel" workflow running
- Wait for it to complete (green checkmark or yellow warning)

### Step 3: Import Results into VS Code

**Option A: One Command**
1. Open VS Code
2. Press `Cmd+Shift+P` (Command Palette)
3. Type: `Baseline Sentinel: Import CI Results`
4. Select the downloaded `baseline-results.json` file
5. Done! All issues appear in the Problems panel

**Option B: With Helper**
1. Open Command Palette (`Cmd+Shift+P`)
2. Type: `Baseline Sentinel: Download GitHub Actions Results`
3. Click "Open GitHub Actions" (opens your Actions page)
4. Download the `baseline-results.json` artifact
5. Click "Import Results Now"
6. Select the file
7. Done!

---

## What You Get

After importing, you'll see:

### 1. **Markdown Report**
A beautiful report showing:
```markdown
# Baseline Sentinel CI Report

**Total Issues:** 18

**Files Affected:** 3

---

## 📄 test.css

**Issues:** 10

- **Line 14:5** - The CSS property 'grid-template-rows' is not part of Baseline.
  - [Open file](...)
- **Line 21:3** - The CSS property 'text-wrap' is not part of Baseline.
  - [Open file](...)
...
```

### 2. **Clickable Links**
- Click any "Open file" link
- VS Code jumps to the exact line
- You see the problematic code immediately

### 3. **Fix All Option**
- At the bottom of the report: "Fix All" button
- Click it to attempt auto-fixing all issues
- Or fix them manually one by one

---

## Tips & Tricks

### 💡 Tip 1: Download the JSON Early
Right after the CI completes:
1. Go to Actions tab
2. Click the workflow run
3. Scroll to "Artifacts" section at the bottom
4. Click "baseline-results.json" to download
5. Save it somewhere easy to find

### 💡 Tip 2: Keep the File
Don't delete the JSON file immediately. You might want to:
- Review it later
- Share with teammates
- Compare before/after fixes

### 💡 Tip 3: Fix and Re-run
After fixing issues:
1. Push your fixes
2. CI runs again automatically
3. Download new results
4. Verify all issues are resolved ✅

---

## Troubleshooting

### "No artifact found"
- Make sure the CI workflow completed
- Check that it didn't fail in the build step
- The artifact is only available for 90 days

### "Invalid JSON format"
- Make sure you downloaded the correct file
- Don't edit the JSON manually
- Re-download if corrupted

### "Cannot find file"
- The JSON might be in a ZIP file
- Extract it first
- Look for `baseline-results.json`

---

## Example: Full Cycle

```bash
# Day 1: Write code
$ git push

# Wait 3 minutes...

# In VS Code:
Cmd+Shift+P → "Import CI Results"
Select: ~/Downloads/baseline-results.json

# See: 18 issues found!

# Fix them all with Quick Fixes

$ git push

# Wait 3 minutes...

# Import results again
# See: 0 issues! ✅
```

---

## Keyboard Shortcut (Optional)

Add this to your VS Code `keybindings.json`:

```json
{
  "key": "cmd+shift+i",
  "command": "baseline.importCIResults",
  "when": "!terminalFocus"
}
```

Now press `Cmd+Shift+I` to quickly import CI results!

---

## Summary

✅ **Push code** → CI scans automatically  
✅ **Download JSON** → One click on GitHub  
✅ **Import to VS Code** → One command  
✅ **Review & Fix** → Problems panel + Quick Fixes  
✅ **Push fixes** → CI passes! 🎉

**Total manual work:** 2 clicks + 1 command = **< 30 seconds**

