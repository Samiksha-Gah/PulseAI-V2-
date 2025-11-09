/**
 * Feedback Mode Component
 * Real-time CPR feedback with live metrics
 */

import { useState } from 'react';
import { CameraFeed, CPRMetrics } from './CameraFeed';
import { FeedbackPanel } from './FeedbackPanel';
import { Metronome } from './Metronome';

interface FeedbackModeProps {
  onBack: () => void;
}

export function FeedbackMode({ onBack }: FeedbackModeProps) {
  const [metrics, setMetrics] = useState<CPRMetrics | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);

  const handleMetricsUpdate = (newMetrics: CPRMetrics) => {
    setMetrics(newMetrics);
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

      {/* Camera feed with pose detection */}
      <CameraFeed onMetricsUpdate={handleMetricsUpdate} />

      {/* Feedback panel */}
      {metrics && (
        <FeedbackPanel
          metrics={metrics}
          metronomeEnabled={metronomeEnabled}
          onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled)}
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

