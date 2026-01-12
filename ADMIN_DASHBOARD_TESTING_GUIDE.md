# 🧪 Admin Dashboard Testing Guide

## ✅ Server Status

- ✅ **Frontend:** Running on http://localhost:5174/
- ✅ **Backend:** Running on port 3000

---

## 🔐 How to Access

1. **Open your browser:** http://localhost:5174/
2. **Login as Admin** with your Super Admin credentials
3. **You should land on the Admin Dashboard**

---

## 📋 Testing Checklist

### **1. Sidebar Navigation** ✅

**What to check:**
- [ ] Sidebar shows 3 navigation items:
  - 👥 Team Members
  - ⚠️ Need Approval (with badge count)
  - 📊 Production Status
- [ ] Badge counts are displayed next to each item
- [ ] "Need Approval" badge is red if count > 0
- [ ] Pulsing animation on "Need Approval" badge

**How to test:**
- Click each navigation item
- Page should change without page reload
- Selected item should be highlighted

---

### **2. Need Approval Page (Default)** ⚠️

**What to check:**
- [ ] Page title: "Need Approval"
- [ ] Shows total pending count
- [ ] Three sections visible:
  - 📝 Script Submissions
  - 🎬 Shoot Reviews
  - ✂️ Edit Reviews

**Test Script Approval:**
1. Find a pending script
2. Click **View** button → Should show script details
3. Click **Approve** → Should:
   - Open team assignment modal
   - Update badge count
   - Remove from pending list
4. Click **Reject** → Should:
   - Remove from list
   - Update badge count

**Test Shoot Review:**
1. Find a shoot in review
2. Click **View Files** → Should show uploaded files
3. Click **Approve** → Should:
   - Move to editing stage
   - Update badge count
4. Click **Reject** → Should send back to shooting

**Test Edit Review:**
1. Find an edit in review
2. Click **Watch Video** → Should show video
3. Click **Approve** → Should move to final review
4. Click **Request Fix** → Should send back to editing

**Expected behavior:**
- ✅ Inline approve/reject buttons work
- ✅ Badge counts update immediately
- ✅ Items disappear from list after action
- ✅ Toast notifications appear

---

### **3. Team Members Page** 👥

**What to check:**
- [ ] Page title: "Team Members"
- [ ] Shows total team member count
- [ ] Four tables visible:
  - Script Writers table
  - Videographers table
  - Editors table
  - Posting Managers table

**Script Writers Table:**
- [ ] Shows columns: Name, Total Scripts, Approved, Rejected, Pending, Approval Rate
- [ ] Approval rate has color coding:
  - Green: >= 75%
  - Yellow: >= 50%
  - Red: < 50%

**Videographers Table:**
- [ ] Shows columns: Name, Assigned, Shooting, In Review, Completed
- [ ] Numbers match actual project counts

**Editors Table:**
- [ ] Shows columns: Name, Assigned, Editing, In Review, Completed
- [ ] Numbers match actual project counts

**Posting Managers Table:**
- [ ] Shows columns: Name, Assigned, Ready to Post, Posted (Total), This Week
- [ ] Numbers match actual project counts

**Expected behavior:**
- ✅ All team members listed
- ✅ Stats calculated correctly
- ✅ Tables are scrollable if needed
- ✅ Hover effects on rows

---

### **4. Production Status Page** 📊

**What to check:**
- [ ] Page title: "Production Status"
- [ ] Shows total projects count
- [ ] Pipeline Overview section with 7 stats:
  - Script Done
  - Shoot Active
  - Shoot Done
  - Edit Active
  - Edit Done
  - Ready to Post
  - Posted

**Project Sections:**
- [ ] Script Done section (if any projects)
- [ ] Shoot Done section (if any projects)
- [ ] Edit Done section (if any projects)
- [ ] Posted section (if any projects)

**Each project table shows:**
- [ ] Project name/hook
- [ ] Current stage badge
- [ ] Team member assigned
- [ ] Priority badge
- [ ] Deadline (if set)

**Expected behavior:**
- ✅ Pipeline stats add up correctly
- ✅ Color-coded stage badges
- ✅ Priority badges (URGENT = red, HIGH = orange, etc.)
- ✅ Tables grouped by stage
- ✅ Responsive scrolling

---

### **5. Real-Time Features** 🔄

**Auto-refresh badge counts:**
1. Keep dashboard open
2. Open another tab/window
3. Create a new script submission or change a project stage
4. Wait 30 seconds
5. Badge count should update automatically

**What to check:**
- [ ] Badge counts refresh every 30 seconds
- [ ] No page reload required
- [ ] Pulsing animation appears when count > 0

---

### **6. Responsive Design** 📱

**What to check:**
- [ ] Sidebar width is fixed (256px)
- [ ] Main content area is scrollable
- [ ] Tables are horizontally scrollable if needed
- [ ] No layout breaking on smaller screens

**Test by:**
- Resizing browser window
- Zooming in/out
- Checking on different screen sizes

---

### **7. Navigation Flow** 🔀

**Test complete flow:**
1. **Login** → Should land on "Need Approval" page
2. **Click "Team Members"** → Page changes instantly
3. **Click "Production Status"** → Page changes instantly
4. **Click "Need Approval"** → Returns to approval page
5. **URL should NOT change** (single page app)

**Expected behavior:**
- ✅ Instant page switches (no loading)
- ✅ Active nav item highlighted
- ✅ Badge counts persist across navigation
- ✅ Data fetched on first visit to each page

---

## 🐛 Common Issues & Fixes

### **Issue 1: Badge counts show 0 but items exist**
**Fix:** Check Supabase connection, ensure queries are fetching correctly

### **Issue 2: "Need Approval" page is empty**
**Fix:** Create some test data:
- Submit a script (as Script Writer)
- Upload footage (as Videographer, set stage to SHOOT_REVIEW)
- Submit edit (as Editor, set stage to EDIT_REVIEW)

### **Issue 3: Team stats showing 0**
**Fix:** Ensure:
- Users exist in profiles table
- Project assignments exist
- Production stages are set correctly

### **Issue 4: Approve button not working**
**Fix:** Check:
- adminService.reviewAnalysis() function
- assignmentService.updateProductionStage() function
- Supabase RLS policies allow admin updates

---

## 📸 Screenshots to Take

For documentation, take screenshots of:
1. Sidebar with badge counts
2. Need Approval page (all 3 sections)
3. Team Members page (all 4 tables)
4. Production Status page (pipeline overview)
5. Approve action in progress
6. Team assignment modal

---

## ✅ Success Criteria

Dashboard is working correctly if:

✅ All 3 pages load without errors
✅ Navigation between pages is instant
✅ Badge counts are accurate
✅ Approve/reject actions work
✅ Real-time updates occur
✅ Team stats calculate correctly
✅ Production pipeline displays all stages
✅ UI is clean and Notion-like
✅ No console errors
✅ Responsive on different screen sizes

---

## 🎯 Next Actions After Testing

If everything works:
1. ✅ Deploy to production
2. ✅ Train team on new dashboard
3. ✅ Monitor usage and performance
4. ✅ Collect feedback for improvements

If issues found:
1. 🐛 Document the issue
2. 🔍 Check browser console for errors
3. 🔧 Debug and fix
4. 🔄 Re-test

---

## 🚀 Ready to Test!

Open http://localhost:5174/ and start testing!

The dashboard should be fully functional and ready to streamline your viral content production workflow! 🎊
