/**
 * Ask Question Modal Component
 * Allows users to ask questions during CPR training
 * Mutes all audio (metronome and notifications) while asking
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioFeedback } from '../utils/audioFeedback';
import { audioMetronome } from '../utils/audioMetronome';

interface AskQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAskStart?: () => void; // Callback when asking starts (to mute metronome)
  onAskEnd?: () => void; // Callback when asking ends (to resume metronome)
}

export function AskQuestionModal({ isOpen, onClose, onAskStart, onAskEnd }: AskQuestionModalProps) {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setIsAsking(true);
    setError(null);

    // Stop metronome and pause audio feedback
    audioMetronome.stop();
    onAskStart?.();

    try {
      // Get context from current metrics if available
      const context = 'CPR training session - user is practicing compressions';
      
      // Ask the question - this will pause audioFeedback, get answer, play it, then resume
      await audioFeedback.askQuestion(question.trim(), context);
    } catch (err) {
      console.error('Failed to ask question:', err);
      setError('Failed to get answer. Please try again.');
    } finally {
      setIsAsking(false);
      onAskEnd?.();
    }
  };

  const handleClose = () => {
    if (!isAsking) {
      setQuestion('');
      setError(null);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isAsking) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-900/95 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border-2 border-blue-500/50 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Ask a Question</h2>
                <button
                  onClick={handleClose}
                  disabled={isAsking}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-4">
                Ask any CPR-related question. All audio will be muted while you receive your answer.
              </p>

              <div className="mb-4">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., How deep should my compressions be?"
                  disabled={isAsking}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                  rows={3}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {isAsking && (
                <div className="mb-4 flex items-center gap-2 text-blue-400 text-sm">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Getting answer...</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={isAsking}
                  className="flex-1 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAsk}
                  disabled={isAsking || !question.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
                >
                  {isAsking ? 'Asking...' : 'Ask'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

