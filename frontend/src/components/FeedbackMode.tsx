/**
 * Feedback Mode Component
 * Real-time CPR feedback with live metrics
 * Supports both civilian and ambulance modes
 */

import { useState } from 'react';
import { CameraFeed, CPRMetrics } from './CameraFeed';
import { FeedbackPanel } from './FeedbackPanel';
import { CivilianFeedbackPanel } from './CivilianFeedbackPanel';
import { Metronome } from './Metronome';
import { ControlButtons } from './ControlButtons';
import { UploadMock } from './UploadMock';
import { AppVersion } from '../App';

interface FeedbackModeProps {
  onBack: () => void;
  appVersion: AppVersion;
}

export function FeedbackMode({ onBack, appVersion }: FeedbackModeProps) {
  const [metrics, setMetrics] = useState<CPRMetrics | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(appVersion === 'civilian'); // ON for civilian, OFF for ambulance
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');

  const handleMetricsUpdate = (newMetrics: CPRMetrics) => {
    setMetrics(newMetrics);
  };

  const handleCameraFlip = () => {
    setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Save button clicked', metrics);
  };

  const handleQuery = () => {
    // TODO: Implement query functionality
    console.log('Query button clicked');
  };

  const isCivilian = appVersion === 'civilian';
  const isAmbulance = appVersion === 'ambulance';

  return (
    <div className="w-full h-screen overflow-hidden bg-black relative">
      {/* Warning text and back button - only for civilian mode, positioned below notification bar */}
      {isCivilian && (
        <>
          <div className="absolute top-12 left-2 z-50 text-red-500 text-xs font-semibold">
            Training app—call 911 in real emergencies
          </div>
          <button
            onClick={onBack}
            className="absolute top-12 right-4 z-50 px-4 py-2 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-semibold backdrop-blur-sm"
          >
            Back to Menu
          </button>
        </>
      )}

      {/* Ambulance mode - no warning or back button, but can have a settings/exit button if needed */}
      {isAmbulance && (
        <button
          onClick={onBack}
          className="absolute top-2 right-2 z-50 px-4 py-2 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-semibold backdrop-blur-sm"
        >
          Exit
        </button>
      )}

      {/* Camera feed with pose detection */}
      <CameraFeed 
        onMetricsUpdate={handleMetricsUpdate} 
        facingMode={cameraFacingMode}
      />

      {/* Feedback panel - different UI for civilian vs ambulance */}
      {metrics && (
        <>
          {isCivilian ? (
            <CivilianFeedbackPanel metrics={metrics} />
          ) : (
            <FeedbackPanel metrics={metrics} />
          )}
        </>
      )}

      {/* Metronome - different defaults for civilian vs ambulance */}
      <Metronome
        targetBPM={100}
        currentBPM={metrics?.bpm || 0}
        isActive={metronomeEnabled}
        audioEnabled={false}
      />

      {/* Control buttons - only for civilian mode */}
      {isCivilian && (
        <ControlButtons
          metronomeEnabled={metronomeEnabled}
          onMetronomeToggle={() => setMetronomeEnabled(!metronomeEnabled)}
          onSave={handleSave}
          onQuery={handleQuery}
          onCameraFlip={handleCameraFlip}
        />
      )}

      {/* Upload mock button - only for ambulance */}
      {isAmbulance && <UploadMock />}
    </div>
  );
}

