/**
 * PulseAI - CPR Training App
 * 
 * A web-based CPR training application that provides real-time feedback on:
 * - Compression rate (BPM)
 * - Compression depth (mm)
 * - Hand placement
 * 
 * Technologies:
 * - React + TypeScript + Vite
 * - TensorFlow.js MoveNet for pose detection
 * - OpenCV.js for face blurring
 * - TailwindCSS for styling
 * 
 * Running Instructions:
 * 1. Install dependencies: npm install
 * 2. Start development server: npm run dev
 * 3. Open browser to: http://localhost:5173
 * 4. Allow camera permissions when prompted
 * 
 * Note: This is a training app. Call 911 in real emergencies.
 */

import { useState } from 'react';
import { ModeSelection } from './components/ModeSelection';
import { WalkthroughMode } from './components/WalkthroughMode';
import { FeedbackMode } from './components/FeedbackMode';

export type AppVersion = 'civilian' | 'ambulance';
type AppMode = 'selection' | 'walkthrough' | 'feedback';

function App() {
  const [mode, setMode] = useState<AppMode>('selection');
  const [appVersion, setAppVersion] = useState<AppVersion | null>(null);

  const handleVersionSelect = (version: AppVersion) => {
    setAppVersion(version);
    // Auto-select feedback mode for ambulance, selection for civilian
    if (version === 'ambulance') {
      setMode('feedback');
    } else {
      setMode('selection');
    }
  };

  const handleModeSelect = (selectedMode: 'walkthrough' | 'feedback') => {
    setMode(selectedMode);
  };

  const handleSkipToCompressions = () => {
    setMode('feedback');
  };

  const handleBackToSelection = () => {
    if (appVersion === 'ambulance') {
      // Ambulance goes back to feedback mode (no tutorials)
      setMode('feedback');
    } else {
      setMode('selection');
    }
  };

  const handleBackToVersionSelection = () => {
    setAppVersion(null);
    setMode('selection');
  };

  if (!appVersion) {
    return <ModeSelection onSelectVersion={handleVersionSelect} />;
  }

  if (mode === 'selection') {
    return <ModeSelection onSelectMode={handleModeSelect} appVersion={appVersion} onBack={handleBackToVersionSelection} />;
  }

  if (mode === 'walkthrough') {
    // Only show walkthrough for civilian mode
    if (appVersion === 'civilian') {
      return <WalkthroughMode onSkipToCompressions={handleSkipToCompressions} onBack={handleBackToSelection} appVersion={appVersion} />;
    }
    // Ambulance should not see walkthrough
    return <FeedbackMode onBack={handleBackToSelection} appVersion={appVersion} />;
  }

  return <FeedbackMode onBack={handleBackToSelection} appVersion={appVersion} />;
}

export default App;
