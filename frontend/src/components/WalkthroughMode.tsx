/**
 * Bystander Mode Component
 * Step-by-step CPR instructions with immediate camera analysis
 */

import { useState, useEffect, useRef } from 'react';
import { CameraFeed, CPRMetrics } from './CameraFeed';
import { FeedbackPanel } from './FeedbackPanel';
import { Metronome } from './Metronome';

type WalkthroughStep =
  | 'welcome'
  | 'check'
  | 'call'
  | 'position'
  | 'compressions'
  | 'breaths'
  | 'continue';

interface WalkthroughModeProps {
  onSkipToCompressions: () => void;
  onBack: () => void;
}

export function WalkthroughMode({ onSkipToCompressions, onBack }: WalkthroughModeProps) {
  const [currentStep, setCurrentStep] = useState<WalkthroughStep>('compressions'); // Start at compressions
  const [metrics, setMetrics] = useState<CPRMetrics | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [showGuidance, setShowGuidance] = useState(true);
  const [guidanceDismissed, setGuidanceDismissed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  const steps: Record<WalkthroughStep, { title: string; instructions: string[] }> = {
    welcome: {
      title: 'CPR Training',
      instructions: [
        'Learn proper CPR step by step',
        'Follow the instructions on each screen',
        'Click "Next Step" to continue',
      ],
    },
    check: {
      title: 'Check Responsiveness',
      instructions: [
        'Tap their shoulder',
        'Shout "Are you okay?"',
        'If no response, continue',
      ],
    },
    call: {
      title: 'Call 911',
      instructions: [
        'Call 911 immediately',
        'Get an AED if available',
        'Start CPR right away',
      ],
    },
    position: {
      title: 'Hand Position',
      instructions: [
        'Place hands in center of chest',
        'One hand on top of the other',
        'Keep arms straight',
      ],
    },
    compressions: {
      title: 'Perform Compressions',
      instructions: [
        'Compress hard and fast',
        'Aim for 120 compressions per minute',
        'Compress 2 inches deep',
        'Let chest fully rebound',
      ],
    },
    breaths: {
      title: 'Rescue Breaths (Optional)',
      instructions: [
        'After 30 compressions, give 2 breaths',
        'Tilt head back, lift chin',
        'Pinch nose and breathe for 1 second',
        'If not trained, continue hands-only CPR',
      ],
    },
    continue: {
      title: 'Continue CPR',
      instructions: [
        'Keep doing 30 compressions',
        'Give 2 breaths if trained',
        'Continue until help arrives',
      ],
    },
  };

  const handleMetricsUpdate = (newMetrics: CPRMetrics) => {
    setMetrics(newMetrics);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSampling();
    };
  }, []);


  // Auto-dismiss guidance after 10 seconds
  useEffect(() => {
    if (showGuidance && !guidanceDismissed) {
      const timer = setTimeout(() => {
        setShowGuidance(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showGuidance, guidanceDismissed]);

  const handleDismissGuidance = () => {
    setShowGuidance(false);
    setGuidanceDismissed(true);
  };

  // Create combined guidance for Bystander Mode with 3 segments
  const bystanderGuidance = {
    title: 'CPR Steps',
    segments: [
      {
        title: '1. Check Responsiveness',
        instructions: [
          'Tap the person\'s shoulder firmly',
          'Shout "Are you okay?" loudly',
          'Check for breathing and movement',
          'If no response, proceed to next step'
        ]
      },
      {
        title: '2. Call for Help',
        instructions: [
          'Call 911 immediately',
          'Get an AED if available',
          'Send someone to find help if others are nearby',
          'Put phone on speaker if alone'
        ]
      },
      {
        title: '3. Start Chest Compressions',
        instructions: [
          'Place hands in center of chest',
          'Compress hard and fast (100-120 BPM)',
          'Compress 2 inches deep',
          'Let chest fully rebound between compressions',
          'Continue until help arrives'
        ]
      }
    ]
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative">
      {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-2 right-2 z-50 px-4 py-2 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-semibold backdrop-blur-sm"
        >
          Back to Menu
        </button>

      {/* Camera view - always visible */}
          <CameraFeed 
            onMetricsUpdate={handleMetricsUpdate}
            onCanvasReady={handleCanvasReady}
          />
      
          {metrics && (
            <FeedbackPanel
              metrics={metrics}
              metronomeEnabled={metronomeEnabled}
              onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled)}
              onSaveVideo={handleSaveVideo}
            />
          )}
      
          <Metronome
            targetBPM={100}
            currentBPM={metrics?.bpm || 0}
            isActive={true}
            audioEnabled={metronomeEnabled}
          />

      {/* Guidance panel - left side on desktop, overlay on mobile */}
      {showGuidance && (
        <div className="absolute left-0 top-0 bottom-0 md:w-80 w-full md:max-w-sm z-40 flex flex-col p-4 md:p-6">
          {/* Desktop: Semi-transparent box on left */}
          <div className="hidden md:block bg-black/70 backdrop-blur-lg rounded-2xl p-4 border-2 border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-white">{bystanderGuidance.title}</h2>
              <button
                onClick={handleDismissGuidance}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close guidance"
              >
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
              <p className="text-[10px] text-gray-400 text-center">
                Auto-hides in 10s, or click X to dismiss
              </p>
            </div>
          </div>

          {/* Mobile: Overlay */}
          <div className="md:hidden bg-black/90 backdrop-blur-lg rounded-2xl p-4 border-2 border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">{bystanderGuidance.title}</h2>
              <button
                onClick={handleDismissGuidance}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close guidance"
              >
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
    </div>
  );
}

