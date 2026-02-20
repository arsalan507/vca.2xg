import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppShell from '@/components/AppShell';
import LoginPage from '@/pages/LoginPage';

// Lazy load role-specific pages
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Videographer pages
const VideographerHome = lazy(() => import('@/pages/videographer/HomePage'));
const VideographerAvailable = lazy(() => import('@/pages/videographer/AvailablePage'));
const VideographerMyProjects = lazy(() => import('@/pages/videographer/MyProjectsPage'));
const VideographerProjectDetail = lazy(() => import('@/pages/videographer/ProjectDetailPage'));
const VideographerUpload = lazy(() => import('@/pages/videographer/UploadPage'));
const VideographerNewScript = lazy(() => import('@/pages/videographer/NewScriptPage'));
const VideographerMyScripts = lazy(() => import('@/pages/videographer/MyScriptsPage'));

// Editor pages
const EditorHome = lazy(() => import('@/pages/editor/HomePage'));
const EditorAvailable = lazy(() => import('@/pages/editor/AvailablePage'));
const EditorMyProjects = lazy(() => import('@/pages/editor/MyProjectsPage'));
const EditorProjectDetail = lazy(() => import('@/pages/editor/ProjectDetailPage'));
const EditorUpload = lazy(() => import('@/pages/editor/UploadPage'));
const EditorCompleted = lazy(() => import('@/pages/editor/CompletedPage'));

// Posting Manager pages
const PostingHome = lazy(() => import('@/pages/posting/HomePage'));
const PostingToPost = lazy(() => import('@/pages/posting/ToPostPage'));
const PostingDetail = lazy(() => import('@/pages/posting/PostDetailPage'));
const PostingCalendar = lazy(() => import('@/pages/posting/CalendarPage'));
const PostingPosted = lazy(() => import('@/pages/posting/PostedPage'));

// Admin pages
const AdminHome = lazy(() => import('@/pages/admin/HomePage'));
const AdminPending = lazy(() => import('@/pages/admin/PendingPage'));
const AdminReview = lazy(() => import('@/pages/admin/ReviewPage'));
const AdminEditedReview = lazy(() => import('@/pages/admin/EditedReviewPage'));
const AdminProduction = lazy(() => import('@/pages/admin/ProductionPage'));
const AdminProjectDetail = lazy(() => import('@/pages/admin/ProjectDetailPage'));
const AdminTeam = lazy(() => import('@/pages/admin/TeamPage'));
const AdminAnalytics = lazy(() => import('@/pages/admin/AnalyticsPage'));
const AdminNewScript = lazy(() => import('@/pages/admin/NewScriptPage'));

// Script Writer pages
const WriterHome = lazy(() => import('@/pages/writer/HomePage'));
const WriterNewScript = lazy(() => import('@/pages/writer/NewScriptPage'));
const WriterMyScripts = lazy(() => import('@/pages/writer/MyScriptsPage'));
const WriterScriptDetail = lazy(() => import('@/pages/writer/ScriptDetailPage'));

// Shared pages
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

// Loading fallback
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

// Role-based redirect component
function RoleRedirect() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  // Normalize role to lowercase for comparison
  const normalizedRole = role?.toLowerCase();

  switch (normalizedRole) {
    case 'admin':
    case 'super_admin':
      return <Navigate to="/admin" replace />;
    case 'script_writer':
      return <Navigate to="/writer" replace />;
    case 'videographer':
      return <Navigate to="/videographer" replace />;
    case 'editor':
      return <Navigate to="/editor" replace />;
    case 'posting_manager':
      return <Navigate to="/posting" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default function App() {
  const { role } = useAuth();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleRedirect />
              </ProtectedRoute>
            }
          />

          {/* Videographer routes */}
          <Route
            path="/videographer"
            element={
              <ProtectedRoute allowedRoles={['videographer', 'admin', 'super_admin']}>
                <AppShell role={role || 'videographer'} />
              </ProtectedRoute>
            }
          >
            <Route index element={<VideographerHome />} />
            <Route path="available" element={<VideographerAvailable />} />
            <Route path="my-projects" element={<VideographerMyProjects />} />
            <Route path="project/:id" element={<VideographerProjectDetail />} />
            <Route path="upload/:id" element={<VideographerUpload />} />
            <Route path="new-script" element={<VideographerNewScript />} />
            <Route path="my-scripts" element={<VideographerMyScripts />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Editor routes */}
          <Route
            path="/editor"
            element={
              <ProtectedRoute allowedRoles={['editor', 'admin', 'super_admin']}>
                <AppShell role={role || 'editor'} />
              </ProtectedRoute>
            }
          >
            <Route index element={<EditorHome />} />
            <Route path="available" element={<EditorAvailable />} />
            <Route path="my-projects" element={<EditorMyProjects />} />
            <Route path="project/:id" element={<EditorProjectDetail />} />
            <Route path="upload/:id" element={<EditorUpload />} />
            <Route path="completed" element={<EditorCompleted />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Posting Manager routes */}
          <Route
            path="/posting"
            element={
              <ProtectedRoute allowedRoles={['posting_manager', 'admin', 'super_admin']}>
                <AppShell role={role || 'posting_manager'} />
              </ProtectedRoute>
            }
          >
            <Route index element={<PostingHome />} />
            <Route path="to-post" element={<PostingToPost />} />
            <Route path="post/:id" element={<PostingDetail />} />
            <Route path="calendar" element={<PostingCalendar />} />
            <Route path="posted" element={<PostingPosted />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <AppShell role="admin" />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="pending" element={<AdminPending />} />
            <Route path="review/:id" element={<AdminReview />} />
            <Route path="edited-review" element={<AdminEditedReview />} />
            <Route path="production" element={<AdminProduction />} />
            <Route path="project/:id" element={<AdminProjectDetail />} />
            <Route path="team" element={<AdminTeam />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="new-script" element={<AdminNewScript />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Script Writer routes */}
          <Route
            path="/writer"
            element={
              <ProtectedRoute allowedRoles={['script_writer', 'admin', 'super_admin']}>
                <AppShell role={role || 'script_writer'} />
              </ProtectedRoute>
            }
          >
            <Route index element={<WriterHome />} />
            <Route path="new" element={<WriterNewScript />} />
            <Route path="scripts" element={<WriterMyScripts />} />
            <Route path="scripts/:id" element={<WriterScriptDetail />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
