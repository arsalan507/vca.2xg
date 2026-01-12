# Admin Dashboard Structure Analysis & Recommendations

## 📊 Current Data Model Analysis

Based on your codebase, here's what we can track:

### **Script Status Flow**
```
PENDING → APPROVED/REJECTED
└─> If APPROVED → Production Pipeline
```

### **Production Stage Flow**
```
NOT_STARTED
    ↓
PRE_PRODUCTION (Team Assignment)
    ↓
SHOOTING (Videographer uploads footage)
    ↓
SHOOT_REVIEW (Admin reviews footage)
    ↓
EDITING (Editor works on video)
    ↓
EDIT_REVIEW (Admin reviews edited video)
    ↓
FINAL_REVIEW (Final check)
    ↓
READY_TO_POST (Posting Manager prepares)
    ↓
POSTED (Live on social media)
```

### **Team Member Roles & Trackable Data**

#### 1. **Script Writer**
**What they do:**
- Submit scripts with reference links
- Add hook, why viral, how to replicate
- Include voice notes
- Set target emotion & expected outcome

**What we can track:**
- Total scripts submitted
- Approval rate (approved/total)
- Rejection rate (rejected/total)
- Scripts in review (pending)
- Average review time
- Quality score (if review scores exist)

#### 2. **Videographer**
**What they do:**
- Receive assigned projects
- Upload footage (A-roll, B-roll, Hook, Body, CTA)
- Move projects: NOT_STARTED → PRE_PRODUCTION → SHOOTING → SHOOT_REVIEW
- Add production notes

**What we can track:**
- Total assigned projects
- Projects by stage:
  - Pre-production (planning)
  - Shooting (active)
  - In review (shoot_review)
  - Completed shoots (moved to editing)
- Files uploaded count
- Average shoot time (pre_production → shoot_review)
- Projects overdue
- Production notes/issues reported

#### 3. **Editor**
**What they do:**
- Receive projects after shoot approved
- Download footage from videographer
- Edit video (EDITING stage)
- Submit for review (EDIT_REVIEW stage)
- Upload final video

**What we can track:**
- Total assigned projects
- Projects by stage:
  - Waiting to start (shoot approved, not in editing)
  - In editing
  - In review (edit_review)
  - Completed edits (moved to final_review)
- Average edit time (editing → edit_review)
- Revision count (if edit rejected → back to editing)
- Projects overdue

#### 4. **Posting Manager**
**What they do:**
- Receive final approved videos
- Prepare posting strategy
- Schedule/post content
- Mark as POSTED

**What we can track:**
- Total assigned projects
- Ready to post (ready_to_post stage)
- Posted (posted stage)
- Average posting time
- Post performance metrics (if tracked)

---

## 🎯 Recommended Admin Dashboard Structure

Based on your Notion diagram and data model, here's the ideal structure:

### **Layout: 3-Column Dashboard**

```
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD                                    [Filters]    │
├─────────────────┬──────────────────────┬────────────────────────┤
│                 │                      │                        │
│  📋 TEAM STATUS │  ✅ APPROVAL PENDING │  📊 PRODUCTION STATUS  │
│                 │                      │                        │
│  Script Writers │  Pending Scripts     │  Script Done           │
│  Videographers  │  ├─ Script 1        │  ├─ Project A          │
│  Editors        │  ├─ Script 2        │  │   Status: Shooting   │
│  Post Managers  │  └─ Script 3        │  │   Videographer: John │
│                 │                      │  │                      │
│  [Workload]     │  Content Uploaded    │  Shoot Done            │
│  [Performance]  │  ├─ Project X       │  ├─ Project B          │
│                 │  └─ Project Y       │  │   Status: Editing    │
│                 │                      │  │   Editor: Sarah      │
│                 │  Edit Submitted      │  │                      │
│                 │  ├─ Project M       │  Edit Done             │
│                 │  └─ Project N       │  ├─ Project C          │
│                 │                      │  │   Status: Final Rev  │
│                 │                      │  │                      │
│                 │                      │  Post Done             │
│                 │                      │  ├─ Project D          │
│                 │                      │  │   Status: Posted     │
└─────────────────┴──────────────────────┴────────────────────────┘
```

