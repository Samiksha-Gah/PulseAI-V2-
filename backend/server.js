const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
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
      const errorText = await response.text();
      console.error('[TTS] ElevenLabs error:', errorText);
      return res.status(response.status).json({ error: 'TTS generation failed' });
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
    res.set('X-Service', serviceUsed || 'unknown'); // Include service in header
    res.send(Buffer.from(audioBuffer));
    
    console.log(`[Query] Success: ${audioBuffer.byteLength} bytes (powered by ${serviceUsed || 'unknown'})`);
  } catch (err) {
    console.error('[Query] Error:', err && err.stack ? err.stack : err);
    const details = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? err.stack : undefined;
    res.status(500).json({ error: 'Query request failed', details, stack });
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
