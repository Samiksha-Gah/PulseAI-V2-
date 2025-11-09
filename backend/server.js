const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VOICE_ID = process.env.VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah voice
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

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

// Query endpoint with Gemini + TTS
app.post('/api/query', async (req, res) => {
  console.log(`[Query] Received request: ${req.method} ${req.path}`);
  console.log(`[Query] Request body:`, req.body);
  console.log(`[Query] Request headers:`, req.headers);
  const { question, context } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  // Try Gemini first, fall back to OpenAI
  if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    return res.status(500).json({ 
      error: 'Neither Gemini nor OpenAI API key is configured',
      errorType: 'API_KEY_MISSING',
      details: 'At least one API key (GEMINI_API_KEY or OPENAI_API_KEY) must be set'
    });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ 
      error: 'ElevenLabs API key not configured',
      errorType: 'API_KEY_MISSING',
      details: 'ELEVENLABS_API_KEY environment variable is not set'
    });
  }

  try {
    console.log(`[Query] Question: "${question}"`);

    let answer = null;
    let serviceUsed = null;

    // 1. Try Gemini first if available
    if (GEMINI_API_KEY) {
      try {
        console.log('[Query] Attempting Gemini API...');
        
        // Build Gemini request body and log it to help debug 400s from the upstream API
        const geminiRequestBody = {
          contents: [
            {
              parts: [
                {
                  text: `You are a professional CPR instructor providing real-time guidance. Context: ${context || 'CPR training session'}. Answer the following question concisely in 2-3 sentences, as if speaking to someone during training. Question: ${question}`
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
              // Don't return error here, let it fall through to OpenAI
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

            // Common locations
            answer = tryGet(geminiData, 'candidates', 0, 'content', 'parts', 0, 'text');
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
                // attempt extraction again
                answer = tryGet(geminiData, 'candidates', 0, 'content', 'parts', 0, 'text') || 
                         tryGet(geminiData, 'candidates', 0, 'content', 0, 'text') || 
                         tryGet(geminiData, 'output', 0, 'content', 0, 'text');
                truncated = geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].finishReason === 'MAX_TOKENS';
              }
            }

            if (answer && typeof answer === 'string' && answer.trim().length > 0) {
              serviceUsed = 'gemini';
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
      console.log('[Query] Using OpenAI API...');
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
              content: 'You are a professional CPR instructor providing real-time guidance during CPR training. Answer questions concisely in 2-3 sentences, as if speaking to someone during active CPR practice.'
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
        let errorType = 'OPENAI_API_ERROR';
        if (openaiResponse.status === 401 || openaiResponse.status === 403) {
          errorType = 'API_KEY_INVALID';
        } else if (openaiResponse.status === 429) {
          errorType = 'RATE_LIMIT_EXCEEDED';
        } else if (openaiResponse.status === 500 || openaiResponse.status === 502 || openaiResponse.status === 503) {
          errorType = 'OPENAI_SERVICE_UNAVAILABLE';
        }
        return res.status(openaiResponse.status >= 400 && openaiResponse.status < 500 ? openaiResponse.status : 500).json({ 
          error: 'OpenAI API failed', 
          errorType: errorType,
          details: errorText 
        });
      }

      const openaiData = await openaiResponse.json();
      if (!openaiData.choices || openaiData.choices.length === 0) {
        console.error('[Query] No choices in OpenAI response');
        return res.status(500).json({ 
          error: 'No response from OpenAI',
          errorType: 'AI_EMPTY_RESPONSE',
          details: 'OpenAI API returned no choices in response'
        });
      }

      const choice = openaiData.choices[0];
      if (!choice.message || !choice.message.content) {
        console.error('[Query] Invalid OpenAI response structure');
        return res.status(500).json({ 
          error: 'Invalid response structure from OpenAI',
          errorType: 'AI_INVALID_RESPONSE',
          details: 'OpenAI API returned invalid response structure'
        });
      }

      answer = choice.message.content;
      if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
        console.error('[Query] Empty or invalid answer from OpenAI');
        return res.status(500).json({ 
          error: 'AI response failed: Received empty answer from OpenAI',
          errorType: 'AI_EMPTY_RESPONSE',
          details: 'OpenAI API returned a response but the content was empty'
        });
      }
      
      console.log(`[Query] OpenAI Answer: "${answer}"`);
      if (!serviceUsed) {
        serviceUsed = 'openai';
      }
    }

    // 2. Validate and return text answer (frontend will call TTS endpoint separately)
    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      console.error('[Query] Invalid answer received:', answer);
      return res.status(500).json({ 
        error: 'AI response failed: Received empty or invalid answer',
        errorType: 'AI_INVALID_RESPONSE',
        details: `Answer type: ${typeof answer}, value: ${answer}`
      });
    }
    
    console.log(`[Query] Success: Returning text answer (powered by ${serviceUsed || 'unknown'})`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ 
      answer: answer,
      service: serviceUsed || 'unknown' // 'gemini' or 'openai'
    });
  } catch (err) {
    console.error('[Query] Error:', err);
    res.status(500).json({ 
      error: 'Query request failed', 
      errorType: 'SERVER_ERROR',
      details: err.message 
    });
  }
});

// Catch-all route for unmatched paths
app.use((req, res) => {
  console.error(`[404] Route not found: ${req.method} ${req.path}`);
  console.error(`[404] Request URL: ${req.url}`);
  console.error(`[404] Request headers:`, req.headers);
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
});