const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
app.use(cors());

// Multer storage to temp dir
const upload = multer({ dest: os.tmpdir() });

// POST /remux - expects multipart/form-data with 'file' and optional 'trimSeconds' and 'outFormat'
app.post('/remux', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const trimSeconds = parseInt(req.body.trimSeconds || '10', 10);
    const outFormat = (req.body.outFormat || 'mkv').toLowerCase();

    const inputPath = req.file.path;
    const outName = `remux-${Date.now()}.${outFormat}`;
    const outPath = path.join(os.tmpdir(), outName);

    // Check ffmpeg available
    const ffmpeg = 'ffmpeg';

    // We will re-encode to a robust container. Use sseof to seek from EOF.
    // For best compatibility we transcode video to H.264 and audio to AAC.
    // Command:
    // ffmpeg -y -sseof -{trimSeconds} -i input -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k out.mkv

    const args = [
      '-y',
      '-sseof', `-${trimSeconds}`,
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      outPath,
    ];

    const ff = spawn(ffmpeg, args);

    let stderr = '';
    ff.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ff.on('close', (code) => {
      // Clean up input file
      try { fs.unlinkSync(inputPath); } catch (e) {}

      if (code !== 0) {
        console.error('ffmpeg exited with', code, stderr);
        try { fs.unlinkSync(outPath); } catch (e) {}
        return res.status(500).json({ error: 'ffmpeg failed', details: stderr });
      }

      // Send file
      res.download(outPath, outName, (err) => {
        // Remove output after sending
        try { fs.unlinkSync(outPath); } catch (e) {}
        if (err) {
          console.error('Error sending file', err);
        }
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Remux server listening on port ${port}`);
  console.log('Requires ffmpeg available in PATH');
});
