/**
 * Feedback Panel Component
 * Displays comprehensive CPR feedback with modern UI and color-coded auras
 */

import { useEffect, useState } from 'react';
import { CPRMetrics } from '../utils/cprLogic';
import { messagePrioritizer } from '../utils/messagePrioritizer';
import { motion } from 'framer-motion';

export interface FeedbackPanelProps {
  metrics: CPRMetrics;
  metronomeEnabled?: boolean;
  onMetronomeToggle?: () => void;
  onSaveVideo?: () => void;
  isRecording?: boolean;
}

export function FeedbackPanel({ metrics, metronomeEnabled, onMetronomeToggle, onSaveVideo, isRecording }: FeedbackPanelProps) {
  const { bpm, depthMm, placement, compressionCount, rateFeedback, depthFeedback, placementFeedback } = metrics;
  const [prioritizedMessage, setPrioritizedMessage] = useState(
    messagePrioritizer.getCurrentMessage()
  );

  // Update prioritized message - show ONLY ONE message at a time
  useEffect(() => {
    // Determine overall priority from individual feedbacks
    const priorities = [
      { feedback: rateFeedback, name: 'rate' },
      { feedback: depthFeedback, name: 'depth' },
      { feedback: placementFeedback, name: 'placement' },
    ];

    // Sort by priority (highest first)
    priorities.sort((a, b) => b.feedback.priority - a.feedback.priority);

    // Show ONLY the highest priority message (one at a time)
    const topPriority = priorities[0];
    let message = topPriority.feedback.message;
    let color = topPriority.feedback.color;
    const priority = topPriority.feedback.priority;

    // Only show positive message if ALL are good (priority <= 1)
    if (priorities.every(p => p.feedback.priority <= 1)) {
      message = 'Excellent CPR technique! Keep it up!';
      color = 'green';
    }

    const updated = messagePrioritizer.addMessage(message, color, priority);
    setPrioritizedMessage(updated);
  }, [rateFeedback, depthFeedback, placementFeedback]);

  // Periodically check for queued message updates (less frequently)
  useEffect(() => {
    const interval = setInterval(() => {
      const updated = messagePrioritizer.updateFromQueue();
      setPrioritizedMessage(updated);
    }, 1000); // Check every 1 second (slower updates)

    return () => clearInterval(interval);
  }, []);

  // Color mapping for status with auras
  const colorClasses = {
    green: 'bg-green-500/90 border-green-400',
    orange: 'bg-orange-500/90 border-orange-400',
    red: 'bg-red-500/90 border-red-400',
  };

  const textColorClasses = {
    green: 'text-green-100',
    orange: 'text-orange-100',
    red: 'text-red-100',
  };

  const iconColorClasses = {
    green: 'text-green-300',
    orange: 'text-orange-300',
    red: 'text-red-300',
  };

  const auraColors = {
    green: 'rgba(34, 197, 94, 0.3)',
    orange: 'rgba(249, 115, 22, 0.3)',
    red: 'rgba(239, 68, 68, 0.3)',
  };

  const compressionProgress = Math.min((compressionCount / 30) * 100, 100);
  const isComplete = compressionCount >= 30;

  return (
    <>
      {/* Main feedback banner - top center with color-coded aura */}
      <motion.div
        animate={{
          boxShadow: [
            `0 0 20px ${auraColors[prioritizedMessage.color]}`,
            `0 0 40px ${auraColors[prioritizedMessage.color]}`,
            `0 0 20px ${auraColors[prioritizedMessage.color]}`,
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-40 px-6 py-4 rounded-xl shadow-2xl border-2 ${colorClasses[prioritizedMessage.color]} ${textColorClasses[prioritizedMessage.color]} backdrop-blur-md min-w-[300px] max-w-[600px]`}
        style={{
          boxShadow: `0 0 30px ${auraColors[prioritizedMessage.color]}`,
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <div className={`text-2xl ${iconColorClasses[prioritizedMessage.color]}`}>
            {prioritizedMessage.color === 'green' && '✓'}
            {prioritizedMessage.color === 'orange' && '⚠'}
            {prioritizedMessage.color === 'red' && '✕'}
          </div>
          <p className="font-semibold text-lg text-center">{prioritizedMessage.message}</p>
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
          className="bg-black/70 backdrop-blur-lg rounded-t-2xl md:rounded-2xl p-3 md:p-5 border-t-2 md:border-2 border-white/20 shadow-2xl"
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
               {(onMetronomeToggle || onSaveVideo) && (
                 <div className="pt-4 mt-4 border-t border-white/20">
                   <div className="grid grid-cols-2 gap-3">
                     {/* Metronome toggle button */}
                     {onMetronomeToggle && (
                       <button
                         onClick={onMetronomeToggle}
                         className="px-3 py-2.5 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 transition-colors font-semibold text-sm flex items-center justify-center gap-1.5"
                       >
                         <span className="text-lg">{metronomeEnabled ? '🔊' : '🔇'}</span>
                         <span className="text-xs">{metronomeEnabled ? 'ON' : 'OFF'}</span>
                       </button>
                     )}
                     
                     {/* Save Video button */}
                     {onSaveVideo && (
                       <button
                         onClick={onSaveVideo}
                         disabled={!isRecording}
                         className="px-3 py-2.5 bg-blue-600/80 hover:bg-blue-700/80 disabled:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-1.5"
                         title={isRecording ? "Save recording" : "Recording in progress..."}
                       >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                         </svg>
                         <span className="text-xs">Save</span>
                       </button>
                     )}
                   </div>
                 </div>
               )}
            </div>
          </div>

          {/* Mobile: Compressed bottom bar layout */}
          <div className="md:hidden">
            {/* Warning notification at top - red section above dashboard */}
            <div className="mb-3 pb-2 bg-red-500/40 rounded-lg px-3 py-2 border-2 border-red-500/60">
              <p className="text-xs font-bold text-white text-center">Training app—call 911 in real emergencies</p>
            </div>
            
            {/* Main data grid: 2 columns */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Left Column: Rate */}
              <div className="border-r border-white/10 pr-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold block mb-1">Rate</span>
                <div className="text-lg font-bold text-white mb-0.5">{bpm || '--'} BPM</div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded block ${
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

              {/* Right Column: Depth */}
              <div className="pl-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold block mb-1">Depth</span>
                <div className="text-lg font-bold text-white mb-0.5">{depthMm || '--'}mm</div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded block ${
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

            {/* Second row: Compression and Placement */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Left Column: Compression */}
              <div className="border-r border-white/10 pr-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Compressions</span>
                  {isComplete && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/30 text-green-300">
                      Done
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-white mb-1">
                  <span className={isComplete ? 'text-green-400' : 'text-blue-400'}>
                    {compressionCount}
                  </span>
                  <span className="text-gray-500 text-sm">/30</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isComplete ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${compressionProgress}%` }}
                  />
                </div>
              </div>

              {/* Right Column: Placement */}
              <div className="pl-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold block mb-1">Placement</span>
                <div
                  className={`text-base font-semibold mb-0.5 ${
                    placement === 'Good' ? 'text-green-400' : 'text-orange-400'
                  }`}
                >
                  {placement}
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded block mb-0.5 ${
                    placementFeedback.color === 'green'
                      ? 'bg-green-500/30 text-green-300'
                      : placementFeedback.color === 'orange'
                      ? 'bg-orange-500/30 text-orange-300'
                      : 'bg-red-500/30 text-red-300'
                  }`}
                >
                  {placement === 'Good' ? 'Good' : 'Off-center'}
                </span>
                <div className="text-[9px] text-gray-400 line-clamp-1">{placementFeedback.message}</div>
              </div>
            </div>

             {/* Buttons: Separate columns */}
             {(onMetronomeToggle || onSaveVideo) && (
               <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20">
                 {/* Metronome toggle button */}
                 {onMetronomeToggle && (
                   <button
                     onClick={onMetronomeToggle}
                     className="px-2 py-1.5 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 transition-colors font-semibold text-xs flex items-center justify-center gap-1"
                   >
                     <span className="text-base">{metronomeEnabled ? '🔊' : '🔇'}</span>
                     <span className="text-[10px]">{metronomeEnabled ? 'ON' : 'OFF'}</span>
                   </button>
                 )}
                 
                 {/* Save Video button */}
                 {onSaveVideo && (
                   <button
                     onClick={onSaveVideo}
                     disabled={!isRecording}
                     className="px-2 py-1.5 bg-blue-600/80 hover:bg-blue-700/80 disabled:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold text-xs flex items-center justify-center gap-1"
                     title={isRecording ? "Save recording" : "Recording in progress..."}
                   >
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                     </svg>
                     <span className="text-[10px]">Save</span>
                   </button>
                 )}
               </div>
             )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
