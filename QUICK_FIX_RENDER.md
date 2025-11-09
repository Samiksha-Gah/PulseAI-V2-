# Quick Fix: Render Environment Variables

## The Problem
Your backend is missing API keys, causing:
- ❌ Voice transcription fails: "OpenAI API key not configured"
- ❌ AI responses fail: "Both Gemini and OpenAI failed"

## The Solution
Add these environment variables in Render:

### Step-by-Step:

1. **Go to Render Dashboard**
   - https://dashboard.render.com
   - Click on your backend service

2. **Go to Environment Tab**
   - Click "Environment" in the left sidebar

3. **Add These Variables:**

   ```
   OPENAI_API_KEY = sk-your-actual-openai-key-here
   GEMINI_API_KEY = AIzaSy-your-actual-gemini-key-here
   ELEVENLABS_API_KEY = your-actual-elevenlabs-key-here
   ```

4. **Save and Redeploy**
   - Click "Save Changes"
   - Render will automatically redeploy

5. **Verify in Logs**
   After redeploy, check logs. You should see:
   ```
   🔑 ElevenLabs API: ✓ Configured
   🔑 Gemini API: ✓ Configured
   🔑 OpenAI API: ✓ Configured
   ```

## Where to Get API Keys:

- **OpenAI**: https://platform.openai.com/api-keys
- **Gemini**: https://makersuite.google.com/app/apikey
- **ElevenLabs**: https://elevenlabs.io/app/settings/api-keys

## Important Notes:

- ✅ No quotes needed around values
- ✅ No spaces before/after the `=` sign
- ✅ Keys are case-sensitive
- ✅ Render will redeploy automatically after saving

## After Adding Keys:

1. Wait for redeploy to complete (2-3 minutes)
2. Test voice question - should work now
3. Test text question - should work now

If still failing, check Render logs for detailed error messages.