### **Column 1: Team Status & Performance**

**Purpose:** See all team members and their current workload/process

```tsx
// Team Member Card
┌──────────────────────────────────┐
│ 👤 Script Writers (5 active)      │
├──────────────────────────────────┤
│ • John Doe                        │
│   15 scripts | 80% approval      │
│   [View Details]                  │
│                                   │
│ • Jane Smith                      │
│   12 scripts | 75% approval      │
│   [View Details]                  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 🎥 Videographers (3 active)       │
├──────────────────────────────────┤
│ • Mike Johnson                    │
│   5 assigned | 2 shooting        │
│   [View Details]                  │
│                                   │
│ • Sarah Lee                       │
│   3 assigned | 1 shooting        │
│   [View Details]                  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ ✂️ Editors (2 active)             │
├──────────────────────────────────┤
│ • Tom Wilson                      │
│   4 assigned | 1 editing         │
│   [View Details]                  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 📱 Posting Managers (2 active)   │
├──────────────────────────────────┤
│ • Emma Davis                      │
│   6 ready | 2 posted this week  │
│   [View Details]                  │
└──────────────────────────────────┘
```

**Data Shown:**
- Role breakdown
- Active members count
- Workload per person
- Performance metrics (approval rate, completion rate)
- Quick action: View individual performance details

---

### **Column 2: Approval Pending (Admin Action Required)**

**Purpose:** Show all items waiting for admin review/approval

This column is **ACTION-ORIENTED** - everything here needs admin decision.

#### **Section 1: Script Approval**
```tsx
┌──────────────────────────────────────────┐
│ 📝 SCRIPT SUBMITTED (Pending Approval)  │
│ ─────────────────────────────────────── │
│ 5 scripts waiting                        │
├──────────────────────────────────────────┤
│ 1. "Funny bike accident reaction"       │
│    By: John Doe | 2 hours ago           │
│    [✅ Approve] [❌ Reject] [👁️ View]   │
│                                          │
│ 2. "Client surprise reaction"           │
│    By: Jane Smith | 5 hours ago         │
│    [✅ Approve] [❌ Reject] [👁️ View]   │
└──────────────────────────────────────────┘
```

**Status Color:** 🟡 Yellow/Orange (IDEA SUBMITTED, PENDING)

**What Admin Sees:**
- Script title (hook)
- Submitter name
- Time submitted
- Quick actions: Approve, Reject, View Details

**Admin Actions:**
1. Click **View** → Opens modal with full script details
2. Click **Approve** → Status changes to APPROVED, moves to production
3. Click **Reject** → Status changes to REJECTED, script writer notified

---

#### **Section 2: Content Uploaded (Shoot Review)**
```tsx
┌──────────────────────────────────────────┐
│ 🎬 CONTENT UPLOADED (Shoot Review)      │
│ ─────────────────────────────────────── │
│ 3 shoots waiting review                 │
├──────────────────────────────────────────┤
│ 1. "Funny bike accident reaction"       │
│    Videographer: Mike | 1 day ago       │
│    Files: 5 uploaded (A-roll, B-roll)   │
│    [✅ Approve Shoot] [❌ Reject] [👁️]  │
│                                          │
│ 2. "Client surprise reaction"           │
│    Videographer: Sarah | 3 hours ago    │
│    Files: 3 uploaded                     │
│    [✅ Approve Shoot] [❌ Reject] [👁️]  │
└──────────────────────────────────────────┘
```

**Status Color:** 🟢 Green (SHOOT DONE, awaiting review)

**What Admin Sees:**
- Project title
- Videographer name
- Files uploaded count
- Time since upload
- Production notes from videographer

**Admin Actions:**
1. Click **View** → See all uploaded files, production notes
2. Click **Approve Shoot** → Move to EDITING stage, assign editor
3. Click **Reject** → Send back to SHOOTING stage with feedback

---

