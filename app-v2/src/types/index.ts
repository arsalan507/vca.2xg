// ============================================
// USER ROLES
// ============================================

export type UserRole = 'admin' | 'super_admin' | 'script_writer' | 'videographer' | 'editor' | 'posting_manager';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  avatar_url?: string;
  is_trusted_writer?: boolean;
  user_metadata?: {
    full_name?: string;
    role?: UserRole;
  };
  app_metadata?: {
    role?: UserRole;
  };
}

// ============================================
// PRODUCTION STAGES
// ============================================

export type ProductionStage =
  | 'PLANNING'
  | 'SHOOTING'
  | 'READY_FOR_EDIT'
  | 'EDITING'
  | 'READY_TO_POST'
  | 'POSTED'
  // Legacy stages (kept for backwards compatibility)
  | 'NOT_STARTED'
  | 'PRE_PRODUCTION'
  | 'PLANNED'
  | 'SHOOT_REVIEW'
  | 'EDIT_REVIEW'
  | 'FINAL_REVIEW';

export type ProductionStageV2 =
  | 'PLANNING'
  | 'SHOOTING'
  | 'READY_FOR_EDIT'
  | 'EDITING'
  | 'EDIT_REVIEW'
  | 'READY_TO_POST'
  | 'POSTED';

export const ProductionStageLabels: Record<string, string> = {
  PLANNING: 'Planning',
  SHOOTING: 'Shooting',
  READY_FOR_EDIT: 'Ready for Edit',
  EDITING: 'Editing',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  NOT_STARTED: 'Not Started',
  PRE_PRODUCTION: 'Pre-Production',
  PLANNED: 'Planned',
  SHOOT_REVIEW: 'Shoot Review',
  EDIT_REVIEW: 'Edit Review',
  FINAL_REVIEW: 'Final Review',
};

export const ProductionStageColors: Record<string, string> = {
  PLANNING: 'bg-blue-100 text-blue-800',
  SHOOTING: 'bg-yellow-100 text-yellow-800',
  READY_FOR_EDIT: 'bg-purple-100 text-purple-800',
  EDITING: 'bg-orange-100 text-orange-800',
  EDIT_REVIEW: 'bg-amber-100 text-amber-800',
  READY_TO_POST: 'bg-green-100 text-green-800',
  POSTED: 'bg-gray-100 text-gray-800',
};

// ============================================
// PRIORITY & PLATFORM
// ============================================

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type Platform = 'instagram_reel' | 'youtube_shorts' | 'youtube_long';

export type PostingPlatform =
  | 'INSTAGRAM_REEL'
  | 'INSTAGRAM_POST'
  | 'INSTAGRAM_STORY'
  | 'TIKTOK'
  | 'YOUTUBE_SHORTS'
  | 'YOUTUBE_VIDEO';

export const PostingPlatformLabels: Record<PostingPlatform, string> = {
  INSTAGRAM_REEL: 'Instagram Reel',
  INSTAGRAM_POST: 'Instagram Post',
  INSTAGRAM_STORY: 'Instagram Story',
  TIKTOK: 'TikTok',
  YOUTUBE_SHORTS: 'YouTube Shorts',
  YOUTUBE_VIDEO: 'YouTube Video',
};

// ============================================
// PROFILE & INDUSTRY
// ============================================

export type ProfilePlatform = 'INSTAGRAM' | 'YOUTUBE' | 'TIKTOK' | 'FACEBOOK' | 'TWITTER' | 'OTHER';

export const ProfilePlatformLabels: Record<ProfilePlatform, string> = {
  INSTAGRAM: 'Instagram',
  YOUTUBE: 'YouTube',
  TIKTOK: 'TikTok',
  FACEBOOK: 'Facebook',
  TWITTER: 'Twitter/X',
  OTHER: 'Other',
};

export const ProfilePlatformIcons: Record<ProfilePlatform, string> = {
  INSTAGRAM: '📸',
  YOUTUBE: '▶️',
  TIKTOK: '🎵',
  FACEBOOK: '📘',
  TWITTER: '🐦',
  OTHER: '🌐',
};

export interface Profile {
  id: string;
  code: string;
  name: string;
  description?: string;
  platform?: ProfilePlatform;
  is_active: boolean;
}

export interface Industry {
  id: string;
  name: string;
  short_code: string;
  description?: string;
  is_active: boolean;
}

export interface HookTag {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface CharacterTag {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

// ============================================
// CAST COMPOSITION
// ============================================

export interface CastComposition {
  man: number;
  woman: number;
  boy: number;
  girl: number;
  teen_boy: number;
  teen_girl: number;
  senior_man: number;
  senior_woman: number;
  include_owner: boolean;
  total: number;
}

export const DEFAULT_CAST_COMPOSITION: CastComposition = {
  man: 0,
  woman: 0,
  boy: 0,
  girl: 0,
  teen_boy: 0,
  teen_girl: 0,
  senior_man: 0,
  senior_woman: 0,
  include_owner: false,
  total: 0,
};

// ============================================
// VIRAL ANALYSIS (Main Entity)
// ============================================

export interface ViralAnalysis {
  id: string;
  user_id: string;
  reference_url: string;
  title?: string;

