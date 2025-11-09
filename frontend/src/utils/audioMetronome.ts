/**
 * Audio Metronome Utility
 * Plays audio beep at target BPM for CPR rhythm guidance
 */

class AudioMetronome {
  private audioContext: AudioContext | null = null;
  private intervalId: number | null = null;
  private isPlaying: boolean = false;
  private onBeatCallback: (() => void) | null = null;

  /**
   * Initialize audio context
   */
  private async initAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browsers require user interaction)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Play a beep sound
   */
  private async playBeep(): Promise<void> {
    try {
      const context = await this.initAudioContext();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      // Create a short beep (100ms)
      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.1);

      // Trigger visual pulse callback
      if (this.onBeatCallback) {
        this.onBeatCallback();
      }
    } catch (error) {
      console.warn('Could not play metronome beep:', error);
    }
  }

  /**
   * Start metronome at target BPM
   */
  async start(targetBPM: number = 100, onBeat?: () => void): Promise<void> {
    // Always stop first to prevent stacking
    this.stop();
    
    // Wait a bit to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 50));

    this.isPlaying = true;
    this.onBeatCallback = onBeat || null;

    // Calculate interval in milliseconds
    const intervalMs = (60 / targetBPM) * 1000;

    // Play initial beep immediately
    await this.playBeep();

    // Set up interval for subsequent beeps
    // In browser environments, setInterval returns a number
    this.intervalId = window.setInterval(() => {
      if (this.isPlaying) {
        this.playBeep();
      }
    }, intervalMs) as number;
  }

  /**
   * Stop metronome completely
   */
  stop(): void {
    this.isPlaying = false;
    this.onBeatCallback = null;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check if metronome is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

// Export singleton instance
export const audioMetronome = new AudioMetronome();
