/**
 * Visual Metronome Component
 * Pulses at target BPM rate to guide compression rhythm
 * Can play audio beeps when enabled
 */

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { audioMetronome } from '../utils/audioMetronome';

interface MetronomeProps {
  targetBPM: number; // Target BPM (100-120)
  currentBPM: number;
  isActive: boolean;
  audioEnabled?: boolean; // Enable audio beeps
}

export function Metronome({ targetBPM, currentBPM, isActive, audioEnabled = false }: MetronomeProps) {
  const [pulse, setPulse] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      audioMetronome.stop();
      setPulse(false);
    };

    // If not active, stop everything
    if (!isActive) {
      cleanup();
      return;
    }

    // Always set up visual pulse (independent of audio)
    const intervalMs = (60 / targetBPM) * 1000;
    
    // Set up visual pulse interval
    // In browser environments, setInterval returns a number
    const visualInterval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 100);
    }, intervalMs);
    
    intervalRef.current = visualInterval as unknown as number;

    // Start audio metronome only if audio is enabled
    if (audioEnabled) {
      const startAudio = async () => {
        // Always clean up audio first to prevent stacking
        audioMetronome.stop();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Start audio metronome (visual pulse is already handled by interval above)
        audioMetronome.start(targetBPM).catch((error) => {
          console.warn('Could not start audio metronome:', error);
        });
      };
      
      startAudio();
    } else {
      // Stop audio if disabled
      audioMetronome.stop();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      clearInterval(visualInterval);
      audioMetronome.stop();
    };
  }, [targetBPM, isActive, audioEnabled]);

  // Don't render if not active (but show visual even if audio is disabled)
  if (!isActive) {
    return null;
  }

  const bpmDiff = Math.abs(currentBPM - targetBPM);
  const isOnBeat = currentBPM > 0 && bpmDiff <= 10;

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
      <div className="flex flex-col items-center">
        {/* Metronome pulse indicator with aura */}
        <motion.div
          animate={{
            scale: pulse ? [1, 1.3, 1] : 1,
            opacity: pulse ? [1, 0.8, 1] : 0.6,
            boxShadow: pulse
              ? [
                  `0 0 20px ${isOnBeat ? 'rgba(34, 197, 94, 0.5)' : 'rgba(249, 115, 22, 0.5)'}`,
                  `0 0 40px ${isOnBeat ? 'rgba(34, 197, 94, 0.5)' : 'rgba(249, 115, 22, 0.5)'}`,
                  `0 0 20px ${isOnBeat ? 'rgba(34, 197, 94, 0.5)' : 'rgba(249, 115, 22, 0.5)'}`,
                ]
              : `0 0 10px ${isOnBeat ? 'rgba(34, 197, 94, 0.3)' : 'rgba(249, 115, 22, 0.3)'}`,
          }}
          transition={{
            duration: 0.3,
            ease: 'easeInOut',
          }}
          className={`w-16 h-16 rounded-full border-4 ${
            isOnBeat
              ? 'bg-green-500/30 border-green-400'
              : 'bg-orange-500/30 border-orange-400'
          } flex items-center justify-center backdrop-blur-sm`}
          style={{
            boxShadow: `0 0 15px ${isOnBeat ? 'rgba(34, 197, 94, 0.4)' : 'rgba(249, 115, 22, 0.4)'}`,
          }}
        >
          <div
            className={`w-8 h-8 rounded-full ${
              isOnBeat ? 'bg-green-400' : 'bg-orange-400'
            }`}
          />
        </motion.div>

        {/* Audio indicator */}
        {audioEnabled && (
          <div className="mt-2 text-center">
            <div className="text-xs text-blue-400">Audio: ON</div>
          </div>
        )}
      </div>
    </div>
  );
}
