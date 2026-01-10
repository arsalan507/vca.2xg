export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SCRIPT_WRITER: 'SCRIPT_WRITER',
  CREATOR: 'CREATOR',
  VIDEOGRAPHER: 'VIDEOGRAPHER',
  EDITOR: 'EDITOR',
  POSTING_MANAGER: 'POSTING_MANAGER',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const ProductionStage = {
  NOT_STARTED: 'NOT_STARTED',
  PRE_PRODUCTION: 'PRE_PRODUCTION',
  SHOOTING: 'SHOOTING',
  SHOOT_REVIEW: 'SHOOT_REVIEW',
  EDITING: 'EDITING',
  EDIT_REVIEW: 'EDIT_REVIEW',
  FINAL_REVIEW: 'FINAL_REVIEW',
  READY_TO_POST: 'READY_TO_POST',
  POSTED: 'POSTED',
} as const;

export type ProductionStage = typeof ProductionStage[keyof typeof ProductionStage];

export const Priority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type Priority = typeof Priority[keyof typeof Priority];

export const AssignmentRole = {
  VIDEOGRAPHER: 'VIDEOGRAPHER',
  EDITOR: 'EDITOR',
  POSTING_MANAGER: 'POSTING_MANAGER',
} as const;

export type AssignmentRole = typeof AssignmentRole[keyof typeof AssignmentRole];

export const FileType = {
  RAW_FOOTAGE: 'RAW_FOOTAGE',
  EDITED_VIDEO: 'EDITED_VIDEO',
  FINAL_VIDEO: 'FINAL_VIDEO',
  ASSET: 'ASSET',
  OTHER: 'OTHER',
} as const;

export type FileType = typeof FileType[keyof typeof FileType];

// New types for enhanced script submission
export interface Industry {
  id: string;
  name: string;
  short_code: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HookTag {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileListItem {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterTag {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectAssignment {
  id: string;
  analysis_id: string;
  user_id: string;
  role: AssignmentRole;
  assigned_by: string;
  assigned_at: string;
  created_at: string;
  updated_at: string;
  // Populated user data
  user?: Profile;
  assigned_by_user?: Profile;
}

export interface ViralAnalysis {
  id: string;
  user_id: string;
  reference_url: string;
  hook?: string;
  hook_voice_note_url?: string;
  why_viral?: string;
  why_viral_voice_note_url?: string;
  how_to_replicate?: string;
  how_to_replicate_voice_note_url?: string;
  target_emotion: string;
  expected_outcome: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  updated_at: string;

  // Enhanced script fields
  industry_id?: string;
  content_id?: string; // Auto-generated (e.g., BCH-1001)
  profile_id?: string; // Which profile/admin this is for
  total_people_involved?: number;
  additional_requirements?: string;
  syed_sir_presence?: 'YES' | 'NO';
  planning_date?: string;
  on_screen_text_hook?: string;
  our_idea_audio_url?: string; // Audio recording URL
  shoot_location?: string;
  shoot_possibility?: 25 | 50 | 75 | 100;

  // Populated related data
  industry?: Industry;
  profile?: ProfileListItem;
  hook_tags?: HookTag[]; // Many-to-many
  character_tags?: CharacterTag[]; // Many-to-many

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

  // Production workflow fields
  production_stage?: ProductionStage;
  priority?: Priority;
  deadline?: string;
  budget?: number;
  production_notes?: string;
  production_started_at?: string;
  production_completed_at?: string;

  // Google Drive / File management
  raw_footage_drive_url?: string;
  edited_video_drive_url?: string;
  final_video_url?: string;

  // Assignments
  assignments?: ProjectAssignment[];
  videographer?: Profile;
  editor?: Profile;
  posting_manager?: Profile;

  // Admin view includes user info
  email?: string;
  full_name?: string;
  avatar_url?: string;
  reviewer_name?: string;
  reviewer_email?: string;

  // Files
  production_files?: ProductionFile[];
}

export interface AnalysisFormData {
  // Existing fields
  referenceUrl: string;
  hook: string;
  hookVoiceNote: Blob | null;
  hookVoiceNoteUrl: string;
  whyViral: string;
  whyViralVoiceNote: Blob | null;
  whyViralVoiceNoteUrl: string;
  howToReplicate: string;
  howToReplicateVoiceNote: Blob | null;
  howToReplicateVoiceNoteUrl: string;
  targetEmotion: string;
  expectedOutcome: string;

  // New enhanced fields
  industryId: string;
  profileId: string;
  hookTagIds: string[]; // Multi-select
  totalPeopleInvolved: number;
  characterTagIds: string[]; // Multi-select
  onScreenTextHook: string;
  ourIdeaAudio: Blob | null;
  ourIdeaAudioUrl: string;
  shootLocation: string;
  shootPossibility: 25 | 50 | 75 | 100;
}

export interface ReviewAnalysisData {
  status: 'APPROVED' | 'REJECTED';
  feedback?: string;
  feedbackVoiceNote?: Blob | null;
  hookStrength: number;
  contentQuality: number;
  viralPotential: number;
  replicationClarity: number;
}

export interface AssignTeamData {
  videographerId?: string;
  editorId?: string;
  postingManagerId?: string;
  autoAssignVideographer?: boolean;
}

export interface UpdateProductionStageData {
  production_stage: ProductionStage;
  production_notes?: string;
}

export interface UpdateProductionDetailsData {
  priority?: Priority;
  deadline?: string;
  budget?: number;
  production_notes?: string;
}

export interface ProductionFile {
  id: string;
  analysis_id: string;
  uploaded_by?: string;
  file_name: string;
  file_type: FileType;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  description?: string;
  upload_stage?: ProductionStage;
  is_primary: boolean;
  // Approval fields
  approval_status?: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  // Populated uploader data
  uploader?: Profile;
  reviewer?: Profile;
}

export interface UploadFileData {
  analysisId: string;
  fileName: string;
  fileType: FileType;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  isPrimary?: boolean;
}

// Admin-only fields update
export interface UpdateAdminFieldsData {
  additionalRequirements?: string;
  syedSirPresence?: 'YES' | 'NO';
  planningDate?: string;
}
