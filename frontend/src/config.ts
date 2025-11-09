/// <reference types="vite/client" />

/**
 * Application Configuration
 * 
 * IMPORTANT: For production deployment (e.g., Render, Vercel):
 * Set the VITE_BACKEND_URL environment variable to your backend URL
 * Example: VITE_BACKEND_URL=https://your-backend.onrender.com
 * 
 * For local development: 
 * - Leave VITE_BACKEND_URL unset (or empty)
 * - Vite proxy will handle /api/* requests automatically
 */

// For local development: ALWAYS use relative paths (Vite proxy handles /api/*)
// For production: MUST set VITE_BACKEND_URL environment variable
// In dev mode, use relative paths so Vite proxy works
// In production, use full URL from environment variable
export const BACKEND_URL = import.meta.env.DEV 
  ? '' // Empty string in dev = relative paths, Vite proxy will intercept
  : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');

export const API_ENDPOINTS = {
  tts: `${BACKEND_URL}/api/tts`,
  query: `${BACKEND_URL}/api/query`,
  transcribe: `${BACKEND_URL}/api/transcribe`,
  health: `${BACKEND_URL}/health`,
};

// Ensure we're using relative paths in dev mode (for Vite proxy)
if (import.meta.env.DEV) {
  // Force relative paths - remove any absolute URLs
  Object.keys(API_ENDPOINTS).forEach(key => {
    const endpoint = API_ENDPOINTS[key as keyof typeof API_ENDPOINTS];
    // If somehow we got an absolute URL, strip it to make it relative
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      const url = new URL(endpoint);
      API_ENDPOINTS[key as keyof typeof API_ENDPOINTS] = url.pathname as any;
      console.warn(`[Config] Converted absolute URL to relative path: ${endpoint} → ${url.pathname}`);
    }
  });
}

// Warn if in production but backend URL is still localhost
if (!import.meta.env.DEV && BACKEND_URL.includes('localhost')) {
  console.warn('[Config] WARNING: Production build detected but BACKEND_URL is still localhost.');
  console.warn('[Config] Set VITE_BACKEND_URL environment variable to your production backend URL.');
  console.warn('[Config] Example: VITE_BACKEND_URL=https://your-backend.onrender.com');
}

// Audio notification configuration
export const AUDIO_CONFIG = {
  minNotificationInterval: 5000, // Min 5 seconds between ALL notifications (global throttle)
  debounceTime: 2000, // Wait 2 seconds for metric to stabilize
  queueMaxSize: 3, // Max 3 notifications queued
  priorityOverride: true, // Critical alerts clear queue
};