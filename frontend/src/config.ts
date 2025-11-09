/**
 * Application Configuration
 * Update BACKEND_URL when deploying to production
 */

// For local development: http://localhost:3001
// For production: https://your-backend.onrender.com
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  tts: `${BACKEND_URL}/api/tts`,
  query: `${BACKEND_URL}/api/query`,
  health: `${BACKEND_URL}/health`,
};

// Audio notification configuration
export const AUDIO_CONFIG = {
  minNotificationInterval: 5000, // Min 5 seconds between same notification type
  debounceTime: 2000, // Wait 2 seconds for metric to stabilize
  queueMaxSize: 3, // Max 3 notifications queued
  priorityOverride: true, // Critical alerts clear queue
};