#### **Section 3: Edit Submitted (Edit Review)**
```tsx
┌──────────────────────────────────────────┐
│ ✂️ EDIT SUBMITTED (Edit Review)         │
│ ─────────────────────────────────────── │
│ 2 edits waiting review                  │
├──────────────────────────────────────────┤
│ 1. "Funny bike accident reaction"       │
│    Editor: Tom | 2 hours ago            │
│    Final video uploaded                  │
│    [✅ Approve Edit] [❌ Reject] [👁️]   │
│                                          │
│ 2. "Client surprise reaction"           │
│    Editor: Sarah | 1 day ago            │
│    [✅ Approve Edit] [❌ Reject] [👁️]   │
└──────────────────────────────────────────┘
```

**Status Color:** 🟣 Purple (EDIT DONE, awaiting review)

**What Admin Sees:**
- Project title
- Editor name
- Time since submission
- Final video file

**Admin Actions:**
1. Click **View** → Watch final video
2. Click **Approve Edit** → Move to READY_TO_POST, assign posting manager
3. Click **Reject** → Send back to EDITING with revision notes

---

### **Column 3: Production Status Timeline**

**Purpose:** See overall production pipeline health

This shows **COMPLETED STAGES** - what's done and progressing well.

```tsx
┌────────────────────────────────────────┐
│ ✅ SCRIPT DONE (Approved)             │
│ ──────────────────────────────────── │
│ 12 scripts approved, in production    │
├────────────────────────────────────────┤
│ • "Bike accident" - SHOOTING          │
│ • "Client surprise" - PRE_PRODUCTION  │
│ • "Store reaction" - SHOOTING         │
│ [View All →]                           │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 🎬 SHOOT DONE (Approved)              │
│ ──────────────────────────────────── │
│ 8 shoots completed, in editing        │
├────────────────────────────────────────┤
│ • "Product review" - EDITING          │
│   Editor: Tom Wilson                   │
│ • "Tutorial video" - EDITING          │
│   Editor: Sarah Lee                    │
│ [View All →]                           │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ✂️ EDIT DONE (Approved)               │
│ ──────────────────────────────────── │
│ 5 edits finalized, ready to post      │
├────────────────────────────────────────┤
│ • "How-to guide" - FINAL_REVIEW       │
│ • "Before/After" - READY_TO_POST      │
│   Posting Mgr: Emma Davis              │
│ [View All →]                           │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 📱 POST DONE (Live)                   │
│ ──────────────────────────────────── │
│ 20 videos posted this week            │
├────────────────────────────────────────┤
│ • "Viral dance" - Posted 2 days ago  │
│ • "Product launch" - Posted today     │
│ [View All →]                           │
└────────────────────────────────────────┘
```

---

## 🎨 Status Color Coding System

Based on your Notion screenshot and workflow:

| Status | Color | Meaning | Admin Action |
|--------|-------|---------|--------------|
| **IDEA SUBMITTED** | 🟡 Yellow (`bg-yellow-100`) | Script pending approval | Review & Approve/Reject |
| **SCRIPT REJECTED** | 🔴 Red (`bg-red-100`) | Script not approved | None (archived) |
| **SCRIPT DONE** | 🟢 Green (`bg-green-100`) | Approved, in production | Monitor progress |
| **SHOOT DONE** | 🟢 Green (`bg-green-100`) | Footage uploaded for review | Review & Approve/Reject |
| **SHOOT REJECTED** | 🟠 Orange (`bg-orange-100`) | Reshoot required | Wait for resubmission |
| **EDIT DONE** | 🟣 Purple (`bg-purple-100`) | Edit submitted for review | Review & Approve/Reject |
| **EDIT REJECTED** | 🟠 Orange (`bg-orange-100`) | Revision needed | Wait for resubmission |
| **POST DONE** | ✅ Emerald (`bg-emerald-100`) | Posted live | None (completed) |

---

## 📊 Dashboard Metrics & KPIs

