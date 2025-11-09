const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  exposedHeaders: ['X-Answer-Text', 'X-Service'] // Expose custom headers to frontend
}));
app.use(express.json());

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Environment variables
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VOICE_ID = process.env.VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah voice
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const ANSWER_MAX_WORDS = parseInt(process.env.ANSWER_MAX_WORDS || '20', 10);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TTS endpoint for notifications
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    console.log(`[TTS] Converting: "${text}"`);
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '<no body>');
      console.error('[TTS] ElevenLabs error:', response.status, errorText);
      // Return upstream error body in development to help debugging
      return res.status(response.status).json({ error: 'TTS generation failed', details: errorText });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
    
    console.log(`[TTS] Success: ${audioBuffer.byteLength} bytes`);
  } catch (err) {
    console.error('[TTS] Error:', err);
    res.status(500).json({ error: 'TTS request failed', details: err.message });
  }
});

// Speech-to-text endpoint using OpenAI Whisper
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('[Transcribe] Received audio file, size:', req.file.size, 'type:', req.file.mimetype);

    // Convert audio to text using OpenAI Whisper
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'recording.webm',
      contentType: req.file.mimetype || 'audio/webm'
    });
    formData.append('model', 'whisper-1');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('[Transcribe] OpenAI Whisper error:', errorText);
      return res.status(whisperResponse.status).json({ error: 'Transcription failed', details: errorText });
    }

    const whisperData = await whisperResponse.json();
    const transcription = whisperData.text;

    if (!transcription || transcription.trim().length === 0) {
      return res.status(500).json({ error: 'Empty transcription received' });
    }

    console.log('[Transcribe] Transcription:', transcription);
    res.json({ text: transcription, transcription: transcription });
  } catch (err) {
    console.error('[Transcribe] Error:', err);
    res.status(500).json({ error: 'Transcription request failed', details: err.message });
  }
});

