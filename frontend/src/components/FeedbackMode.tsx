/**
 * Feedback Mode Component
 * Real-time CPR feedback with live metrics
 */

import { useState, useEffect, useRef } from 'react';
import { CameraFeed, CPRMetrics } from './CameraFeed';
import { FeedbackPanel } from './FeedbackPanel';
import { Metronome } from './Metronome';
import { screenRecorder } from '../utils/screenRecorder';

interface FeedbackModeProps {
  onBack: () => void;
}

export function FeedbackMode({ onBack }: FeedbackModeProps) {
  const [metrics, setMetrics] = useState<CPRMetrics | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleMetricsUpdate = (newMetrics: CPRMetrics) => {
    setMetrics(newMetrics);
  };

  const handleCanvasReady = (canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    // Start recording automatically when canvas is ready
    startRecording(canvas);
  };

  const startRecording = async (canvas: HTMLCanvasElement) => {
    try {
      await screenRecorder.startRecording(canvas);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleSaveVideo = async () => {
    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `cpr-recording-${timestamp}.webm`;
      
      await screenRecorder.downloadVideo(filename);
    } catch (error) {
      console.error('Failed to save video:', error);
      alert('Failed to save video. Please try again.');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      screenRecorder.stopRecording();
    };
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative">
      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-2 right-2 z-50 px-4 py-2 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-semibold backdrop-blur-sm"
      >
        Back to Menu
      </button>

      {/* Camera feed with pose detection */}
      <CameraFeed 
        onMetricsUpdate={handleMetricsUpdate}
        onCanvasReady={handleCanvasReady}
      />

      {/* Feedback panel */}
      {metrics && (
        <FeedbackPanel
          metrics={metrics}
          metronomeEnabled={metronomeEnabled}
          onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled)}
          onSaveVideo={handleSaveVideo}
        />
      )}

      {/* Metronome */}
      <Metronome
        targetBPM={100}
        currentBPM={metrics?.bpm || 0}
        isActive={true}
        audioEnabled={metronomeEnabled}
      />
    </div>
  );
}

