/**
 * Civilian Feedback Panel Component
 * Simplified UI with BPM/count in corners and notification bar at top
 */

import { useEffect, useState } from 'react';
import { CPRMetrics } from '../utils/cprLogic';
import { messagePrioritizer } from '../utils/messagePrioritizer';
import { motion } from 'framer-motion';

export interface CivilianFeedbackPanelProps {
  metrics: CPRMetrics;
}

export function CivilianFeedbackPanel({ metrics }: CivilianFeedbackPanelProps) {
  const { bpm, compressionCount } = metrics;
  const [prioritizedMessage, setPrioritizedMessage] = useState(
    messagePrioritizer.getCurrentMessage()
  );

  // Update prioritized message
  useEffect(() => {
    const { rateFeedback, depthFeedback, placementFeedback } = metrics;
    const priorities = [
      { feedback: rateFeedback, name: 'rate' },
      { feedback: depthFeedback, name: 'depth' },
      { feedback: placementFeedback, name: 'placement' },
    ];

    priorities.sort((a, b) => b.feedback.priority - a.feedback.priority);

    const topPriority = priorities[0];
    let message = topPriority.feedback.message;
    let color = topPriority.feedback.color;
    const priority = topPriority.feedback.priority;

    if (priorities.every(p => p.feedback.priority <= 1)) {
      message = 'Excellent CPR technique! Keep it up!';
      color = 'green';
    }

    const updated = messagePrioritizer.addMessage(message, color, priority);
    setPrioritizedMessage(updated);
  }, [metrics.rateFeedback, metrics.depthFeedback, metrics.placementFeedback]);

  // Periodically check for queued message updates
  useEffect(() => {
    const interval = setInterval(() => {
      const updated = messagePrioritizer.updateFromQueue();
      setPrioritizedMessage(updated);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Color mapping for notifications
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

  const auraColors = {
    green: 'rgba(34, 197, 94, 0.3)',
    orange: 'rgba(249, 115, 22, 0.3)',
    red: 'rgba(239, 68, 68, 0.3)',
  };

  return (
    <>
      {/* Notification bar at top */}
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
        className={`fixed top-0 left-0 right-0 z-40 px-4 py-2 ${colorClasses[prioritizedMessage.color]} ${textColorClasses[prioritizedMessage.color]} backdrop-blur-md border-b-2`}
        style={{
          boxShadow: `0 0 30px ${auraColors[prioritizedMessage.color]}`,
        }}
      >
        <div className="flex items-center justify-center gap-2 max-w-4xl mx-auto">
          <div className="text-lg flex-shrink-0">
            {prioritizedMessage.color === 'green' && '✓'}
            {prioritizedMessage.color === 'orange' && '⚠'}
            {prioritizedMessage.color === 'red' && '✕'}
          </div>
          <p className="font-semibold text-sm text-center">{prioritizedMessage.message}</p>
        </div>
      </motion.div>

      {/* BPM in bottom left corner */}
      <div className="fixed bottom-4 left-4 z-40">
        <div className="bg-black/70 backdrop-blur-lg rounded-lg px-4 py-3 border-2 border-white/20 shadow-lg">
          <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">BPM</div>
          <div className="text-3xl font-bold text-white">{bpm || '--'}</div>
        </div>
      </div>

      {/* Count in bottom right corner */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-black/70 backdrop-blur-lg rounded-lg px-4 py-3 border-2 border-white/20 shadow-lg">
          <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Count</div>
          <div className="text-3xl font-bold text-white">
            <span className={compressionCount >= 30 ? 'text-green-400' : 'text-blue-400'}>
              {compressionCount}
            </span>
            <span className="text-gray-500 text-xl">/30</span>
          </div>
        </div>
      </div>
    </>
  );
}