// Query endpoint with Gemini + OpenAI fallback + TTS
app.post('/api/query', async (req, res) => {
  const { question, context } = req.body;
  const useOpenAI = req.query.useOpenAI === 'true' || req.body.useOpenAI === true;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  // Try Gemini first, fall back to OpenAI (unless useOpenAI is true)
  if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Neither Gemini nor OpenAI API key is configured' });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    console.log(`[Query] Question: "${question}"`);
    if (useOpenAI) {
      console.log('[Query] Skipping Gemini, using OpenAI directly (voice input)');
    }

    let answer = null;
    let serviceUsed = null;

    // 1. Try Gemini first if available (unless useOpenAI is true)
    if (GEMINI_API_KEY && !useOpenAI) {
      try {
        // Build Gemini request body and log it to help debug 400s from the upstream API
        const brevityInstruction = `Provide a concise answer in one short sentence (max ${ANSWER_MAX_WORDS} words). Keep it direct and actionable.`;

        const geminiRequestBody = {
          contents: [
            {
              parts: [
                {
                  text: `You are a professional CPR instructor providing real-time guidance. Context: ${context || 'CPR training session'}. ${brevityInstruction} Answer the following question as if speaking to someone during training. Question: ${question}`
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7,
            topP: 0.8,
            topK: 40
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
          ]
        };

        console.log('[Query] Gemini request body (base):', JSON.stringify(geminiRequestBody));

        // Helper to perform a Gemini request with a specific max tokens
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        console.log('[Query] Gemini URL:', geminiUrl);

        const doGeminiRequest = async (maxTokens) => {
          const body = { ...geminiRequestBody, generationConfig: { ...(geminiRequestBody.generationConfig || {}), maxOutputTokens: maxTokens } };
          console.log(`[Query] Sending Gemini request with maxOutputTokens=${maxTokens}`);
          const resp = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!resp.ok) {
            const errorText = await resp.text().catch(() => '<no body>');
            console.error('[Query] Gemini error:', resp.status, errorText);
            return { ok: false, status: resp.status, errorText };
          }

          let json;
          try {
            json = await resp.json();
          } catch (parseErr) {
            console.error('[Query] Failed to parse Gemini JSON:', parseErr);
            return { ok: false, status: 500, errorText: String(parseErr) };
          }

          console.log('[Query] Gemini raw response:', JSON.stringify(json));
          return { ok: true, status: resp.status, json };
        };

        // Try initial request with configured maxOutputTokens
        const initialMax = geminiRequestBody.generationConfig && geminiRequestBody.generationConfig.maxOutputTokens ? geminiRequestBody.generationConfig.maxOutputTokens : 200;
        let result = await doGeminiRequest(initialMax);
        
        if (!result.ok) {
          // If 404 model not found, try listing models and return helpful error
          if (result.status === 404) {
            try {
              const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
              const listRes = await fetch(listUrl, { method: 'GET' });
              const listJson = await listRes.json().catch(() => null);
              console.error('[Query] Gemini models list:', listJson);
              // Don't return error, fall through to OpenAI
            } catch (listErr) {
              console.error('[Query] Failed to list models:', listErr);
            }
          }
          // Continue to OpenAI fallback
        } else {
          let geminiData = result.json;

          if (!geminiData.candidates || geminiData.candidates.length === 0) {
            console.error('[Query] No candidates in Gemini response', geminiData);
            // Continue to OpenAI fallback
          } else {
            // Robust extraction of generated text from Gemini response
            const tryGet = (obj, ...path) => {
              try {
                let cur = obj;
                for (const p of path) {
                  if (cur == null) return null;
                  cur = cur[p];
                }
                return cur == null ? null : cur;
              } catch (e) {
                return null;
              }
            };

            let answer = null;
            // Common locations
            answer = answer || tryGet(geminiData, 'candidates', 0, 'content', 'parts', 0, 'text');
            answer = answer || tryGet(geminiData, 'candidates', 0, 'content', 0, 'text');
            answer = answer || tryGet(geminiData, 'output', 0, 'content', 0, 'text');
            answer = answer || tryGet(geminiData, 'output', 0, 'content', 0, 'parts', 0, 'text');
            answer = answer || tryGet(geminiData, 'candidates', 0, 'output', 0, 'content', 0, 'text');
            
            // Fallback: any string found inside candidates[0]
            if (!answer) {
              const cand = tryGet(geminiData, 'candidates', 0) || {};
              const walk = (o, parentKey) => {
                if (!o || typeof o !== 'object') return null;
                for (const k of Object.keys(o)) {
                  const v = o[k];
                  if (typeof v === 'string' && v.trim().length > 0) {
                    if (/text|message|answer|content|utterance|output/i.test(k) || v.trim().length > 50) return v;
                  }
                  if (typeof v === 'object') {
                    const r = walk(v, k);
                    if (r) return r;
                  }
                }
                return null;
              };
              answer = walk(cand, 'candidates[0]');
            }

            let truncated = geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].finishReason === 'MAX_TOKENS';

            // If truncated and no answer, retry once with a larger token budget
            if (!answer && truncated) {
              console.log('[Query] Response truncated, retrying with larger maxOutputTokens (1024)');
              const retryResult = await doGeminiRequest(1024);
              if (retryResult.ok) {
                geminiData = retryResult.json;
                console.log('[Query] Gemini raw response (retry):', JSON.stringify(geminiData));
                answer = tryGet(geminiData, 'candidates', 0, 'content', 'parts', 0, 'text') || tryGet(geminiData, 'candidates', 0, 'content', 0, 'text') || tryGet(geminiData, 'output', 0, 'content', 0, 'text');
                truncated = geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].finishReason === 'MAX_TOKENS';
              }
            }

            if (answer && typeof answer === 'string' && answer.trim().length > 0) {
              serviceUsed = 'gemini';
              answer = answer; // Use the extracted answer
              console.log(`[Query] Gemini Answer: "${answer}"`);
            } else {
              console.error('[Query] No textual answer found in Gemini response', geminiData);
              // Continue to OpenAI fallback
            }
          }
        }
      } catch (geminiError) {
        console.error('[Query] Gemini request failed:', geminiError);
        // Continue to OpenAI fallback
      }
    }

    // 2. Fall back to OpenAI if Gemini didn't work
    if (!answer && OPENAI_API_KEY) {
      try {
        console.log('[Query] Using OpenAI API...');
        const brevityInstruction = `Provide a concise answer in one short sentence (max ${ANSWER_MAX_WORDS} words). Keep it direct and actionable.`;
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are a professional CPR instructor providing real-time guidance during CPR training. ${brevityInstruction}`
              },
              {
                role: 'user',
                content: `Context: ${context || 'CPR training session - user is practicing compressions'}. Question: ${question}`
              }
            ],
            max_tokens: 200,
            temperature: 0.7
          })
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error('[Query] OpenAI error:', errorText);
          return res.status(500).json({ error: 'OpenAI API failed', details: errorText });
        }

        const openaiData = await openaiResponse.json();
        if (!openaiData.choices || openaiData.choices.length === 0) {
          console.error('[Query] No choices in OpenAI response');
          return res.status(500).json({ error: 'No response from OpenAI' });
        }

        const choice = openaiData.choices[0];
        if (!choice.message || !choice.message.content) {
          console.error('[Query] Invalid OpenAI response structure');
          return res.status(500).json({ error: 'Invalid response structure from OpenAI' });
        }

        answer = choice.message.content;
        if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
          console.error('[Query] Empty or invalid answer from OpenAI');
          return res.status(500).json({ error: 'AI response failed: Received empty answer from OpenAI' });
        }
        
        serviceUsed = 'openai';
        console.log(`[Query] OpenAI Answer: "${answer}"`);
      } catch (openaiError) {
        console.error('[Query] OpenAI request failed:', openaiError);
        return res.status(500).json({ error: 'OpenAI API failed', details: openaiError.message });
      }
    }

    if (!answer) {
      return res.status(500).json({ error: 'AI response failed', details: 'Both Gemini and OpenAI failed to generate a response' });
    }

    console.log(`[Query] Answer: "${answer}"`);

    // Truncate server-side to ANSWER_MAX_WORDS to guarantee brevity
    const truncateWords = (str, maxWords) => {
      if (!str || typeof str !== 'string') return str;
      const words = str.trim().split(/\s+/);
      if (words.length <= maxWords) return str.trim();
      return words.slice(0, maxWords).join(' ') + '...';
    };

    const finalAnswer = truncateWords(answer, ANSWER_MAX_WORDS);
    if (finalAnswer !== answer) console.log('[Query] Answer truncated to max words:', ANSWER_MAX_WORDS);

    // If client requested a text response, return JSON instead of generating TTS
    if (req.body && (req.body.return === 'text' || req.body.returnText === true || req.query.response === 'text')) {
      console.log('[Query] Returning text response to client (no TTS)');
      return res.json({ answer: finalAnswer, service: serviceUsed || 'unknown' });
    }

    // Convert answer to speech using ElevenLabs
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: finalAnswer,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text().catch(() => '<no body>');
      console.error('[Query] TTS error:', ttsResponse.status, errorText);
      return res.status(ttsResponse.status).json({ error: 'TTS generation failed', details: errorText });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Answer-Text', finalAnswer); // Include text in header for frontend
    // Normalize service name to lowercase for consistency
    const normalizedService = serviceUsed ? serviceUsed.toLowerCase() : 'unknown';
    res.set('X-Service', normalizedService); // Include service in header
    res.send(Buffer.from(audioBuffer));
    
    console.log(`[Query] Success: ${audioBuffer.byteLength} bytes (powered by ${normalizedService})`);
    console.log(`[Query] Headers set - X-Answer-Text: "${finalAnswer.substring(0, 50)}...", X-Service: "${normalizedService}"`);
  } catch (err) {
    console.error('[Query] Error:', err && err.stack ? err.stack : err);
    const details = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? err.stack : undefined;
    res.status(500).json({ error: 'Query request failed', details, stack });
  }
});

// Summarize endpoint - accepts recorded session JSON and returns a comprehensive summary (text)
app.post('/api/summarize', async (req, res) => {
  const sessionData = req.body;

  console.log('[Summarize] Request received');
  console.log('[Summarize] Session data keys:', sessionData ? Object.keys(sessionData) : 'null');
  console.log('[Summarize] Has samples:', sessionData?.samples ? sessionData.samples.length : 0);

  if (!sessionData) {
    console.error('[Summarize] No session data provided');
    return res.status(400).json({ error: 'Session data is required' });
  }

  if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    console.error('[Summarize] No API keys configured');
    return res.status(500).json({ error: 'Neither Gemini nor OpenAI API key is configured' });
  }

  console.log('[Summarize] API keys available - Gemini:', !!GEMINI_API_KEY, 'OpenAI:', !!OPENAI_API_KEY);

  try {
  // Request a strict JSON object from the LLM so the frontend can render predefined sections.
  // The JSON schema to return MUST be valid JSON (no surrounding markdown). Fields:
  // {
  //   "executiveSummary": string,
  //   "keyMetrics": { "averageBPM": number, "averageDepthMm": number, "totalCompressions": number, "timeInTargetRangeSec": number, ... },
  //   "timeline": [{ "time": string, "event": string }],
  //   "recommendations": [string],
  //   "uncertainties": [string]
  // }
  const prompt = `You are an expert CPR instructor and data analyst. Given the following session JSON (per-second CPR metrics), produce a JSON object that strictly follows this schema (no markdown, no explanations, just pure JSON):

{
  "executiveSummary": "short 2-4 sentence summary",
  "keyMetrics": { "averageBPM": number, "averageDepthMm": number, "totalCompressions": number, "timeInTargetRangeSec": number },
  "timeline": [{ "time": "ISO timestamp or relative", "event": "description" }],
  "recommendations": ["bullet items, concise"],
  "uncertainties": ["notes about missing or unreliable data"]
}

Be explicit about units and assumptions. Return ONLY valid JSON, no markdown code blocks, no explanations. Session data:
${JSON.stringify(sessionData, null, 2)}`;

    let summary = null;
    let serviceUsed = null;

    // Try Gemini first
    if (GEMINI_API_KEY) {
      try {
        const geminiBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.2, topP: 0.9 },
        };

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const gResp = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        });

        if (gResp.ok) {
          const gJson = await gResp.json();
          // Extract text robustly
          const tryGet = (obj, ...path) => {
            try {
              let cur = obj;
              for (const p of path) {
                if (cur == null) return null;
                cur = cur[p];
              }
              return cur == null ? null : cur;
            } catch (e) {
              return null;
            }
          };
          // Extract text and try to parse JSON
          const rawText = tryGet(gJson, 'candidates', 0, 'content', 'parts', 0, 'text') || tryGet(gJson, 'candidates', 0, 'content', 0, 'text') || tryGet(gJson, 'output', 0, 'content', 0, 'text');
          if (rawText) {
            try {
              // Try to extract JSON from markdown code blocks if present
              let jsonText = rawText.trim();
              // Remove markdown code blocks if present
              jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
              const parsed = JSON.parse(jsonText);
              summary = parsed;
              serviceUsed = 'gemini';
              console.log('[Summarize] Successfully parsed Gemini response');
            } catch (e) {
              // Not valid JSON - log the error and continue to fallback
              console.warn('[Summarize] Gemini returned non-JSON:', e.message);
              console.warn('[Summarize] Raw text (first 200 chars):', rawText.substring(0, 200));
              summary = null;
            }
          } else {
            console.warn('[Summarize] Gemini response had no text content');
          }
        } else {
          console.warn('[Summarize] Gemini request failed, falling back to OpenAI if available');
        }
      } catch (gemErr) {
        console.error('[Summarize] Gemini error:', gemErr);
      }
    }

    // Fallback to OpenAI if Gemini didn't produce an answer
    if (!summary && OPENAI_API_KEY) {
      try {
        console.log('[Summarize] Attempting OpenAI fallback...');
        const openaiModel = 'gpt-3.5-turbo'; // Use gpt-3.5-turbo for better reliability
        const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: openaiModel,
            messages: [
              { role: 'system', content: 'You are an expert CPR instructor and data analyst. Return ONLY valid JSON, no markdown code blocks, no explanations.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 2000,
            temperature: 0.2
          })
        });

        if (openaiResp.ok) {
          const openaiJson = await openaiResp.json();
          if (openaiJson.choices && openaiJson.choices.length > 0) {
            const choice = openaiJson.choices[0];
            const raw = choice.message?.content || choice.text || null;
            if (raw) {
              try {
                // Try to extract JSON from markdown code blocks if present
                let jsonText = raw.trim();
                jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                const parsed = JSON.parse(jsonText);
                summary = parsed;
                serviceUsed = 'openai';
                console.log('[Summarize] Successfully parsed OpenAI response');
              } catch (e) {
                console.warn('[Summarize] OpenAI returned non-JSON:', e.message);
                console.warn('[Summarize] Raw text (first 200 chars):', raw.substring(0, 200));
                summary = null;
              }
            } else {
              console.warn('[Summarize] OpenAI response had no content');
            }
          } else {
            console.warn('[Summarize] OpenAI response had no choices');
          }
        } else {
          const errText = await openaiResp.text().catch(() => '<no body>');
          console.error('[Summarize] OpenAI error:', openaiResp.status, errText);
        }
      } catch (openaiErr) {
        console.error('[Summarize] OpenAI request failed:', openaiErr);
      }
    }

    // If we didn't get a parsed structured object, try one more attempt: if we have any raw text from Gemini/OpenAI, return it as 'raw'
    // For clarity, the response will contain either `structured` (object) or `raw` (string)
    if (summary && typeof summary === 'object') {
      return res.json({ structured: summary, raw: null, service: serviceUsed || 'unknown' });
    }

    // As fallback, attempt to ask OpenAI for a short plain-text summary if structured parsing failed
    try {
      // Re-run a simpler OpenAI call asking for a short plaintext summary (not JSON)
      if (OPENAI_API_KEY) {
        const fallbackResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are an expert CPR instructor. Produce a concise human-readable summary (not JSON) of the submitted session data.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.2
          })
        });

        if (fallbackResp.ok) {
          const fallbackJson = await fallbackResp.json();
          const fallbackText = fallbackJson.choices && fallbackJson.choices[0] && (fallbackJson.choices[0].message?.content || fallbackJson.choices[0].text);
          if (fallbackText) {
            console.log('[Summarize] Fallback plaintext summary generated');
            return res.json({ structured: null, raw: fallbackText, service: 'openai' });
          } else {
            console.warn('[Summarize] Fallback response had no text content');
          }
        } else {
          const errText = await fallbackResp.text().catch(() => '<no body>');
          console.error('[Summarize] Fallback OpenAI error:', fallbackResp.status, errText);
        }
      }
    } catch (e) {
      console.warn('[Summarize] Fallback plaintext attempt failed:', e);
    }

    return res.status(500).json({ error: 'AI summarization failed', details: 'Could not produce structured summary or fallback plaintext' });
  } catch (err) {
    console.error('[Summarize] Error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Summarization failed', details: err.message || String(err) });
  }
});

// Catch-all route for unmatched paths
app.use((req, res) => {
  console.error(`[404] Route not found: ${req.method} ${req.path}`);
  console.error(`[404] Request URL: ${req.url}`);
  res.status(404).json({ 
    error: 'Route not found',
    errorType: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    details: `The endpoint ${req.method} ${req.path} does not exist on this server`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 PulseAI Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 ElevenLabs API: ${ELEVENLABS_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`🔑 Gemini API: ${GEMINI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`🤖 Gemini Model: ${GEMINI_MODEL}`);
  console.log(`🔑 OpenAI API: ${OPENAI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`🎤 Voice ID: ${VOICE_ID}`);
  console.log(`📏 Answer Max Words: ${ANSWER_MAX_WORDS}`);
});
