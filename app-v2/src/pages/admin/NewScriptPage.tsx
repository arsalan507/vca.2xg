import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Check, Loader2 } from 'lucide-react';
import { analysesService } from '@/services/analysesService';
import { supabase } from '@/lib/api';
import type { AnalysisFormData } from '@/types';
import toast from 'react-hot-toast';

const SHOOT_TYPES = ['Indoor', 'Outdoor', 'Both'];

const YES_NO_MAYBE = ['Yes', 'No', 'Maybe'];

const INITIAL_FORM_DATA: AnalysisFormData = {
  referenceUrl: '',
  title: '',
  shootType: '',
  creatorName: '',
  worksWithoutAudio: '',
};

export default function AdminNewScriptPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<AnalysisFormData>(INITIAL_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof AnalysisFormData>(
    field: K,
    value: AnalysisFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      // Create the script
      const createdScript = await analysesService.createAnalysis(formData);

      // Fast auto-approve: direct status update (admin scripts bypass review)
      await supabase
        .from('viral_analyses')
        .update({
          status: 'APPROVED',
          production_stage: 'PLANNING',
        })
        .eq('id', createdScript.id);

      toast.success('Script created and auto-approved! ✓');
      navigate('/admin');
    } catch (error) {
      console.error('Failed to create script:', error);
      toast.error('Failed to create script');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          onClick={() => navigate('/admin')}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900">New Script</h1>
        <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
          Auto-Approve
        </span>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3 px-4"
      >
        {/* Reference URL */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">
            Reference Link
          </label>
          <input
            type="url"
            value={formData.referenceUrl}
            onChange={(e) => updateField('referenceUrl', e.target.value)}
            placeholder="Paste video link..."
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Give this content a title"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Shoot Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
            Shoot Type
          </label>
          <div className="flex gap-2">
            {SHOOT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => updateField('shootType', type)}
                className={`px-4 py-2 rounded-full font-medium text-xs transition-all active:scale-95 ${
                  formData.shootType === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {type === 'Indoor' ? '🏠' : type === 'Outdoor' ? '🌳' : '🏠🌳'} {type}
              </button>
            ))}
          </div>
        </div>

        {/* Creator Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">
            Creator Name
          </label>
          <input
            type="text"
            value={formData.creatorName}
            onChange={(e) => updateField('creatorName', e.target.value)}
            placeholder="@username or channel name"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Works Without Audio */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1.5">
            Works Without Audio?
          </label>
          <div className="flex gap-2">
            {YES_NO_MAYBE.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('worksWithoutAudio', option)}
                className={`px-4 py-2 rounded-full font-medium text-xs transition-all active:scale-95 ${
                  formData.worksWithoutAudio === option
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Notes for Team */}
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">
            Notes for Team
          </label>
          <p className="text-[11px] text-gray-500 mb-1.5">
            Instructions for the videographer & editor
          </p>
          <textarea
            value={formData.productionNotes || ''}
            onChange={(e) => updateField('productionNotes', e.target.value)}
            placeholder="E.g. shoot close-up first, use warm lighting, add subtitles..."
            rows={3}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:bg-blue-600 disabled:opacity-50 mt-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Create Script
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
