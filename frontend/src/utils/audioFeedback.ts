/**
 * Audio Feedback Manager
 * Handles TTS notifications and query system
 */

import { API_ENDPOINTS, AUDIO_CONFIG } from '../config';

export type NotificationType = 'depth' | 'rate' | 'position' | 'critical' | 'encouragement';

export interface AudioNotification {
  id: string;
  text: string;
  type: NotificationType;
  priority: number; // 1 = critical, 2 = important, 3 = normal
  timestamp: number;
}

class AudioFeedbackManager {
  private queue: AudioNotification[] = [];
  private isPlaying = false;
  private isPaused = false;
  private currentAudio: HTMLAudioElement | null = null;
  private lastNotificationTimes: Map<NotificationType, number> = new Map();
  private lastGlobalNotificationTime: number = 0; // Global throttle for ALL notifications
  private listeners: Set<(state: AudioState) => void> = new Set();

  constructor() {
    this.processQueue();
  }

  /**
   * Queue a notification for TTS
   * Now uses global throttling - all notifications must be at least 5 seconds apart
   */
  queueNotification(text: string, type: NotificationType = 'depth', priority: number = 3) {
    const now = Date.now();
    
    // Global throttle: ALL notifications must be at least 5 seconds apart
    if (this.lastGlobalNotificationTime > 0 && now - this.lastGlobalNotificationTime < AUDIO_CONFIG.minNotificationInterval) {
      console.log(`[Audio] Skipping notification (global throttle): "${text}"`);
      return;
    }

    const notification: AudioNotification = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      type,
      priority,
      timestamp: now,
    };

    // Critical messages clear queue
    if (priority === 1 && AUDIO_CONFIG.priorityOverride) {
      this.queue = [notification];
      this.stopCurrent();
    } else {
      // Add to queue if not full
      if (this.queue.length < AUDIO_CONFIG.queueMaxSize) {
        this.queue.push(notification);
        // Sort by priority
        this.queue.sort((a, b) => a.priority - b.priority);
      } else {
        console.log(`[Audio] Queue full, skipping: "${text}"`);
      }
    }

    this.lastNotificationTimes.set(type, now);
    this.lastGlobalNotificationTime = now; // Update global throttle time
    this.notifyListeners();
  }

  /**
   * Process queue - play next notification
   */
  private async processQueue() {
    setInterval(async () => {
      if (this.queue.length === 0 || this.isPlaying || this.isPaused) {
        return;
      }

      const notification = this.queue.shift()!;
      await this.playNotification(notification);
      this.notifyListeners();
    }, 500);
  }

  /**
   * Play a single notification via TTS
   */
  private async playNotification(notification: AudioNotification) {
    this.isPlaying = true;
    this.notifyListeners();

    try {
      console.log(`[Audio] Playing: "${notification.text}"`);
      
      const response = await fetch(API_ENDPOINTS.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: notification.text }),
      });

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.currentAudio = new Audio(audioUrl);
      
      await new Promise<void>((resolve, reject) => {
        this.currentAudio!.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        this.currentAudio!.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Audio playback failed'));
        };
        this.currentAudio!.play().catch(reject);
      });
    } catch (err) {
      console.error('[Audio] Playback error:', err);
    } finally {
      this.isPlaying = false;
      this.currentAudio = null;
      this.notifyListeners();
    }
  }

  /**
   * Query system - pause notifications and get AI answer
   */
  async askQuestion(question: string, context: string = 'CPR training'): Promise<void> {
    this.pause();

    try {
      console.log(`[Audio] Query: "${question}"`);
      
      const response = await fetch(API_ENDPOINTS.query, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.resume();
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          this.resume();
          reject(new Error('Audio playback failed'));
        };
        audio.play().catch(reject);
      });
    } catch (err) {
      console.error('[Audio] Query error:', err);
      this.resume();
      throw err;
    }
  }

  /**
   * Pause notification queue
   */
  pause() {
    this.isPaused = true;
    this.stopCurrent();
    this.notifyListeners();
  }

  /**
   * Resume notification queue
   */
  resume() {
    this.isPaused = false;
    this.notifyListeners();
  }

  /**
   * Stop current audio
   */
  private stopCurrent() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
      this.isPlaying = false;
    }
  }

  /**
   * Clear queue and reset timing
   */
  clearQueue() {
    this.queue = [];
    this.stopCurrent();
    this.lastGlobalNotificationTime = 0; // Reset global throttle
    this.notifyListeners();
  }

  /**
   * Reset timing (useful when starting a new session)
   */
  resetTiming() {
    this.lastGlobalNotificationTime = 0;
    this.lastNotificationTimes.clear();
  }

  /**
   * Get current state
   */
  getState(): AudioState {
    return {
      queueLength: this.queue.length,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AudioState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
}

export interface AudioState {
  queueLength: number;
  isPlaying: boolean;
  isPaused: boolean;
}

// Singleton instance
export const audioFeedback = new AudioFeedbackManager();