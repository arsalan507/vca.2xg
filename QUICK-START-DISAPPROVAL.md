# Quick Start: Disapproval Feature

## ✅ What's Already Done

All code is complete and running:
- ✅ Database migration SQL created
- ✅ Backend API endpoint added
- ✅ Frontend components created
- ✅ TypeScript types updated
- ✅ UI integrated in admin panel

## 🚀 One Step to Activate

### Run the SQL Migration

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/ckfbjsphyasborpnwbyy/sql/new
   ```

2. **Copy and paste this SQL:**
   - File: `MIGRATION-TO-RUN.sql` (in project root)
   - Or use: `add-disapproval-feature.sql`

3. **Click "RUN"**

4. **Verify Success:**
   You should see:
   - ✅ ALTER TABLE
   - ✅ CREATE FUNCTION
   - ✅ CREATE VIEW
   - ✅ GRANT statements

## 🎯 How to Use

1. **Navigate to:** http://localhost:5173/admin/review

2. **Find:** "Approved Scripts" section (at the bottom)

3. **Click:** "View Details" on any approved script

4. **You'll see:** A "Disapprove Script" button (orange/warning color)

5. **Click it and:**
   - Enter a reason (required)
   - Submit
   - Script moves back to PENDING
   - Script writer can revise and resubmit

## 📊 What It Does

When you disapprove a script:
- ✅ Status: APPROVED → PENDING
- ✅ Production stage: Resets to NOT_STARTED
- ✅ Counter: Increments disapproval_count
- ✅ Timestamp: Records when disapproved
- ✅ Reason: Saves your explanation
- ✅ Notes: Adds entry to production_notes
- ✅ Teams: Preserves assignments

## 🔍 Visual Indicators

Scripts show badges:
- **Green:** ✅ APPROVED
- **Yellow:** 🟡 PENDING
- **Orange:** ⚠️ Disapproved 2x (if disapproved before)

## 📚 Full Documentation

See `DISAPPROVAL-FEATURE-IMPLEMENTATION.md` for:
- Complete technical details
- Database schema changes
- API documentation
- Troubleshooting guide
- Rollback instructions

## ⚡ Quick Test

After running the SQL:
1. Approve a test script
2. Go to "Approved Scripts" section
3. Click "View Details"
4. Click "Disapprove Script"
5. Enter reason: "Testing disapproval feature"
6. Submit
7. Check it moved to "Script Submissions" (PENDING)
8. Verify disapproval count shows "⚠️ Disapproved 1x"

---

**Status:** Ready to activate! Just run the SQL migration.
