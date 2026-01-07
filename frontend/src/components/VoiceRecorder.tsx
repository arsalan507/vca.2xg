import { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, PlayIcon, TrashIcon } from '@heroicons/react/24/outline';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, audioUrl: string) => void;
  existingAudioUrl?: string;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
}

export default function VoiceRecorder({
  onRecordingComplete,
  existingAudioUrl,
  onClear,
  label = 'Voice Note',
  placeholder = 'Record a voice note',
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAudioUrl || null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (existingAudioUrl) {
      setAudioUrl(existingAudioUrl);
    }
  }, [existingAudioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl && !existingAudioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, existingAudioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        onRecordingComplete(audioBlob, url);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl || '');
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const clearRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrl && !existingAudioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingTime(0);
    if (onClear) {
      onClear();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}

      {!audioUrl ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
          {!isRecording ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <MicrophoneIcon className="w-5 h-5" />
                <span>Start Recording</span>
              </button>
              <p className="text-xs text-gray-500">{placeholder}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-lg font-mono font-semibold text-gray-900">
                  {formatTime(recordingTime)}
                </span>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition"
              >
                <StopIcon className="w-5 h-5" />
                <span>Stop Recording</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <button
                type="button"
                onClick={togglePlayback}
                className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition"
              >
                <PlayIcon className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Voice Note Recorded</div>
                <div className="text-xs text-gray-500">
                  {recordingTime > 0 ? formatTime(recordingTime) : 'Click play to listen'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={clearRecording}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
