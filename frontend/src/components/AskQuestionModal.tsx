/**
 * Ask Question Modal Component
 * Allows users to ask questions during CPR training
 * Mutes all audio (metronome and notifications) while asking
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioFeedback } from '../utils/audioFeedback';
import { audioMetronome } from '../utils/audioMetronome';

interface AskQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAskStart?: () => void; // Callback when asking starts (to mute metronome)
  onAskEnd?: () => void; // Callback when asking ends (to resume metronome)
  initialMode?: 'typing' | 'voice'; // Initial mode when modal opens
}

export function AskQuestionModal({ isOpen, onClose, onAskStart, onAskEnd, initialMode }: AskQuestionModalProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [mode, setMode] = useState<'initial' | 'typing' | 'voice'>(initialMode || 'initial'); // Track which mode we're in

  // Update mode when initialMode prop changes (when modal opens)
  useEffect(() => {
    if (isOpen && initialMode) {
      setMode(initialMode);
      // For voice mode, start recording after a brief delay to ensure modal is fully rendered
      if (initialMode === 'voice') {
        const timer = setTimeout(() => {
          // startRecording is defined in the component, so it's available here
          // eslint-disable-next-line react-hooks/exhaustive-deps
          startRecording();
        }, 100);
        return () => clearTimeout(timer);
      }
    } else if (!isOpen) {
      // Reset to initial when modal closes
      setMode('initial');
      setQuestion('');
      setAnswer(null);
      setError(null);
    }
    // Note: startRecording is intentionally not in deps - it's stable and we only call it when voice mode opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  const handleAsk = async (useOpenAI = false, questionText?: string) => {
    // Use provided questionText (from transcription) or fall back to state
    const questionToAsk = questionText || question;
    
    if (!questionToAsk.trim()) {
      setError('Please enter a question');
      return;
    }

    setIsAsking(true);
    setError(null);
    setAnswer(null);

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
      console.log('[AskQuestionModal] Question to ask:', questionToAsk);
      console.log('[AskQuestionModal] Use OpenAI:', useOpenAI);
      
      // Use the endpoint URL directly - config.ts ensures relative paths in dev mode
      // Relative paths (like /api/query) will be intercepted by Vite proxy
      // Absolute URLs (in production) will be used directly
      // If useOpenAI is true (from voice input), add query param to force OpenAI
      let queryUrl = API_ENDPOINTS.query;
      if (useOpenAI) {
        queryUrl += (queryUrl.includes('?') ? '&' : '?') + 'useOpenAI=true';
      }
      console.log('[AskQuestionModal] Final URL to use:', queryUrl);
      console.log('[AskQuestionModal] Is relative path:', !queryUrl.startsWith('http'));
      console.log('[AskQuestionModal] Request method: POST');
      console.log('[AskQuestionModal] Request headers:', { 'Content-Type': 'application/json' });
      console.log('[AskQuestionModal] Request body:', { question: questionToAsk.trim(), context });
      console.log('[AskQuestionModal] Request body stringified:', JSON.stringify({ question: questionToAsk.trim(), context }));
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
          body: JSON.stringify({ question: questionToAsk.trim(), context }),
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
      const contentType = queryResponse.headers.get('content-type');
      console.log('[AskQuestionModal] Response content-type:', contentType);
      console.log('[AskQuestionModal] Response content-length:', queryResponse.headers.get('content-length'));

      // Check content type BEFORE reading body (body can only be read once)
      if (!queryResponse.ok) {
        const status = queryResponse.status;
        console.error('[AskQuestionModal] ERROR_CODE: HTTP_ERROR - Status:', status, 'Content-Type:', contentType);
        
        // Read error response body (only if not audio)
        let responseText = '';
        if (contentType && contentType.includes('application/json')) {
          try {
            responseText = await queryResponse.text();
          } catch (textError) {
            console.error('[AskQuestionModal] Failed to read error response:', textError);
          }
        }
        
        // Categorize error by status code
        let errorType = 'UNKNOWN_ERROR';
        
        if (status === 404) {
          errorType = 'ROUTE_NOT_FOUND';
        } else if (status === 400) {
          errorType = 'BAD_REQUEST';
        } else if (status === 401 || status === 403) {
          errorType = 'AUTH_ERROR';
        } else if (status === 500) {
          errorType = 'SERVER_ERROR';
        } else if (status === 503) {
          errorType = 'SERVICE_UNAVAILABLE';
        }
        
        let errorMessage = `ERROR_CODE: HTTP_${status}_${errorType}`;
        let errorDetails = '';
        
        if (contentType && contentType.includes('application/json') && responseText) {
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
              // Map error types (userFriendlyMessage was unused, removed)
            } else if (backendError.includes('AI response failed') && status !== 404) {
              // Fallback: Determine specific error subtype from error message
              if (backendError.includes('empty answer')) {
                errorType = 'AI_EMPTY_RESPONSE';
              } else if (backendError.includes('invalid answer')) {
                errorType = 'AI_INVALID_RESPONSE';
              } else {
                errorType = 'AI_RESPONSE_FAILED';
              }
            } else if (backendError.includes('API key') && status !== 404) {
              errorType = 'API_KEY_MISSING';
            } else if (backendError.includes('OpenAI API failed') && status !== 404) {
              errorType = 'OPENAI_API_ERROR';
            } else if (backendError.includes('Route not found') || status === 404) {
              // 404 should always be ROUTE_NOT_FOUND
              errorType = 'ROUTE_NOT_FOUND';
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

      // Response is OK - check if it's audio or JSON
      console.log('[AskQuestionModal] Response Content-Type:', contentType);
      
      if (contentType && contentType.includes('audio/mpeg')) {
        // Handle audio response - read as blob (body can only be read once)
        console.log('[AskQuestionModal] Received audio response');
        console.log('[AskQuestionModal] All response headers:', Array.from(queryResponse.headers.entries()));
        
        // Get truncated text from header
        const answerText = queryResponse.headers.get('X-Answer-Text') || queryResponse.headers.get('x-answer-text') || 'Audio response received';
        
        console.log('[AskQuestionModal] Truncated answer text from header:', answerText);
        
        // If we still have the fallback, log a warning
        if (answerText === 'Audio response received') {
          console.warn('[AskQuestionModal] WARNING: X-Answer-Text header not found in response');
        }
        
        // Convert response to blob and create audio URL (read body only once)
        const audioBlob = await queryResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create audio element and play
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl); // Clean up
          audioFeedback.resume();
          onAskEnd?.();
        };
        
        audio.onerror = (err) => {
          console.error('[AskQuestionModal] Audio playback error:', err);
          URL.revokeObjectURL(audioUrl);
          setError('Failed to play audio response');
          audioFeedback.resume();
          onAskEnd?.();
        };
        
        // Play audio
        await audio.play();
        
        // Display truncated text
        setAnswer(answerText);
        setError(null);
        setIsAsking(false);
      } else {
        // Handle JSON response (fallback - should not happen with audio responses)
        console.log('[AskQuestionModal] ========== PARSING JSON RESPONSE ==========');
        let queryData;
        try {
          // Read response body as text (only if not already read)
          const responseText = await queryResponse.text();
          
          if (!responseText || responseText.trim().length === 0) {
            throw new Error('ERROR_CODE: EMPTY_RESPONSE - Server returned empty response body');
          }
          
          queryData = JSON.parse(responseText);
          
          if (queryData?.error) {
            throw new Error(`ERROR_CODE: RESPONSE_HAS_ERROR_FIELD - ${queryData.error}`);
          }
          
          if (queryData?.answer) {
            setAnswer(queryData.answer);
            setError(null);
            setIsAsking(false);
            audioFeedback.resume();
            onAskEnd?.();
          } else {
            throw new Error('ERROR_CODE: MISSING_ANSWER_FIELD - No answer in response');
          }
        } catch (parseError) {
          console.error('[AskQuestionModal] JSON parse error:', parseError);
          throw parseError;
        }
      }
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
      audioFeedback.resume();
      onAskEnd?.();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        // Convert audio to text
        setIsAsking(true);
        setError(null);
        audioMetronome.stop();
        audioFeedback.pause();
        onAskStart?.();

        try {
          const { API_ENDPOINTS } = await import('../config');
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          console.log('[AskQuestionModal] Sending audio for transcription...');
          const transcriptionResponse = await fetch(API_ENDPOINTS.transcribe, {
            method: 'POST',
            body: formData,
          });

          if (!transcriptionResponse.ok) {
            const errorText = await transcriptionResponse.text();
            throw new Error(`Transcription failed: ${errorText}`);
          }

          const transcriptionData = await transcriptionResponse.json();
          const transcribedText = transcriptionData.text || transcriptionData.transcription;

          if (!transcribedText || transcribedText.trim().length === 0) {
            throw new Error('No transcription received');
          }

          console.log('[AskQuestionModal] Transcribed text:', transcribedText);
          
          // Update the textarea with transcribed text
          setQuestion(transcribedText);
          
          // Use OpenAI for voice questions (faster) - pass transcribed text directly
          await handleAsk(true, transcribedText);
        } catch (transcriptionError) {
          console.error('[AskQuestionModal] Transcription error:', transcriptionError);
          setError(transcriptionError instanceof Error ? transcriptionError.message : 'Failed to transcribe audio');
          setIsAsking(false);
          audioFeedback.resume();
          onAskEnd?.();
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('[AskQuestionModal] Failed to start recording:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleClose = () => {
    if (!isAsking && !isRecording) {
      if (mediaRecorder && isRecording) {
        stopRecording();
      }
      setQuestion('');
      setAnswer(null);
      setError(null);
      setMode('initial');
      audioFeedback.resume();
      onClose();
    }
  };

  const handleTypeQuestion = () => {
    setMode('typing');
    setError(null);
  };

  const handleVoiceQuestion = () => {
    setMode('voice');
    setError(null);
    startRecording();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isAsking && !isRecording) {
      e.preventDefault();
      handleAsk(false);
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
                Ask any CPR-related question. All audio will be muted while you receive your answer!
              </p>

              {/* Initial mode: Show two buttons */}
              {mode === 'initial' && (
                <div className="mb-4 flex gap-3">
                  <button
                    onClick={handleTypeQuestion}
                    disabled={isAsking || isRecording}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Type Question
                  </button>
                  <button
                    onClick={handleVoiceQuestion}
                    disabled={isAsking || isRecording}
                    className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                    Voice Question
                  </button>
                </div>
              )}

              {/* Typing mode: Show textarea */}
              {mode === 'typing' && (
                <div className="mb-4">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="e.g., How deep should my compressions be?"
                    disabled={isAsking || isRecording}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                    rows={3}
                    autoFocus
                  />
                </div>
              )}

              {/* Voice mode: Show recording UI and transcribed text */}
              {mode === 'voice' && (
                <div className="mb-4">
                  {isRecording ? (
                    <div className="flex items-center justify-center gap-3 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                      <button
                        onClick={stopRecording}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2 animate-pulse"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                        Stop Recording
                      </button>
                      <div className="flex items-center gap-2 text-red-400">
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                        <span className="text-sm font-medium">Recording...</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Show transcribed text in textarea for reference */}
                      {question && (
                        <div className="mb-3">
                          <label className="block text-sm text-gray-400 mb-1">Transcribed Question:</label>
                          <textarea
                            value={question}
                            readOnly
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none text-sm"
                            rows={3}
                          />
                        </div>
                      )}
                      {!question && !isAsking && (
                        <div className="text-center p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                          <p className="text-gray-400 text-sm">Recording will start automatically...</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Display answer below question */}
              {answer && (
                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm font-semibold text-blue-300 mb-2">Answer:</p>
                  <p className="text-white text-sm leading-relaxed">{answer}</p>
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

              {/* Action buttons - different based on mode */}
              {mode === 'initial' && (
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    disabled={isAsking}
                    className="flex-1 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {mode === 'typing' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setMode('initial');
                      setQuestion('');
                      setError(null);
                    }}
                    disabled={isAsking}
                    className="flex-1 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleAsk(false)}
                    disabled={isAsking || !question.trim() || isRecording}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
                  >
                    {isAsking ? 'Asking...' : 'Ask'}
                  </button>
                </div>
              )}

              {mode === 'voice' && !isRecording && !isAsking && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setMode('initial');
                      setQuestion('');
                      setError(null);
                    }}
                    disabled={isAsking}
                    className="flex-1 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Back
                  </button>
                </div>
              )}

              {/* Show close button when answer is displayed */}
              {answer && (
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    disabled={isAsking}
                    className="flex-1 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

