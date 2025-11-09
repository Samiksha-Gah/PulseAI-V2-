/**
 * EMT Mode Component
 * Advanced real-time CPR feedback with live metrics for trained professionals
 */

import { useState, useEffect, useRef } from 'react';
import { CameraFeed, CPRMetrics } from './CameraFeed';
import { FeedbackPanel } from './FeedbackPanel';
import { Metronome } from './Metronome';
import { API_ENDPOINTS } from '../config';
import { SummaryModal } from './SummaryModal';
// Recording of video removed. We now sample metrics per-second and export JSON.
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

  // Keep a ref to latest metrics for sampling (avoid stale closures)
  const metricsRef = useRef<CPRMetrics | null>(null);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  // Recorded data (one entry per second): { time, iso, metrics }
  const recordedDataRef = useRef<Array<{ time: number; iso: string; metrics: CPRMetrics | null }>>([]);
  const samplingIntervalRef = useRef<number | null>(null);

  const startSampling = () => {
    // Don't start if already sampling
    if (samplingIntervalRef.current !== null) return;

    // Push an immediate sample
    recordedDataRef.current.push({
      time: Date.now(),
      iso: new Date().toISOString(),
      metrics: metricsRef.current || null,
    });

    // Sample every 1000ms
    samplingIntervalRef.current = window.setInterval(() => {
      recordedDataRef.current.push({
        time: Date.now(),
        iso: new Date().toISOString(),
        metrics: metricsRef.current || null,
      });
    }, 1000) as unknown as number;
  };

  const stopSampling = () => {
    if (samplingIntervalRef.current !== null) {
      clearInterval(samplingIntervalRef.current);
      samplingIntervalRef.current = null;
    }
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
            message = 'Compress deeper';
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
    // Start per-second metrics sampling automatically when canvas is ready
    startSampling();
  };

  const handleSaveVideo = async () => {
    try {
      // Download JSON of per-second sampled metrics
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `cpr-metrics-${timestamp}.json`;

      const data = recordedDataRef.current;
      if (!data || data.length === 0) {
        alert('No metrics recorded yet');
        return;
      }

      const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), samples: data }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to save metrics JSON:', error);
      alert('Failed to save metrics. Please try again.');
    }
  };

  // Summarize session logic (similar to WalkthroughMode)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryStructured, setSummaryStructured] = useState<any | null>(null);
  const [summaryRaw, setSummaryRaw] = useState<string | null>(null);
  const [summaryService, setSummaryService] = useState<string | null>(null);

  const handleSummarizeSession = async () => {
    const data = recordedDataRef.current;
    if (!data || data.length === 0) {
      alert('No metrics recorded yet to summarize');
      return;
    }

  setIsSummarizing(true);
  setIsSummaryOpen(true);
  setSummaryStructured(null);
  setSummaryRaw(null);
  setSummaryService(null);

    try {
      const resp = await fetch(API_ENDPOINTS.summarize, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedAt: new Date().toISOString(), samples: data }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '<no body>');
        throw new Error(`Summarize request failed: ${resp.status} ${errText}`);
      }

      const json = await resp.json();
      setSummaryStructured(json.structured || null);
      setSummaryRaw(json.raw || null);
      setSummaryService(json.service || null);
    } catch (err) {
      console.error('Failed to summarize session:', err);
      setSummaryRaw(`Failed to generate summary: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Reset audio feedback timing when component mounts
  useEffect(() => {
    audioFeedback.resetTiming();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSampling();
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
          onSummarizeSession={handleSummarizeSession}
        />
      )}

  <SummaryModal isOpen={isSummaryOpen} onClose={() => setIsSummaryOpen(false)} loading={isSummarizing} structured={summaryStructured} raw={summaryRaw} service={summaryService} />

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

