export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
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
}

export interface AnalysisFormData {
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
}
