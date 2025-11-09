# Render Deployment Guide

## Required Environment Variables

Your backend service on Render needs the following environment variables configured:

### Required API Keys

1. **OPENAI_API_KEY** (Required)
   - Used for:
     - Speech-to-text transcription (Whisper API)
     - AI question answering (fallback if Gemini fails)
   - Get your key from: https://platform.openai.com/api-keys

2. **GEMINI_API_KEY** (Required for Gemini)
   - Used for AI question answering (primary)
   - Get your key from: https://makersuite.google.com/app/apikey

3. **ELEVENLABS_API_KEY** (Required)
   - Used for text-to-speech audio responses
   - Get your key from: https://elevenlabs.io/app/settings/api-keys

### Optional Configuration

4. **VOICE_ID** (Optional)
   - Default: `EXAVITQu4vr4xnSDxMaL` (Sarah voice)
   - Find other voices at: https://elevenlabs.io/app/voices

5. **GEMINI_MODEL** (Optional)
   - Default: `gemini-2.5-pro`
   - Other options: `gemini-pro`, `gemini-1.5-pro`, etc.

6. **ANSWER_MAX_WORDS** (Optional)
   - Default: `20`
   - Maximum words in AI response before truncation

7. **PORT** (Optional)
   - Default: `3001`
   - Render will set this automatically, but you can override if needed

## How to Set Environment Variables in Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Select your backend service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add each variable:
   - Key: `OPENAI_API_KEY`
   - Value: `sk-...` (your actual API key)
6. Repeat for all required keys
7. **Save Changes** - Render will automatically redeploy

## Verification

After setting environment variables, check your Render logs to verify:

```
🔑 ElevenLabs API: ✓ Configured
🔑 Gemini API: ✓ Configured
🤖 Gemini Model: gemini-2.5-pro
🔑 OpenAI API: ✓ Configured
```

If you see `✗ Missing` for any key, that variable is not set correctly.

## Common Issues

### "OpenAI API key not configured"
- Make sure `OPENAI_API_KEY` is set in Render environment variables
- Check that the value doesn't have extra spaces or quotes
- Redeploy after adding the variable

### "Both Gemini and OpenAI failed"
- Ensure at least one of `GEMINI_API_KEY` or `OPENAI_API_KEY` is set
- Check API keys are valid and have credits/quota
- Check Render logs for detailed error messages

### "ElevenLabs API key not configured"
- Set `ELEVENLABS_API_KEY` in Render environment variables
- Verify the key is active in your ElevenLabs account

## Security Notes

- Never commit API keys to git
- Use Render's environment variables (not hardcoded values)
- Rotate keys if they're exposed
- Use different keys for development and production if possible