  // Core analysis
  hook?: string;
  hook_voice_note_url?: string;
  why_viral?: string;

  // Script content (Phase 1)
  script_body?: string;
  script_cta?: string;
  why_viral_voice_note_url?: string;
  target_emotion: string;
  expected_outcome: string;

  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  production_stage?: ProductionStage;

  // Basic Info
  platform?: string;
  content_type?: string;
  shoot_type?: string;
  creator_name?: string;

  // Production Details
  industry_id?: string;
  profile_id?: string;

  // System fields
  content_id?: string;

  // Populated relations
  industry?: Industry;
  profile?: Profile;
  hook_tags?: HookTag[];
  character_tags?: CharacterTag[];
  cast_composition?: CastComposition;

  // Review fields
  reviewed_by?: string;
  reviewed_at?: string;
  feedback?: string;
  feedback_voice_note_url?: string;
  hook_strength?: number;
  content_quality?: number;
  viral_potential?: number;
  replication_clarity?: number;
  overall_score?: number;

  // Production workflow
  priority?: Priority;
  deadline?: string;
  production_notes?: string;
  production_started_at?: string;
  production_completed_at?: string;
  admin_remarks?: string;

  // Rejection tracking
  rejection_count?: number;
  is_dissolved?: boolean;
  dissolution_reason?: string;

  // Disapproval tracking
  disapproval_count?: number;
  last_disapproved_at?: string;
  disapproval_reason?: string;

  // Posting fields
  posting_platform?: PostingPlatform;
  posting_caption?: string;
  posting_heading?: string;
  posting_hashtags?: string[];
  scheduled_post_time?: string;
  posted_url?: string;
  posted_at?: string;
  posted_urls?: Array<{ url: string; posted_at: string }>;

  // Analytics/Views
  total_views?: number;
  post_views?: number;
  post_likes?: number;
  post_comments?: number;

  // Assignments
  assignments?: ProjectAssignment[];
  videographer?: UserProfile;
  editor?: UserProfile;
  posting_manager?: UserProfile;

  // Skips
  skips?: ProjectSkip[];

  // User info (from joins)
  email?: string;
  full_name?: string;
  avatar_url?: string;

  // Files
  production_files?: ProductionFile[];
  files_count?: number;
  video_duration?: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// PROJECT ASSIGNMENT
// ============================================

export interface ProjectAssignment {
  id: string;
  analysis_id: string;
  user_id: string;
  role: 'VIDEOGRAPHER' | 'EDITOR' | 'POSTING_MANAGER';
  assigned_by: string;
  assigned_at: string;
  created_at: string;
  user?: UserProfile;
}

export interface ProjectSkip {
  id: string;
  analysis_id: string;
  user_id: string;
  role: 'VIDEOGRAPHER' | 'EDITOR';
  skipped_at: string;
  user?: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole;
  is_trusted_writer?: boolean;
}

// ============================================
// PRODUCTION FILES
// ============================================

export type FileType =
  | 'A_ROLL'
  | 'B_ROLL'
  | 'HOOK'
  | 'BODY'
  | 'CTA'
  | 'AUDIO_CLIP'
  | 'RAW_FOOTAGE'
  | 'EDITED_VIDEO'
  | 'FINAL_VIDEO'
  | 'OTHER';

export interface ProductionFile {
  id: string;
  analysis_id: string;
  file_type: FileType;
  file_name: string;
  file_url: string;
  file_id?: string;
  file_size?: number;
  uploaded_by?: string;
  uploaded_at: string;
  is_deleted: boolean;
  mime_type?: string;
  description?: string;
  thumbnail_url?: string;
  created_at: string;
  uploader?: UserProfile;
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface AnalysisFormData {
  // Core fields
  referenceUrl: string;
  title: string;
  shootType: string;
  creatorName: string;
  profileId?: string;
  productionNotes?: string;

  // Script content
  hookText?: string;
  scriptBody?: string;
  scriptCta?: string;
  castComposition?: Partial<CastComposition>;
  characterTagIds?: string[];

  // Additional fields
  platform?: string;
  whyViral?: string;
  targetEmotion?: string;
  hookVoiceNote?: Blob | null;
  whyViralVoiceNote?: Blob | null;
  contentType?: string;
  industryId?: string;
  hookTagIds?: string[];
}

// ============================================
// UI TYPES
// ============================================

export interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  badge?: number;
}

export interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

// Status badge variants
export type StatusVariant = 'pending' | 'approved' | 'rejected' | 'shooting' | 'editing' | 'posted';

export const StatusColors: Record<StatusVariant, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  shooting: 'bg-orange-100 text-orange-800',
  editing: 'bg-purple-100 text-purple-800',
  posted: 'bg-cyan-100 text-cyan-800',
};
