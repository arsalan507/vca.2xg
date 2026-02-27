import { supabase } from '@/lib/api';

export interface SvScript {
  id: string;
  title: string;
  hook: string;
  story: string;
  cta: string;
  tags: string[];
  rating: number;
  shot_done: boolean;
  created_at: string;
  updated_at: string;
  relevance_score?: number;
}

export interface SvSynonym {
  id: number;
  canonical: string;
  synonym: string;
  language: string;
}

export interface SvScriptInput {
  title: string;
  hook: string;
  story?: string;
  cta?: string;
  tags?: string[];
  rating?: number;
}

// Module-level synonym cache
let _synonymCache: SvSynonym[] | null = null;

export const scriptVaultService = {
  async getSynonyms(): Promise<SvSynonym[]> {
    if (_synonymCache) return _synonymCache;

    const { data, error } = await supabase
      .from('sv_synonyms')
      .select('*');

    if (error) throw error;
    _synonymCache = (data || []) as SvSynonym[];
    return _synonymCache;
  },

  async searchScripts(queryText: string, expandedTerms: string[]): Promise<SvScript[]> {
    const { data, error } = await supabase.rpc('search_scripts', {
      query_text: queryText,
      expanded_terms: expandedTerms,
    });

    if (error) throw error;
    return (data || []) as SvScript[];
  },

  async getAllScripts(): Promise<SvScript[]> {
    const { data, error } = await supabase
      .from('sv_scripts')
      .select('*')
      .order('shot_done', { ascending: true })
      .order('rating', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as SvScript[];
  },

  async addScript(input: SvScriptInput): Promise<SvScript> {
    const { data, error } = await supabase
      .from('sv_scripts')
      .insert({
        title: input.title,
        hook: input.hook,
        story: input.story || '',
        cta: input.cta || '',
        tags: input.tags || [],
        rating: input.rating || 0,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as SvScript;
  },

  async updateScript(id: string, input: Partial<SvScriptInput>): Promise<SvScript> {
    const { data, error } = await supabase
      .from('sv_scripts')
      .update(input as Record<string, unknown>)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as SvScript;
  },

  async deleteScript(id: string): Promise<void> {
    const { error } = await supabase
      .from('sv_scripts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleShotDone(id: string, current: boolean): Promise<SvScript> {
    const { data, error } = await supabase
      .from('sv_scripts')
      .update({ shot_done: !current })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as SvScript;
  },

  async updateRating(id: string, rating: number): Promise<SvScript> {
    const { data, error } = await supabase
      .from('sv_scripts')
      .update({ rating })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as SvScript;
  },
};
