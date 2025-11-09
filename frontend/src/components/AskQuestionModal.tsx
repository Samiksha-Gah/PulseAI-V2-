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
  const [answer, setAnswer] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null); // 'gemini' or 'openai'
  const [isAsking, setIsAsking] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setIsAsking(true);
    setError(null);
    setAnswer(null);
    setService(null);

    // Stop metronome and pause audio feedback
    audioMetronome.stop();
    audioFeedback.pause();
    onAskStart?.();

    try {
      // Get context from current metrics if available
      const context = 'CPR training session - user is practicing compressions';
      
      // 1. Get text answer from AI
      const { API_ENDPOINTS } = await import('../config');
      console.log('[AskQuestionModal] ========== REQUEST START ==========');
      console.log('[AskQuestionModal] Full API_ENDPOINTS object:', API_ENDPOINTS);
      console.log('[AskQuestionModal] Query endpoint URL:', API_ENDPOINTS.query);
      
      // Use the endpoint URL directly - config.ts ensures relative paths in dev mode
      // Relative paths (like /api/query) will be intercepted by Vite proxy
      // Absolute URLs (in production) will be used directly
      const queryUrl = API_ENDPOINTS.query;
      console.log('[AskQuestionModal] Final URL to use:', queryUrl);
      console.log('[AskQuestionModal] Is relative path:', !queryUrl.startsWith('http'));
      console.log('[AskQuestionModal] Request method: POST');
      console.log('[AskQuestionModal] Request headers:', { 'Content-Type': 'application/json' });
      console.log('[AskQuestionModal] Request body:', { question: question.trim(), context });
      console.log('[AskQuestionModal] Request body stringified:', JSON.stringify({ question: question.trim(), context }));
      console.log('[AskQuestionModal] Current window location:', window.location.href);
      console.log('[AskQuestionModal] Is development mode:', import.meta.env.DEV);
      console.log('[AskQuestionModal] VITE_BACKEND_URL env var:', import.meta.env.VITE_BACKEND_URL);
      
      let queryResponse;
      let fetchStartTime = Date.now();
      try {
        console.log('[AskQuestionModal] Attempting fetch to:', queryUrl);
        queryResponse = await fetch(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question.trim(), context }),
        });
        let fetchEndTime = Date.now();
        console.log('[AskQuestionModal] Fetch completed in:', fetchEndTime - fetchStartTime, 'ms');
        console.log('[AskQuestionModal] Fetch successful, response received');
      } catch (fetchError) {
        let fetchEndTime = Date.now();
        console.error('[AskQuestionModal] ========== FETCH ERROR ==========');
        console.error('[AskQuestionModal] ERROR_CODE: FETCH_FAILED');
        console.error('[AskQuestionModal] Fetch duration before error:', fetchEndTime - fetchStartTime, 'ms');
        console.error('[AskQuestionModal] Error type:', typeof fetchError);
        console.error('[AskQuestionModal] Error name:', fetchError instanceof Error ? fetchError.name : 'N/A');
        console.error('[AskQuestionModal] Error message:', fetchError instanceof Error ? fetchError.message : String(fetchError));
        console.error('[AskQuestionModal] Error stack:', fetchError instanceof Error ? fetchError.stack : 'N/A');
        console.error('[AskQuestionModal] Full error object:', fetchError);
        console.error('[AskQuestionModal] Target URL was:', queryUrl);
        console.error('[AskQuestionModal] Network info:', {
          onLine: navigator.onLine,
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt,
          } : 'Not available'
        });
        throw new Error(`ERROR_CODE: FETCH_FAILED - Failed to connect to backend. URL: ${queryUrl}. Error type: ${fetchError instanceof Error ? fetchError.name : typeof fetchError}. Error message: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}. Network online: ${navigator.onLine}`);
      }

      console.log('[AskQuestionModal] ========== RESPONSE RECEIVED ==========');
      console.log('[AskQuestionModal] Response status:', queryResponse.status);
      console.log('[AskQuestionModal] Response statusText:', queryResponse.statusText);
      console.log('[AskQuestionModal] Response ok:', queryResponse.ok);
      console.log('[AskQuestionModal] Response type:', queryResponse.type);
      console.log('[AskQuestionModal] Response redirected:', queryResponse.redirected);
      console.log('[AskQuestionModal] Response url:', queryResponse.url);
      console.log('[AskQuestionModal] Response headers (all):', Object.fromEntries(queryResponse.headers.entries()));
      console.log('[AskQuestionModal] Response content-type:', queryResponse.headers.get('content-type'));
      console.log('[AskQuestionModal] Response content-length:', queryResponse.headers.get('content-length'));

      // Read response body (can only be read once)
      let responseText;
      try {
        responseText = await queryResponse.text();
        console.log('[AskQuestionModal] Response text read successfully');
      } catch (textError) {
        console.error('[AskQuestionModal] ERROR_CODE: READ_RESPONSE_BODY_FAILED');
        console.error('[AskQuestionModal] Failed to read response body:', textError);
        throw new Error(`ERROR_CODE: READ_RESPONSE_BODY_FAILED - Could not read response body. Error: ${textError instanceof Error ? textError.message : String(textError)}`);
      }
      
      console.log('[AskQuestionModal] Response text (raw):', responseText);
      console.log('[AskQuestionModal] Response text length:', responseText.length);
      console.log('[AskQuestionModal] Response text type:', typeof responseText);
      console.log('[AskQuestionModal] Response text is empty:', !responseText || responseText.length === 0);
      console.log('[AskQuestionModal] Response text first 200 chars:', responseText.substring(0, 200));
      console.log('[AskQuestionModal] Response text last 200 chars:', responseText.substring(Math.max(0, responseText.length - 200)));

      if (!queryResponse.ok) {
        const status = queryResponse.status;
        const contentType = queryResponse.headers.get('content-type');
        console.error('[AskQuestionModal] ERROR_CODE: HTTP_ERROR - Status:', status, 'Content-Type:', contentType);
        
        // Categorize error by status code
        let errorType = 'UNKNOWN_ERROR';
        let userFriendlyMessage = 'Something went wrong. Please try again.';
        
        if (status === 404) {
          errorType = 'ROUTE_NOT_FOUND';
          userFriendlyMessage = 'The question service is not available. The backend endpoint may be missing or misconfigured.';
        } else if (status === 400) {
          errorType = 'BAD_REQUEST';
          userFriendlyMessage = 'Invalid question format. Please try rephrasing your question.';
        } else if (status === 401 || status === 403) {
          errorType = 'AUTH_ERROR';
          userFriendlyMessage = 'Authentication failed. Please check API key configuration.';
        } else if (status === 500) {
          errorType = 'SERVER_ERROR';
          userFriendlyMessage = 'The AI service encountered an error. Please try again in a moment.';
        } else if (status === 503) {
          errorType = 'SERVICE_UNAVAILABLE';
          userFriendlyMessage = 'The AI service is temporarily unavailable. Please try again later.';
        }
        
        let errorMessage = `ERROR_CODE: HTTP_${status}_${errorType}`;
        let errorDetails = '';
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = JSON.parse(responseText);
            console.error('[AskQuestionModal] ERROR_CODE: HTTP_ERROR - Parsed error response:', errorData);
            
            // Extract specific error information
            const backendError = errorData.error || errorData.message || '';
            const backendDetails = errorData.details || '';
            const backendErrorType = errorData.errorType || '';
            
            // Use errorType from backend if available, otherwise determine from error message
            // BUT: Don't override errorType for 404 - 404 should always be ROUTE_NOT_FOUND
            if (backendErrorType && status !== 404) {
              errorType = backendErrorType;
              // Map error types to user-friendly messages
              if (errorType === 'ROUTE_NOT_FOUND') {
                userFriendlyMessage = 'The question endpoint was not found. Please check backend configuration.';
              } else if (errorType === 'API_KEY_MISSING' || errorType === 'API_KEY_INVALID') {
                userFriendlyMessage = 'API key is not configured or invalid. Please check backend configuration.';
              } else if (errorType === 'AI_EMPTY_RESPONSE' || errorType === 'AI_INVALID_RESPONSE') {
                userFriendlyMessage = 'The AI service returned an invalid response. Please try rephrasing your question.';
              } else if (errorType === 'OPENAI_API_ERROR' || errorType === 'OPENAI_SERVICE_UNAVAILABLE') {
                userFriendlyMessage = 'OpenAI API request failed. Please check API key and try again.';
              } else if (errorType === 'RATE_LIMIT_EXCEEDED') {
                userFriendlyMessage = 'Rate limit exceeded. Please wait a moment and try again.';
              } else if (errorType === 'SERVER_ERROR') {
                userFriendlyMessage = 'The server encountered an error. Please try again.';
              }
            } else if (backendError.includes('AI response failed') && status !== 404) {
              // Fallback: Determine specific error subtype from error message
              if (backendError.includes('empty answer')) {
                errorType = 'AI_EMPTY_RESPONSE';
                userFriendlyMessage = 'The AI service returned an empty response. Please try rephrasing your question.';
              } else if (backendError.includes('invalid answer')) {
                errorType = 'AI_INVALID_RESPONSE';
                userFriendlyMessage = 'The AI service returned an invalid response. Please try again.';
              } else {
                errorType = 'AI_RESPONSE_FAILED';
                userFriendlyMessage = 'The AI service failed to generate a response. Please try again.';
              }
            } else if (backendError.includes('API key') && status !== 404) {
              errorType = 'API_KEY_MISSING';
              userFriendlyMessage = 'API key is not configured. Please check backend configuration.';
            } else if (backendError.includes('OpenAI API failed') && status !== 404) {
              errorType = 'OPENAI_API_ERROR';
              userFriendlyMessage = 'OpenAI API request failed. Please check API key and try again.';
            } else if (backendError.includes('Route not found') || status === 404) {
              // 404 should always be ROUTE_NOT_FOUND
              errorType = 'ROUTE_NOT_FOUND';
              userFriendlyMessage = 'The question endpoint was not found. Please check backend configuration.';
            }
            
            errorMessage = `ERROR_CODE: HTTP_${status}_${errorType}`;
            // Build the full error message with all details
            let fullErrorText = backendError || '';
            if (backendDetails) {
              const detailsStr = typeof backendDetails === 'string' ? backendDetails : JSON.stringify(backendDetails);
              if (fullErrorText) {
                fullErrorText += ` (${detailsStr})`;
              } else {
                fullErrorText = detailsStr;
              }
            }
            errorDetails = fullErrorText ? ` - ${fullErrorText}` : '';
            
            if (errorData.details) {
              try {
                const details = typeof errorData.details === 'string' ? JSON.parse(errorData.details) : errorData.details;
                if (details.detail?.message) {
                  errorDetails = ` - ${details.detail.message}`;
                }
              } catch (e) {
                console.error('[AskQuestionModal] ERROR_CODE: PARSE_DETAILS_FAILED - Could not parse error details:', e);
              }
            }
          } catch (parseError) {
            console.error('[AskQuestionModal] ERROR_CODE: PARSE_ERROR_RESPONSE_FAILED - Could not parse error response:', parseError);
            errorMessage = `ERROR_CODE: HTTP_${status}_PARSE_ERROR`;
            errorDetails = ` - Could not parse error response: ${responseText?.substring(0, 100)}`;
          }
        } else {
          console.error('[AskQuestionModal] ERROR_CODE: NON_JSON_ERROR - Response is not JSON:', responseText);
          errorMessage = `ERROR_CODE: HTTP_${status}_NON_JSON_RESPONSE`;
          errorDetails = ` - Server returned non-JSON response: ${responseText?.substring(0, 100)}`;
        }
        
        // Combine error message
        const fullErrorMessage = `${errorMessage}${errorDetails}`;
        console.error('[AskQuestionModal] Full error message:', fullErrorMessage);
        throw new Error(fullErrorMessage);
      }

      // Response is OK, parse JSON
      console.log('[AskQuestionModal] ========== PARSING RESPONSE ==========');
      let queryData;
      try {
        if (!responseText || responseText.trim().length === 0) {
          console.error('[AskQuestionModal] ERROR_CODE: EMPTY_RESPONSE');
          console.error('[AskQuestionModal] Response body is empty or whitespace only');
          console.error('[AskQuestionModal] Response text value:', JSON.stringify(responseText));
          throw new Error('ERROR_CODE: EMPTY_RESPONSE - Server returned empty response body');
        }
        
        console.log('[AskQuestionModal] Attempting JSON.parse on response text');
        queryData = JSON.parse(responseText);
        console.log('[AskQuestionModal] JSON.parse successful');
        console.log('[AskQuestionModal] Parsed query data type:', typeof queryData);
        console.log('[AskQuestionModal] Parsed query data:', queryData);
        console.log('[AskQuestionModal] Parsed query data (stringified):', JSON.stringify(queryData));
        console.log('[AskQuestionModal] Has answer property?', 'answer' in (queryData || {}));
        console.log('[AskQuestionModal] Answer value:', queryData?.answer);
        console.log('[AskQuestionModal] Answer value type:', typeof queryData?.answer);
        console.log('[AskQuestionModal] Answer value length:', queryData?.answer?.length);
        console.log('[AskQuestionModal] Full queryData keys:', Object.keys(queryData || {}));
        console.log('[AskQuestionModal] Full queryData structure:', JSON.stringify(queryData, null, 2));
      } catch (parseError) {
        console.error('[AskQuestionModal] ========== JSON PARSE ERROR ==========');
        console.error('[AskQuestionModal] ERROR_CODE: JSON_PARSE_FAILED');
        console.error('[AskQuestionModal] Parse error type:', typeof parseError);
        console.error('[AskQuestionModal] Parse error name:', parseError instanceof Error ? parseError.name : 'N/A');
        console.error('[AskQuestionModal] Parse error message:', parseError instanceof Error ? parseError.message : String(parseError));
        console.error('[AskQuestionModal] Parse error stack:', parseError instanceof Error ? parseError.stack : 'N/A');
        console.error('[AskQuestionModal] Response text that failed to parse:', responseText);
        console.error('[AskQuestionModal] Response text length:', responseText?.length);
        console.error('[AskQuestionModal] Response text type:', typeof responseText);
        console.error('[AskQuestionModal] Response text first 500 chars:', responseText?.substring(0, 500));
        console.error('[AskQuestionModal] Response text last 500 chars:', responseText?.substring(Math.max(0, (responseText?.length || 0) - 500)));
        console.error('[AskQuestionModal] Response text char codes (first 50):', responseText?.substring(0, 50).split('').map(c => c.charCodeAt(0)));
        throw new Error(`ERROR_CODE: JSON_PARSE_FAILED - Invalid JSON from server. Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}. Response preview: "${responseText?.substring(0, 200)}..."`);
      }
      
      // Check if response has error field instead of answer
      if (queryData?.error) {
        console.error('[AskQuestionModal] ERROR_CODE: RESPONSE_HAS_ERROR_FIELD - Response contains error:', queryData.error);
        throw new Error(`ERROR_CODE: RESPONSE_HAS_ERROR_FIELD - ${queryData.error}`);
      }
      
      if (!queryData) {
        console.error('[AskQuestionModal] ERROR_CODE: NULL_RESPONSE_DATA - queryData is null or undefined');
        throw new Error('ERROR_CODE: NULL_RESPONSE_DATA - Server returned null or undefined data');
      }
      
      if (!queryData.answer) {
        console.error('[AskQuestionModal] ERROR_CODE: MISSING_ANSWER_FIELD - Invalid response structure:', queryData);
        console.error('[AskQuestionModal] ERROR_CODE: MISSING_ANSWER_FIELD - Available keys:', Object.keys(queryData));
        throw new Error(`ERROR_CODE: MISSING_ANSWER_FIELD - No answer field in response. Response structure: ${JSON.stringify(queryData)}`);
      }
      
      if (typeof queryData.answer !== 'string') {
        console.error('[AskQuestionModal] ERROR_CODE: INVALID_ANSWER_TYPE - Answer is not a string:', typeof queryData.answer, queryData.answer);
        throw new Error(`ERROR_CODE: INVALID_ANSWER_TYPE - Answer is not a string. Type: ${typeof queryData.answer}, Value: ${String(queryData.answer)}`);
      }
      
      if (queryData.answer.trim().length === 0) {
        console.error('[AskQuestionModal] ERROR_CODE: EMPTY_ANSWER - Answer is empty string');
        throw new Error('ERROR_CODE: EMPTY_ANSWER - Answer received but it is empty');
      }

      // 2. Display the answer (no TTS for now)
      console.log('[AskQuestionModal] Setting answer:', queryData.answer);
      console.log('[AskQuestionModal] Service used:', queryData.service);
      setAnswer(queryData.answer);
      setService(queryData.service || null); // Store which service was used
      setError(null); // Clear any previous errors
      setIsAsking(false);
      setIsPlayingAudio(false);
      audioFeedback.resume();
      onAskEnd?.();
    } catch (err) {
      console.error('[AskQuestionModal] ERROR_CODE: CATCH_BLOCK - Failed to ask question:', err);
      console.error('[AskQuestionModal] ERROR_CODE: CATCH_BLOCK - Error type:', typeof err);
      console.error('[AskQuestionModal] ERROR_CODE: CATCH_BLOCK - Error name:', err instanceof Error ? err.name : 'N/A');
      console.error('[AskQuestionModal] ERROR_CODE: CATCH_BLOCK - Error stack:', err instanceof Error ? err.stack : 'N/A');
      
      let errorMessage = 'ERROR_CODE: UNKNOWN_ERROR - Failed to get answer. Please try again.';
      let displayMessage = 'Something went wrong. Please try again.';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Extract the actual backend error message from the error string
        // Format: ERROR_CODE: HTTP_404_AI_RESPONSE_FAILED - AI response failed
        const errorParts = errorMessage.split(' - ');
        if (errorParts.length > 1) {
          // Get everything after the " - " which is the actual backend error
          const backendError = errorParts.slice(1).join(' - ');
          displayMessage = backendError;
        } else {
          // Fallback: try to extract meaningful info from error code
          if (errorMessage.includes('HTTP_404_ROUTE_NOT_FOUND')) {
            displayMessage = 'Error 404: The question endpoint was not found. Check if backend is running and configured correctly.';
          } else if (errorMessage.includes('HTTP_404')) {
            displayMessage = 'Error 404: Endpoint not found. The backend route may be missing or misconfigured.';
          } else if (errorMessage.includes('HTTP_500_AI_RESPONSE_FAILED') || errorMessage.includes('HTTP_500_AI_EMPTY_RESPONSE')) {
            displayMessage = 'Error: The AI service failed to generate a response. Please try rephrasing your question.';
          } else if (errorMessage.includes('HTTP_500_OPENAI_API_ERROR')) {
            displayMessage = 'Error: OpenAI API request failed. Check API key configuration.';
          } else if (errorMessage.includes('FETCH_FAILED')) {
            displayMessage = 'Error: Could not connect to the backend server. Make sure the backend is running on port 3001.';
          } else if (errorMessage.includes('API_KEY_MISSING')) {
            displayMessage = 'Error: API key is not configured. Check backend configuration.';
          } else {
            // Show the full error message if we can't parse it
            displayMessage = errorMessage.replace(/ERROR_CODE: [^-]+ - /, '');
          }
        }
      } else if (typeof err === 'string') {
        errorMessage = `ERROR_CODE: STRING_ERROR - ${err}`;
        displayMessage = err;
      } else {
        errorMessage = `ERROR_CODE: UNKNOWN_TYPE - ${JSON.stringify(err)}`;
        displayMessage = 'Unknown error occurred. Check console for details.';
      }
      
      // Display the actual error message to the user
      setError(displayMessage);
      setIsAsking(false);
      setIsPlayingAudio(false);
      audioFeedback.resume();
      onAskEnd?.();
    }
  };

  const handleClose = () => {
    if (!isAsking) {
      setQuestion('');
      setAnswer(null);
      setService(null);
      setError(null);
      audioFeedback.resume();
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
                <h2 className="text-xl font-bold text-white">Ask an AI-powered Question</h2>
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
                Ask any CPR-related question powered by Gemini / OpenAI. All audio will be muted while you receive your answer!
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

              {/* Display answer below question */}
              {answer && (
                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm font-semibold text-blue-300 mb-2">Answer:</p>
                  <p className="text-white text-sm leading-relaxed">{answer}</p>
                  {service && (
                    <p className="text-xs text-gray-500 mt-3 text-right italic">
                      powered by {service === 'gemini' ? 'gemini' : service === 'openai' ? 'openai' : service}
                    </p>
                  )}
                </div>
              )}

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
                  {answer ? 'Close' : 'Cancel'}
                </button>
                {!answer && (
                  <button
                    onClick={handleAsk}
                    disabled={isAsking || !question.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
                  >
                    {isAsking ? 'Asking...' : 'Ask'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

