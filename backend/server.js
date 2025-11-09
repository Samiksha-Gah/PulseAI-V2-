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
const VOICE_ID = process.env.VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah voice

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
  const { question, context } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    console.log(`[Query] Question: "${question}"`);

    // 1. Get answer from Gemini
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a professional CPR instructor providing real-time guidance. Context: ${context || 'CPR training session'}. 
                     Answer the following question concisely in 2-3 sentences, as if speaking to someone during training.
                     Question: ${question}`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7,
            topP: 0.8,
            topK: 40
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[Query] Gemini error:', errorText);
      return res.status(geminiResponse.status).json({ error: 'AI response failed' });
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      console.error('[Query] No candidates in Gemini response');
      return res.status(500).json({ error: 'No response from AI' });
    }

    const answer = geminiData.candidates[0].content.parts[0].text;
    console.log(`[Query] Answer: "${answer}"`);

    // 2. Convert answer to speech
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: answer,
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
      const errorText = await ttsResponse.text();
      console.error('[Query] TTS error:', errorText);
      return res.status(ttsResponse.status).json({ error: 'TTS generation failed' });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
    
    console.log(`[Query] Success: ${audioBuffer.byteLength} bytes`);
  } catch (err) {
    console.error('[Query] Error:', err);
    res.status(500).json({ error: 'Query request failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 PulseAI Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 ElevenLabs API: ${ELEVENLABS_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`🔑 Gemini API: ${GEMINI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`🎤 Voice ID: ${VOICE_ID}`);
});