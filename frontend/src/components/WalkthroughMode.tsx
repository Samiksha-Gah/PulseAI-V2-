/**
 * WalkthroughMode Component
 * Clean implementation providing:
 * - Camera preview via CameraFeed
 * - FeedbackPanel when metrics are available
 * - Metronome audio
 * - Guidance panel that auto-hides
 * - Per-second metrics sampling and JSON export
 */

import { useEffect, useRef, useState } from 'react';
import { CameraFeed, CPRMetrics } from './CameraFeed';
import { FeedbackPanel } from './FeedbackPanel';
import { Metronome } from './Metronome';
import { API_ENDPOINTS } from '../config';
import { SummaryModal } from './SummaryModal';


interface WalkthroughModeProps {
  onSkipToCompressions: () => void;
  onBack: () => void;
}

export function WalkthroughMode({ onSkipToCompressions, onBack }: WalkthroughModeProps) {
  // step state was unused in this simplified walkthrough; remove to avoid lint warnings
  const [metrics, setMetrics] = useState<CPRMetrics | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [showGuidance, setShowGuidance] = useState(true);
  const [guidanceDismissed, setGuidanceDismissed] = useState(false);

  const metricsRef = useRef<CPRMetrics | null>(null);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  const recordedDataRef = useRef<Array<{ time: number; iso: string; metrics: CPRMetrics | null }>>([]);
  const samplingIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startSampling = () => {
    if (samplingIntervalRef.current !== null) return;

    recordedDataRef.current.push({ time: Date.now(), iso: new Date().toISOString(), metrics: metricsRef.current || null });

    samplingIntervalRef.current = window.setInterval(() => {
      recordedDataRef.current.push({ time: Date.now(), iso: new Date().toISOString(), metrics: metricsRef.current || null });
    }, 1000) as unknown as number;
  };

  const stopSampling = () => {
    if (samplingIntervalRef.current !== null) {
      clearInterval(samplingIntervalRef.current);
      samplingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopSampling();
    };
  }, []);

  const handleMetricsUpdate = (newMetrics: CPRMetrics) => {
    setMetrics(newMetrics);
  };

  const handleCanvasReady = (canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    startSampling();
  };

  const handleSaveMetrics = () => {
    const data = recordedDataRef.current;
    if (!data || data.length === 0) {
      alert('No metrics recorded yet');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `cpr-metrics-${timestamp}.json`;
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), samples: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Summarize session by sending recorded data to backend AI summarizer
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

  // Auto-dismiss guidance after 10s
  useEffect(() => {
    if (showGuidance && !guidanceDismissed) {
      const timer = setTimeout(() => setShowGuidance(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showGuidance, guidanceDismissed]);

  const handleDismissGuidance = () => {
    setShowGuidance(false);
    setGuidanceDismissed(true);
  };

  const bystanderGuidance = {
    title: 'CPR Steps',
    segments: [
      {
        title: '1. Check Responsiveness',
        instructions: [
          "Tap the person's shoulder firmly",
          'Shout "Are you okay?" loudly',
          'Check for breathing and movement',
          'If no response, proceed to next step',
        ],
      },
      {
        title: '2. Call for Help',
        instructions: [
          'Call 911 immediately',
          'Get an AED if available',
          'Send someone to find help if others are nearby',
          'Put phone on speaker if alone',
        ],
      },
      {
        title: '3. Start Chest Compressions',
        instructions: [
          'Place hands in center of chest',
          'Compress hard and fast (100-120 BPM)',
          'Compress 2 inches deep',
          'Let chest fully rebound between compressions',
          'Continue until help arrives',
        ],
      },
    ],
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative">
      <div className="absolute top-2 right-2 z-50 flex gap-2">
        <button
          onClick={onBack}
          className="px-3 py-2 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-semibold backdrop-blur-sm"
        >
          Back to Menu
        </button>
        <button
          onClick={onSkipToCompressions}
          className="px-3 py-2 bg-blue-700/90 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-semibold backdrop-blur-sm"
        >
          Skip to Compressions
        </button>
      </div>

      <CameraFeed onMetricsUpdate={handleMetricsUpdate} onCanvasReady={handleCanvasReady} />

      {metrics && (
        <FeedbackPanel
          metrics={metrics}
          metronomeEnabled={metronomeEnabled}
          onMetronomeToggle={() => setMetronomeEnabled((s) => !s)}
          onSaveVideo={handleSaveMetrics}
          onSummarizeSession={handleSummarizeSession}
        />
      )}

      <Metronome targetBPM={100} currentBPM={metrics?.bpm || 0} isActive={true} audioEnabled={metronomeEnabled} />

      {showGuidance && (
        <div className="absolute left-0 top-0 bottom-0 md:w-80 w-full md:max-w-sm z-40 flex flex-col p-4 md:p-6">
          <div className="hidden md:block bg-black/70 backdrop-blur-lg rounded-2xl p-4 border-2 border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-white">{bystanderGuidance.title}</h2>
              <button onClick={handleDismissGuidance} className="text-gray-400 hover:text-white transition-colors" aria-label="Close guidance">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-white">
              {bystanderGuidance.segments.map((segment, segmentIndex) => (
                <div key={segmentIndex} className="border-b border-white/10 pb-2.5 last:border-b-0 last:pb-0">
                  <h3 className="text-sm font-semibold text-blue-300 mb-1.5">{segment.title}</h3>
                  <div className="space-y-1">
                    {segment.instructions.map((instruction, index) => (
                      <div key={index} className="flex items-start gap-1.5">
                        <span className="text-blue-400 font-bold mt-0.5 flex-shrink-0 text-xs">•</span>
                        <p className="flex-1 text-blue-100 text-xs leading-tight">{instruction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-white/20">
              <p className="text-[10px] text-gray-400 text-center">Auto-hides in 10s, or click X to dismiss</p>
            </div>
          </div>

          <div className="md:hidden bg-black/90 backdrop-blur-lg rounded-2xl p-4 border-2 border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">{bystanderGuidance.title}</h2>
              <button onClick={handleDismissGuidance} className="text-gray-400 hover:text-white transition-colors" aria-label="Close guidance">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-white">
              {bystanderGuidance.segments.map((segment, segmentIndex) => (
                <div key={segmentIndex} className="border-b border-white/10 pb-2.5 last:border-b-0 last:pb-0">
                  <h3 className="text-sm font-semibold text-blue-300 mb-1.5">{segment.title}</h3>
                  <div className="space-y-1">
                    {segment.instructions.map((instruction, index) => (
                      <div key={index} className="flex items-start gap-1.5">
                        <span className="text-blue-400 font-bold mt-0.5 flex-shrink-0 text-xs">•</span>
                        <p className="flex-1 text-blue-100 text-xs leading-tight">{instruction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

        {/* Summary modal */}
    <SummaryModal isOpen={isSummaryOpen} onClose={() => setIsSummaryOpen(false)} loading={isSummarizing} structured={summaryStructured} raw={summaryRaw} service={summaryService} />
    </div>
  );
}

