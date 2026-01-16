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
  // Video components
  A_ROLL: 'A_ROLL',           // Main footage/talking head
  B_ROLL: 'B_ROLL',           // Supporting/overlay footage
  HOOK: 'HOOK',               // First 3-6 seconds
  BODY: 'BODY',               // Main content
  CTA: 'CTA',                 // Call to action

  // Audio
  AUDIO_CLIP: 'AUDIO_CLIP',   // Audio files/voiceovers

  // Legacy types (kept for backward compatibility)
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

  // Level 1: Basic Info (9 fields)
  platform?: string;
  content_type?: string;
  shoot_type?: string;
  characters_involved?: string;
  creator_name?: string;
  unusual_element?: string;
  works_without_audio?: string;
  content_rating?: number;
  replication_strength?: number;

  // Level 2: Emotional & Physical Reactions (9 fields)
  body_reactions?: string[];
  emotion_first_6_sec?: string;
  challenged_belief?: string;
  emotional_identity_impact?: string[];
  if_he_can_why_cant_you?: string;
  feel_like_commenting?: string;
  read_comments?: string;
  sharing_number?: number;
  video_action?: string;

  // Level 2: Production Details (6 fields)
  industry_id?: string;
  profile_id?: string;
  total_people_involved?: number;
  shoot_possibility?: 25 | 50 | 75 | 100;

  // Level 3: Hook Study & Analysis (21 fields)
  stop_feel?: string;
  stop_feel_explanation?: string;
  stop_feel_audio_url?: string;
  immediate_understanding?: string;
  immediate_understanding_audio_url?: string;
  hook_carrier?: string;
  hook_carrier_audio_url?: string;
  hook_without_audio?: string;
  hook_without_audio_recording_url?: string;
  audio_alone_stops_scroll?: string;
  audio_alone_stops_scroll_recording_url?: string;
  dominant_emotion_first_6?: string;
  dominant_emotion_first_6_audio_url?: string;
  understanding_by_second_6?: string;
  understanding_by_second_6_audio_url?: string;
  content_rating_level_3?: number;

  // Level 3: Production Planning (6 fields)
  on_screen_text_hook?: string;
  our_idea_audio_url?: string;
  shoot_location?: string;
  planning_date?: string;
  additional_requirements?: string;

  // System fields
  content_id?: string; // Auto-generated (e.g., BCH-1001)
  syed_sir_presence?: 'YES' | 'NO';

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

  // Rejection and dissolution tracking
  rejection_count?: number;
  is_dissolved?: boolean;
  dissolution_reason?: string;

  // Disapproval tracking (for approved scripts sent back)
  disapproval_count?: number;
  last_disapproved_at?: string;
  disapproval_reason?: string;

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

  // New Level 1 fields
  platform: string;
  contentType: string;
  shootType: string;
  charactersInvolved: string;
  creatorName: string;
  unusualElement: string;
  worksWithoutAudio: string;
  contentRating: number;
  replicationStrength: number;

  // Level 2 fields - Emotional & Physical Reactions
  bodyReactions: string[]; // Multi-select: Breath held, Leaned closer, etc.
  emotionFirst6Sec: string; // Shock, Curiosity, Fear, etc.
  challengedBelief: string; // Yes/No
  emotionalIdentityImpact: string[]; // Multi-select: Inspired, Inferior, etc.
  ifHeCanWhyCantYou: string; // Yes/No
  feelLikeCommenting: string; // Yes/No
  readComments: string; // Yes/No
  sharingNumber: number; // Numeric count
  videoAction: string; // None, Follow, Learn more, Buy, Try it

  // Level 2 fields - Production Details
  industryId: string;
  profileId: string;
  hookTagIds: string[]; // Multi-select
  totalPeopleInvolved: number;
  characterTagIds: string[]; // Multi-select
  shootPossibility: 25 | 50 | 75 | 100;

  // Level 3 fields - Hook Study & Analysis
  stopFeel: string; // Reflexive/Conscious/Weak pause
  stopFeelExplanation: string;
  stopFeelAudio: Blob | null;
  stopFeelAudioUrl: string;
  immediateUnderstanding: string;
  immediateUnderstandingAudio: Blob | null;
  immediateUnderstandingAudioUrl: string;
  hookCarrier: string;
  hookCarrierAudio: Blob | null;
  hookCarrierAudioUrl: string;
  hookWithoutAudio: string;
  hookWithoutAudioRecording: Blob | null;
  hookWithoutAudioRecordingUrl: string;
  audioAloneStopsScroll: string;
  audioAloneStopsScrollRecording: Blob | null;
  audioAloneStopsScrollRecordingUrl: string;
  dominantEmotionFirst6: string;
  dominantEmotionFirst6Audio: Blob | null;
  dominantEmotionFirst6AudioUrl: string;
  understandingBySecond6: string;
  understandingBySecond6Audio: Blob | null;
  understandingBySecond6AudioUrl: string;
  contentRatingLevel3: number;

  // Level 3 fields - Production Planning
  onScreenTextHook: string;
  ourIdeaAudio: Blob | null;
  ourIdeaAudioUrl: string;
  shootLocation: string;
  planningDate: string;
  additionalRequirements: string;

  // Custom fields from Form Builder (dynamic)
  [key: string]: any; // Allow any custom field
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
  autoAssignEditor?: boolean;
  autoAssignPostingManager?: boolean;
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
  file_type: 'raw-footage' | 'edited-video' | 'final-video';
  file_name: string;
  file_url: string;
  file_id: string; // Google Drive or Supabase Storage file ID
  file_size?: number;
  uploaded_by?: string;
  uploaded_at: string;
  is_deleted: boolean;
  deleted_at?: string;
  mime_type?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  // Populated uploader data
  uploader?: Profile;
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
