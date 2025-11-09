/**
 * Feedback Mode Component
 * Real-time CPR feedback with live metrics
 */

import { useState, useEffect, useRef } from 'react';
import { CameraFeed, CPRMetrics } from './CameraFeed';
import { FeedbackPanel } from './FeedbackPanel';
import { Metronome } from './Metronome';
import { screenRecorder } from '../utils/screenRecorder';
import { audioFeedback } from '../utils/audioFeedback';

interface FeedbackModeProps {
  onBack: () => void;
}

export function FeedbackMode({ onBack }: FeedbackModeProps) {
  const [metrics, setMetrics] = useState<CPRMetrics | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Track previous feedback states to detect changes
  const prevDepthFeedbackRef = useRef<string>('');
  const prevRateFeedbackRef = useRef<string>('');
  const prevPlacementFeedbackRef = useRef<string>('');
  const lastNotificationTimeRef = useRef<{ [key: string]: number }>({});

  const handleMetricsUpdate = (newMetrics: CPRMetrics) => {
    setMetrics(newMetrics);
    
    // Process audio notifications based on metrics
    processAudioFeedback(newMetrics);
  };

  // Process audio notifications with throttling and debouncing
  const processAudioFeedback = (metrics: CPRMetrics) => {
    const now = Date.now();
    const minInterval = 5000; // 5 seconds between notifications of same type

    // Depth feedback
    const depthKey = metrics.depthFeedback.message;
    if (depthKey !== prevDepthFeedbackRef.current) {
      const lastTime = lastNotificationTimeRef.current['depth'] || 0;
      if (now - lastTime > minInterval) {
        let message = '';
        let priority = 3;
        
        if (metrics.depthFeedback.color === 'red') {
          if (metrics.depthMm < 50) {
            message = 'Push deeper';
            priority = 2;
          } else if (metrics.depthMm > 60) {
            message = 'Too deep, ease up slightly';
            priority = 2;
          }
        } else if (metrics.depthFeedback.color === 'green') {
          message = 'Good depth';
          priority = 3;
        }
        
        if (message) {
          audioFeedback.queueNotification(message, 'depth', priority);
          lastNotificationTimeRef.current['depth'] = now;
        }
      }
      prevDepthFeedbackRef.current = depthKey;
    }

    // Rate feedback
    const rateKey = metrics.rateFeedback.message;
    if (rateKey !== prevRateFeedbackRef.current) {
      const lastTime = lastNotificationTimeRef.current['rate'] || 0;
      if (now - lastTime > minInterval) {
        let message = '';
        let priority = 3;
        
        if (metrics.rateFeedback.color === 'red') {
          if (metrics.bpm < 100) {
            message = 'Speed up your compressions';
            priority = 2;
          } else if (metrics.bpm > 120) {
            message = 'Slow down a bit';
            priority = 2;
          }
        } else if (metrics.rateFeedback.color === 'green' && metrics.bpm >= 100) {
          message = 'Perfect rate, keep it up';
          priority = 3;
        }
        
        if (message) {
          audioFeedback.queueNotification(message, 'rate', priority);
          lastNotificationTimeRef.current['rate'] = now;
        }
      }
      prevRateFeedbackRef.current = rateKey;
    }

    // Placement feedback (less frequent, lower priority)
    const placementKey = metrics.placementFeedback.message;
    if (placementKey !== prevPlacementFeedbackRef.current) {
      const lastTime = lastNotificationTimeRef.current['position'] || 0;
      if (now - lastTime > minInterval * 2) { // 10 seconds for placement
        let message = '';
        let priority = 3;
        
        if (metrics.placementFeedback.color === 'orange' || metrics.placementFeedback.color === 'red') {
          message = 'Center your hands on the chest';
          priority = 2;
        }
        
        if (message) {
          audioFeedback.queueNotification(message, 'position', priority);
          lastNotificationTimeRef.current['position'] = now;
        }
      }
      prevPlacementFeedbackRef.current = placementKey;
    }

    // Encouragement every 30 compressions
    if (metrics.compressionCount === 30) {
      const lastTime = lastNotificationTimeRef.current['encouragement'] || 0;
      if (now - lastTime > 30000) { // Once per 30 seconds
        audioFeedback.queueNotification('Great job! Thirty compressions complete', 'encouragement', 3);
        lastNotificationTimeRef.current['encouragement'] = now;
      }
    }
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
      audioFeedback.clearQueue();
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