### **Top Stats Bar**
```tsx
┌─────────────────────────────────────────────────────────────┐
│ 📊 OVERVIEW                                                  │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ Pending  │ In Prod  │ Completed│ Team     │ Avg Completion │
│ Actions  │ Projects │ This Week│ Members  │ Time           │
│    8     │    25    │    12    │    15    │   5.2 days     │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

### **Pending Actions Breakdown**
```
┌─────────────────────────────┐
│ ⚠️ ADMIN ACTIONS REQUIRED  │
├─────────────────────────────┤
│ • 5 Scripts to review       │
│ • 3 Shoots to approve       │
│ • 2 Edits to approve        │
│ ─────────────────────────── │
│ Total: 10 pending           │
└─────────────────────────────┘
```

---

## 🔍 Tracking Work of Each Role

### **1. Script Writer Dashboard View**
```sql
-- What admin sees for each script writer:
SELECT
  writer_name,
  COUNT(*) as total_submitted,
  SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
  ROUND(AVG(review_score), 1) as avg_score,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_review_time_hours
FROM viral_analyses
GROUP BY writer_name
```

**Shows:**
- Total scripts submitted
- Approval rate percentage
- Scripts pending review
- Average quality score
- Average time to get reviewed

---

### **2. Videographer Dashboard View**
```sql
-- What admin sees for each videographer:
SELECT
  v.full_name as videographer,
  COUNT(DISTINCT pa.analysis_id) as total_assigned,
  SUM(CASE WHEN va.production_stage = 'SHOOTING' THEN 1 ELSE 0 END) as currently_shooting,
  SUM(CASE WHEN va.production_stage = 'SHOOT_REVIEW' THEN 1 ELSE 0 END) as in_review,
  SUM(CASE WHEN va.production_stage IN ('EDITING','EDIT_REVIEW','FINAL_REVIEW','READY_TO_POST','POSTED') THEN 1 ELSE 0 END) as completed_shoots,
  COUNT(pf.id) as total_files_uploaded,
  AVG(EXTRACT(EPOCH FROM (va.updated_at - va.production_started_at))/86400) as avg_shoot_days
FROM project_assignments pa
JOIN profiles v ON pa.user_id = v.id
JOIN viral_analyses va ON pa.analysis_id = va.id
LEFT JOIN production_files pf ON va.id = pf.analysis_id
WHERE pa.role = 'VIDEOGRAPHER'
GROUP BY v.id, v.full_name
```

**Shows:**
- Total projects assigned
- Projects actively shooting
- Projects submitted for review
- Completed shoots (passed to editing)
- Total files uploaded
- Average days from assignment to completion

---

### **3. Editor Dashboard View**
```sql
-- What admin sees for each editor:
SELECT
  e.full_name as editor,
  COUNT(DISTINCT pa.analysis_id) as total_assigned,
  SUM(CASE WHEN va.production_stage = 'EDITING' THEN 1 ELSE 0 END) as currently_editing,
  SUM(CASE WHEN va.production_stage = 'EDIT_REVIEW' THEN 1 ELSE 0 END) as in_review,
  SUM(CASE WHEN va.production_stage IN ('FINAL_REVIEW','READY_TO_POST','POSTED') THEN 1 ELSE 0 END) as completed_edits,
  AVG(EXTRACT(EPOCH FROM (va.updated_at - va.production_started_at))/86400) as avg_edit_days
