/**
 * Feedback Panel Component
 * Displays comprehensive CPR feedback with modern UI and color-coded auras
 */

import { useEffect, useState, useRef } from 'react';
import { CPRMetrics } from '../utils/cprLogic';
import { motion } from 'framer-motion';
import { audioFeedback } from '../utils/audioFeedback';
import { AskQuestionModal } from './AskQuestionModal';
import { audioMetronome } from '../utils/audioMetronome';
export interface FeedbackPanelProps {
  metrics: CPRMetrics;
  metronomeEnabled?: boolean;
  onMetronomeToggle?: () => void;
  onSaveVideo?: () => void;
  onSummarizeSession?: () => Promise<void>;
}

export function FeedbackPanel({ metrics, metronomeEnabled, onMetronomeToggle, onSaveVideo, onSummarizeSession }: FeedbackPanelProps) {
  const { bpm, depthMm, placement, compressionCount, rateFeedback, depthFeedback, placementFeedback } = metrics;
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askModalMode, setAskModalMode] = useState<'typing' | 'voice' | undefined>(undefined);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const analysisStartTimeRef = useRef<number | null>(null);
  const errorStartTimeRef = useRef<number | null>(null); // Track when errors started
  const hasShownStartMessageRef = useRef<boolean>(false); // Track if we've shown "start compressions"
  const lastNotificationTimeRef = useRef<number>(0); // Track last notification time
  const ERROR_DURATION_MS = 5000; // 5 seconds of continuous errors before notification
  const NOTIFICATION_COOLDOWN_MS = 5000; // 5 seconds between notifications

  // Handle muting metronome when asking a question
  const handleAskStart = () => {
    // Stop metronome audio (visual will continue)
    // The Metronome component will automatically restart audio if metronomeEnabled is still true
    audioMetronome.stop();
  };

  const handleAskEnd = () => {
    // Metronome will resume automatically if it was enabled
    // The audioFeedback.askQuestion already resumes audioFeedback
  };

  // Track when CPR analysis starts (when metrics first become available)
  useEffect(() => {
    if (analysisStartTimeRef.current === null && (bpm > 0 || compressionCount > 0)) {
      analysisStartTimeRef.current = Date.now();
      console.log('[FeedbackPanel] CPR analysis started');
      // Show "start compressions" as first message
      if (!hasShownStartMessageRef.current) {
        audioFeedback.queueNotification('Start compressions', 'encouragement', 3);
        hasShownStartMessageRef.current = true;
        lastNotificationTimeRef.current = Date.now();
      }
    }
  }, [bpm, compressionCount]);

  // Show feedback only if errors persist for 5 seconds
  useEffect(() => {
    if (analysisStartTimeRef.current === null) {
      return; // Analysis hasn't started yet
    }

    const now = Date.now();
    const priorities = [
      { feedback: rateFeedback, name: 'rate' },
      { feedback: depthFeedback, name: 'depth' },
      { feedback: placementFeedback, name: 'placement' },
    ];

    // Sort by priority (highest first)
    priorities.sort((a, b) => b.feedback.priority - a.feedback.priority);
    const topPriority = priorities[0];

    // Check if there are any errors (priority > 1 means there's an issue)
    const hasErrors = priorities.some(p => p.feedback.priority > 1);
    const allGood = priorities.every(p => p.feedback.priority <= 1);

    if (allGood) {
      // Reset error timer if doing correctly
      errorStartTimeRef.current = null;
      // Don't give constant reminders that CPR is being done well
      return;
    }

    // If there are errors, track when they started
    if (hasErrors && errorStartTimeRef.current === null) {
      errorStartTimeRef.current = now;
      return; // Wait for 5 seconds before notifying
    }

    // If errors have been ongoing for 5+ seconds, and enough time has passed since last notification
    if (errorStartTimeRef.current !== null && hasErrors) {
      const errorDuration = now - errorStartTimeRef.current;
      const timeSinceLastNotification = now - lastNotificationTimeRef.current;

      if (errorDuration >= ERROR_DURATION_MS && timeSinceLastNotification >= NOTIFICATION_COOLDOWN_MS) {
        // Show notification for the highest priority issue
        audioFeedback.queueNotification(
          topPriority.feedback.message,
          topPriority.name as 'depth' | 'rate' | 'position',
          topPriority.feedback.priority
        );
        lastNotificationTimeRef.current = now;
        // Reset error timer after notification (will restart if errors continue)
        errorStartTimeRef.current = now;
      }
    } else if (!hasErrors) {
      // Reset error timer if errors are fixed
      errorStartTimeRef.current = null;
    }
  }, [rateFeedback, depthFeedback, placementFeedback]);


  // Color mapping for status with auras
  type ColorKey = 'green' | 'orange' | 'red';
  
  const colorClasses: Record<ColorKey, string> = {
    green: 'bg-green-500/90 border-green-400',
    orange: 'bg-orange-500/90 border-orange-400',
    red: 'bg-red-500/90 border-red-400',
  } as const;

  const textColorClasses: Record<ColorKey, string> = {
    green: 'text-green-100',
    orange: 'text-orange-100',
    red: 'text-red-100',
  };

  const iconColorClasses: Record<ColorKey, string> = {
    green: 'text-green-300',
    orange: 'text-orange-300',
    red: 'text-red-300',
  };

  const auraColors: Record<ColorKey, string> = {
    green: 'rgba(34, 197, 94, 0.3)',
    orange: 'rgba(249, 115, 22, 0.3)',
    red: 'rgba(239, 68, 68, 0.3)',
  };
  
  // Get the highest priority feedback
  const getTopFeedback = () => {
    const priorities = [
      { feedback: rateFeedback, name: 'rate' },
      { feedback: depthFeedback, name: 'depth' },
      { feedback: placementFeedback, name: 'placement' },
    ];
    
    // Sort by priority (highest first)
    priorities.sort((a, b) => b.feedback.priority - a.feedback.priority);
    
    // Return the top priority feedback
    return priorities[0].feedback;
  };
  
  const topFeedback = getTopFeedback();
  const feedbackColor = topFeedback.color as ColorKey;

  const compressionProgress = Math.min((compressionCount / 30) * 100, 100);
  const isComplete = compressionCount >= 30;

  return (
    <>
      {/* Main feedback banner - top center with color-coded aura */}
      <motion.div
        animate={{
          boxShadow: [
            `0 0 20px ${auraColors[feedbackColor]}`,
            `0 0 40px ${auraColors[feedbackColor]}`,
            `0 0 20px ${auraColors[feedbackColor]}`,
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-40 px-6 py-4 rounded-xl shadow-2xl border-2 ${colorClasses[feedbackColor]} ${textColorClasses[feedbackColor]} backdrop-blur-md min-w-[300px] max-w-[600px]`}
        style={{
          boxShadow: `0 0 30px ${auraColors[feedbackColor]}`,
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <div className={`text-2xl ${iconColorClasses[feedbackColor]}`}>
            {feedbackColor === 'green' && '✓'}
            {feedbackColor === 'orange' && '⚠'}
            {feedbackColor === 'red' && '✕'}
          </div>
          <p className="font-semibold text-lg text-center">{topFeedback.message}</p>
        </div>
      </motion.div>

      {/* Data Panel - Bottom bar on mobile, middle right on desktop */}
      <div className="fixed bottom-0 left-0 right-0 md:bottom-auto md:right-4 md:top-1/2 md:left-auto md:-translate-y-1/2 z-40 md:w-[280px]">
        <motion.div
          animate={{
            boxShadow: [
              `0 0 20px rgba(0, 0, 0, 0.5)`,
              `0 0 30px rgba(0, 0, 0, 0.5)`,
              `0 0 20px rgba(0, 0, 0, 0.5)`,
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="bg-black/70 backdrop-blur-lg rounded-t-2xl md:rounded-2xl p-2 md:p-5 border-t-2 md:border-2 border-white/20 shadow-2xl"
        >
          {/* Warning notification - only show on desktop */}
          <div className="hidden md:block mb-4 pb-3 bg-red-500/30 rounded-lg px-3 py-2 border border-red-500/50">
            <p className="text-xs font-bold text-white">Training app—call 911 in real emergencies</p>
          </div>
          
          {/* Desktop: Keep original layout */}
          <div className="hidden md:block">
            <div className="mb-4 pb-3 border-b border-white/20">
              <h3 className="text-lg font-bold text-white uppercase tracking-wide">Data</h3>
            </div>
            <div className="space-y-4">
              {/* Rate */}
              <div className="border-b border-white/10 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Rate</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      rateFeedback.color === 'green'
                        ? 'bg-green-500/30 text-green-300'
                        : rateFeedback.color === 'orange'
                        ? 'bg-orange-500/30 text-orange-300'
                        : 'bg-red-500/30 text-red-300'
                    }`}
                  >
                    {rateFeedback.color === 'green' ? 'Good' : rateFeedback.color === 'orange' ? 'Warning' : 'Critical'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{bpm || '--'} BPM</div>
                <div className="text-xs text-gray-400">Target: 100-120 BPM</div>
              </div>

              {/* Depth */}
              <div className="border-b border-white/10 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Depth</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      depthFeedback.color === 'green'
                        ? 'bg-green-500/30 text-green-300'
                        : depthFeedback.color === 'orange'
                        ? 'bg-orange-500/30 text-orange-300'
                        : 'bg-red-500/30 text-red-300'
                    }`}
                  >
                    {depthFeedback.color === 'green' ? 'Good' : depthFeedback.color === 'orange' ? 'Warning' : 'Critical'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{depthMm || '--'}mm</div>
                <div className="text-xs text-gray-400">Target: 50-60mm</div>
              </div>

              {/* Compressions */}
              <div className="border-b border-white/10 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Compressions</span>
                  {isComplete && (
                    <span className="text-xs px-2 py-1 rounded bg-green-500/30 text-green-300">
                      Complete
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-white mb-2">
                  <span className={isComplete ? 'text-green-400' : 'text-blue-400'}>
                    {compressionCount}
                  </span>
                  <span className="text-gray-500">/30</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isComplete ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${compressionProgress}%` }}
                  />
                </div>
              </div>

              {/* Placement */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Placement</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      placementFeedback.color === 'green'
                        ? 'bg-green-500/30 text-green-300'
                        : placementFeedback.color === 'orange'
                        ? 'bg-orange-500/30 text-orange-300'
                        : 'bg-red-500/30 text-red-300'
                    }`}
                  >
                    {placement === 'Good' ? 'Good' : 'Off-center'}
                  </span>
                </div>
                <div
                  className={`text-lg font-semibold mb-1 ${
                    placement === 'Good' ? 'text-green-400' : 'text-orange-400'
                  }`}
                >
                  {placement}
                </div>
                <div className="text-xs text-gray-400">{placementFeedback.message}</div>
              </div>

              {/* Metronome and Save buttons */}
              <div className="pt-4 mt-4 border-t border-white/20">
                <div className="grid grid-cols-2 gap-3">
                  {/* Metronome toggle button */}
                  {onMetronomeToggle ? (
                    <button
                      onClick={onMetronomeToggle}
                      className="px-3 py-2.5 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 transition-colors font-semibold text-sm flex items-center justify-center gap-1.5"
                    >
                      <span className="text-lg">{metronomeEnabled ? '🔊' : '🔇'}</span>
                      <span className="text-xs">{metronomeEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                  ) : (
                    <div></div>
                  )}
                  
                  {/* Save Video button - always visible */}
                  <button
                    onClick={onSaveVideo || (() => {})}
                    disabled={!onSaveVideo}
                    className="px-3 py-2.5 bg-blue-600/80 hover:bg-blue-700/80 disabled:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="text-xs">Save</span>
                  </button>
                </div>
                
                {/* Ask Question buttons - two buttons side by side */}
                <div className="w-full mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setAskModalMode('typing');
                      setIsAskModalOpen(true);
                    }}
                    className="flex-1 px-2 py-2.5 bg-purple-600/80 hover:bg-purple-700/80 text-white rounded-lg transition-colors font-semibold text-xs flex items-center justify-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-[10px]">Type Question</span>
                  </button>
                  <button
                    onClick={() => {
                      setAskModalMode('voice');
                      setIsAskModalOpen(true);
                    }}
                    className="flex-1 px-2 py-2.5 bg-purple-600/80 hover:bg-purple-700/80 text-white rounded-lg transition-colors font-semibold text-xs flex items-center justify-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                    <span className="text-[10px]">Voice Question</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (!onSummarizeSession) return;
                      try {
                        setIsSummarizing(true);
                        await onSummarizeSession();
                      } catch (err) {
                        console.error('[FeedbackPanel] Summarize failed', err);
                      } finally {
                        setIsSummarizing(false);
                      }
                    }}
                    disabled={!onSummarizeSession}
                    className="px-3 py-2 bg-indigo-600/90 text-white rounded-lg hover:bg-indigo-500 transition-colors text-xs font-semibold"
                  >
                    {isSummarizing ? 'Summarizing...' : 'Summarize Session'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: Compressed bottom bar layout */}
          <div className="md:hidden">
            {/* Warning notification at top - red section above dashboard */}
            <div className="mb-2 pb-1.5 bg-red-500/40 rounded-lg px-2 py-1.5 border-2 border-red-500/60">
              <p className="text-[10px] font-bold text-white text-center">Training app—call 911 in real emergencies</p>
            </div>
            
            {/* Main data grid: 2 columns */}
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              {/* Left Column: Rate */}
              <div className="border-r border-white/10 pr-1.5">
                <span className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold block mb-0.5">Rate</span>
                <div className="flex items-center gap-1.5">
                  <div className="text-base font-bold text-white">{bpm || '--'} BPM</div>
                  <span
                    className={`text-[8px] px-1 py-0.5 rounded ${
                      rateFeedback.color === 'green'
                        ? 'bg-green-500/30 text-green-300'
                        : rateFeedback.color === 'orange'
                        ? 'bg-orange-500/30 text-orange-300'
                        : 'bg-red-500/30 text-red-300'
                    }`}
                  >
                    {rateFeedback.color === 'green' ? 'Good' : rateFeedback.color === 'orange' ? 'Warning' : 'Critical'}
                  </span>
                </div>
              </div>

              {/* Right Column: Depth */}
              <div className="pl-1.5">
                <span className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold block mb-0.5">Depth</span>
                <div className="flex items-center gap-1.5">
                  <div className="text-base font-bold text-white">{depthMm || '--'}mm</div>
                  <span
                    className={`text-[8px] px-1 py-0.5 rounded ${
                      depthFeedback.color === 'green'
                        ? 'bg-green-500/30 text-green-300'
                        : depthFeedback.color === 'orange'
                        ? 'bg-orange-500/30 text-orange-300'
                        : 'bg-red-500/30 text-red-300'
                    }`}
                  >
                    {depthFeedback.color === 'green' ? 'Good' : depthFeedback.color === 'orange' ? 'Warning' : 'Critical'}
                  </span>
                </div>
              </div>
            </div>

            {/* Second row: Compression and Placement */}
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              {/* Left Column: Compression */}
              <div className="border-r border-white/10 pr-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Compressions</span>
                  {isComplete && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/30 text-green-300">
                      Done
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="text-base font-bold text-white">
                    <span className={isComplete ? 'text-green-400' : 'text-blue-400'}>
                      {compressionCount}
                    </span>
                    <span className="text-gray-500 text-xs">/30</span>
                  </div>
                  {/* Progress bar inline */}
                  <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isComplete ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Placement */}
              <div className="pl-1.5">
                <span className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold block mb-0.5">Placement</span>
                <div
                  className={`text-sm font-semibold mb-0.5 ${
                    placement === 'Good' ? 'text-green-400' : 'text-orange-400'
                  }`}
                >
                  {placement}
                </div>
                <div className="text-[8px] text-gray-400 line-clamp-1">{placementFeedback.message}</div>
              </div>
            </div>

            {/* Buttons: Two rows */}
            <div className="pt-1.5 border-t border-white/20 space-y-1.5">
              {/* First row: Metronome and Save side by side */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* Metronome toggle button */}
                {onMetronomeToggle ? (
                  <button
                    onClick={onMetronomeToggle}
                    className="px-2 py-1 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 transition-colors font-semibold text-[10px] flex items-center justify-center gap-1"
                  >
                    <span className="text-sm">{metronomeEnabled ? '🔊' : '🔇'}</span>
                    <span className="text-[9px]">{metronomeEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                ) : (
                  <div></div>
                )}
                
                {/* Save Video button - always visible */}
                <button
                  onClick={onSaveVideo || (() => {})}
                  disabled={!onSaveVideo}
                  className="px-2 py-1 bg-blue-600/80 hover:bg-blue-700/80 disabled:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold text-[10px] flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="text-[9px]">Save</span>
                </button>
              </div>
              
              {/* Second row: Ask Question buttons - two buttons side by side */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    setAskModalMode('typing');
                    setIsAskModalOpen(true);
                  }}
                  className="px-2 py-1 bg-purple-600/80 hover:bg-purple-700/80 text-white rounded-lg transition-colors font-semibold text-[10px] flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-[9px]">Type Question</span>
                </button>
                <button
                  onClick={() => {
                    setAskModalMode('voice');
                    setIsAskModalOpen(true);
                  }}
                  className="px-2 py-1 bg-purple-600/80 hover:bg-purple-700/80 text-white rounded-lg transition-colors font-semibold text-[10px] flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                  <span className="text-[9px]">Voice Question</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Ask Question Modal */}
      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => {
          setIsAskModalOpen(false);
          setAskModalMode(undefined);
        }}
        onAskStart={handleAskStart}
        onAskEnd={handleAskEnd}
        initialMode={askModalMode}
      />
    </>
  );
}