FROM project_assignments pa
JOIN profiles e ON pa.user_id = e.id
JOIN viral_analyses va ON pa.analysis_id = va.id
WHERE pa.role = 'EDITOR'
GROUP BY e.id, e.full_name
```

**Shows:**
- Total projects assigned
- Projects actively editing
- Edits submitted for review
- Completed edits (ready to post/posted)
- Average days from assignment to completion

---

### **4. Posting Manager Dashboard View**
```sql
-- What admin sees for each posting manager:
SELECT
  pm.full_name as posting_manager,
  COUNT(DISTINCT pa.analysis_id) as total_assigned,
  SUM(CASE WHEN va.production_stage = 'READY_TO_POST' THEN 1 ELSE 0 END) as ready_to_post,
  SUM(CASE WHEN va.production_stage = 'POSTED' THEN 1 ELSE 0 END) as posted_total,
  SUM(CASE WHEN va.production_stage = 'POSTED' AND va.updated_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as posted_this_week
FROM project_assignments pa
JOIN profiles pm ON pa.user_id = pm.id
JOIN viral_analyses va ON pa.analysis_id = va.id
WHERE pa.role = 'POSTING_MANAGER'
GROUP BY pm.id, pm.full_name
```

**Shows:**
- Total projects assigned
- Videos ready to post
- Total videos posted
- Videos posted this week

---

## 🚀 Implementation Recommendation

### **Phase 1: Admin Action Center (Priority 1)**
Focus on Column 2 first - this is where admin makes decisions.

**Build:**
1. Pending Scripts Approval Table
2. Shoot Review Table (with file preview)
3. Edit Review Table (with video player)

**Features:**
- Inline approve/reject buttons
- Quick view modal with full details
- Bulk approve functionality
- Filter by date, priority, submitter

---

### **Phase 2: Team Overview (Priority 2)**
Build Column 1 - see all team members and workload.

**Build:**
1. Team member cards by role
2. Individual performance metrics
3. Workload distribution chart
4. Click to see detailed breakdown

---

### **Phase 3: Production Pipeline (Priority 3)**
Build Column 3 - overall production health.

**Build:**
1. Stage-based grouping (Script Done, Shoot Done, etc.)
2. Progress indicators
3. Timeline view
4. Bottleneck detection

---

### **Phase 4: Notion-Style Table (Priority 4)**
After the 3-column layout works, implement the Notion-style filterable table for power users.

---

## 📋 Key Database Queries Needed

```sql
-- 1. Get all pending approvals
SELECT * FROM viral_analyses
WHERE status = 'PENDING'
ORDER BY created_at ASC;

-- 2. Get all shoots awaiting review
SELECT * FROM viral_analyses
WHERE production_stage = 'SHOOT_REVIEW'
ORDER BY updated_at ASC;

-- 3. Get all edits awaiting review
SELECT * FROM viral_analyses
WHERE production_stage = 'EDIT_REVIEW'
ORDER BY updated_at ASC;

-- 4. Get team member workload
SELECT
  role,
  COUNT(*) as active_projects,
  production_stage
FROM project_assignments pa
JOIN viral_analyses va ON pa.analysis_id = va.id
WHERE va.production_stage NOT IN ('POSTED')
GROUP BY role, production_stage;

-- 5. Get production pipeline overview
SELECT
  production_stage,
  COUNT(*) as count
FROM viral_analyses
WHERE status = 'APPROVED'
GROUP BY production_stage
ORDER BY
  CASE production_stage
    WHEN 'PRE_PRODUCTION' THEN 1
    WHEN 'SHOOTING' THEN 2
    WHEN 'SHOOT_REVIEW' THEN 3
    WHEN 'EDITING' THEN 4
    WHEN 'EDIT_REVIEW' THEN 5
    WHEN 'FINAL_REVIEW' THEN 6
    WHEN 'READY_TO_POST' THEN 7
    WHEN 'POSTED' THEN 8
  END;
```

---

## ✅ Summary

Your current data model **FULLY SUPPORTS** the workflow diagram you showed! Here's what you have:

✅ **Script Writer Tracking:**
- Submissions (viral_analyses table)
- Status (PENDING/APPROVED/REJECTED)
- Review scores

✅ **Videographer Tracking:**
- Project assignments
- Production stages (SHOOTING, SHOOT_REVIEW)
- Files uploaded (production_files table)
- Production notes

✅ **Editor Tracking:**
- Project assignments
- Production stages (EDITING, EDIT_REVIEW)
- Final videos

✅ **Posting Manager Tracking:**
- Project assignments
- Production stages (READY_TO_POST, POSTED)
- Post timing

**What's Missing:**
❌ Rejection feedback/notes (add rejection_reason field)
❌ Revision history tracking
❌ Performance analytics dashboard
❌ Team workload balancing UI

---

## 🎯 Next Steps

1. **Build the 3-column admin dashboard** as outlined above
2. **Add rejection reason fields** to database
3. **Create team performance reports**
4. **Implement the Notion-style table view** for power users

This will give you complete visibility into every team member's work and make admin decisions much faster!
