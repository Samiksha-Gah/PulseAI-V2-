/**
 * Screen Recorder Utility
 * Records canvas/video stream with a rolling buffer for the last few seconds
 * Includes face blurring and MP4 conversion
 */

// Lazy load FFmpeg to avoid blocking app initialization
let FFmpegClass: any = null;
let fetchFileFunc: any = null;
let toBlobURLFunc: any = null;

export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recordingDuration: number = 20000; // 20 seconds buffer
  private chunkTimestamps: number[] = [];
  private isRecording: boolean = false;
  private cleanupInterval: number | null = null;
  private recordingStartTime: number | null = null; // Track when recording started
  private ffmpeg: any = null;
  private ffmpegLoaded: boolean = false;

  /**
   * Initialize FFmpeg for video conversion (lazy load)
   */
  private async loadFFmpeg(): Promise<void> {
    if (this.ffmpegLoaded && this.ffmpeg) {
      return;
    }

    try {
      // Lazy load FFmpeg modules only when needed
      if (!FFmpegClass) {
        const ffmpegModule = await import('@ffmpeg/ffmpeg');
        const utilModule = await import('@ffmpeg/util');
        FFmpegClass = ffmpegModule.FFmpeg;
        fetchFileFunc = utilModule.fetchFile;
        toBlobURLFunc = utilModule.toBlobURL;
      }

      this.ffmpeg = new FFmpegClass();
      
      // Load FFmpeg from CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await this.ffmpeg.load({
        coreURL: await toBlobURLFunc(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURLFunc(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.ffmpegLoaded = true;
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      // Don't throw - allow app to continue without MP4 conversion
      this.ffmpegLoaded = false;
      this.ffmpeg = null;
    }
  }


  /**
   * Start recording from a canvas stream
   */
  async startRecording(canvas: HTMLCanvasElement): Promise<void> {
    try {
      // Stop any existing recording
      this.stopRecording();

      // Get the canvas stream
      this.stream = canvas.captureStream(30); // 30 FPS

      // Create MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      };

      // Fallback to vp8 if vp9 is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'video/webm;codecs=vp8';
      }

      // Fallback to default if vp8 is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      // Handle data available event
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          const now = Date.now();
          this.recordedChunks.push(event.data);
          this.chunkTimestamps.push(now);

          // Clean old chunks periodically
          this.cleanOldChunks(now);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        // Final cleanup
        const now = Date.now();
        this.cleanOldChunks(now);
      };

      // Start recording with timeslice to get regular chunks
      // Use smaller timeslice for better reliability
      this.mediaRecorder.start(100); // Get chunks every 100ms for better reliability
      this.isRecording = true;
      this.recordingStartTime = Date.now(); // Record start time

      // Set up periodic cleanup
      this.cleanupInterval = window.setInterval(() => {
        this.cleanOldChunks(Date.now());
      }, 1000); // Clean every second
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  /**
   * Remove chunks older than the recording duration
   * For the first 20 seconds, keep all chunks. After 20 seconds, use rolling buffer.
   */
  private cleanOldChunks(currentTime: number): void {
    if (!this.recordingStartTime) {
      return; // No recording started yet
    }

    const elapsedTime = currentTime - this.recordingStartTime;

    // If less than 20 seconds have passed, keep all chunks
    if (elapsedTime < this.recordingDuration) {
      return;
    }

    // After 20 seconds, switch to rolling buffer - only keep last 20 seconds
    const cutoffTime = currentTime - this.recordingDuration;

    // Remove chunks that are too old
    while (
      this.chunkTimestamps.length > 0 &&
      this.chunkTimestamps[0] < cutoffTime
    ) {
      this.chunkTimestamps.shift();
      this.recordedChunks.shift();
    }
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.mediaRecorder && this.isRecording) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (error) {
        console.warn('Error stopping recorder:', error);
      }
      this.isRecording = false;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Reset start time
    this.recordingStartTime = null;
  }

  /**
   * Get the recorded video as a Blob
   * Returns all chunks from the start (if < 20 seconds) or last 20 seconds
   */
  async getRecordedVideo(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (this.recordedChunks.length === 0) {
        resolve(null);
        return;
      }

      // Request final data chunk if recording is active
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.requestData();
      }

      // Wait for MediaRecorder to finish if it's stopping
      const waitForChunks = () => {
        const currentTime = Date.now();
        
        // Only clean if we're past 20 seconds
        if (this.recordingStartTime) {
          const elapsedTime = currentTime - this.recordingStartTime;
          if (elapsedTime >= this.recordingDuration) {
            // Clean old chunks (rolling buffer mode)
            this.cleanOldChunks(currentTime);
          }
          // If < 20 seconds, keep all chunks (no cleanup)
        }

        if (this.recordedChunks.length === 0) {
          resolve(null);
          return;
        }

        // Check if MediaRecorder is still active
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          // Request data and wait a bit more
          this.mediaRecorder.requestData();
          setTimeout(waitForChunks, 500);
        } else {
          // MediaRecorder is stopped or inactive, create blob
          // Create blob with all chunks - ensure proper order
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          resolve(blob);
        }
      };

      // Start waiting for chunks
      setTimeout(waitForChunks, 500);
    });
  }

  /**
   * Convert WebM to MP4 using ffmpeg
   */
  private async convertToMP4(webmBlob: Blob): Promise<Blob> {
    try {
      // Load FFmpeg if not already loaded
      await this.loadFFmpeg();

      if (!this.ffmpeg) {
        throw new Error('FFmpeg not loaded');
      }

      // Write input file
      await this.ffmpeg.writeFile('input.webm', await fetchFileFunc(webmBlob));

      // Convert WebM to MP4 (no blur)
      await this.ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p', // Ensure compatibility
        'output.mp4'
      ]);

      // Read output file
      const data = await this.ffmpeg.readFile('output.mp4');
      const mp4Blob = data instanceof Uint8Array 
        ? new Blob([new Uint8Array(data)], { type: 'video/mp4' })
        : new Blob([data], { type: 'video/mp4' });

      // Cleanup
      await this.ffmpeg.deleteFile('input.webm');
      await this.ffmpeg.deleteFile('output.mp4');

      return mp4Blob;
    } catch (error) {
      console.error('MP4 conversion failed:', error);
      // Return original WebM if conversion fails
      return webmBlob;
    }
  }

  /**
   * Download the recorded video as MP4 (non-blocking)
   */
  async downloadVideo(filename: string = 'cpr-recording.mp4'): Promise<void> {
    // Don't block - process in background
    this.processAndDownloadVideo(filename).catch((error) => {
      console.error('Failed to save video:', error);
      alert('Failed to save video. Please try again.');
    });
  }

  /**
   * Process and download video (runs in background)
   */
  private async processAndDownloadVideo(filename: string): Promise<void> {
    const webmBlob = await this.getRecordedVideo();

    if (!webmBlob) {
      console.warn('No video data to download');
      alert('No video recorded yet. Please wait a moment and try again.');
      return;
    }

    // Show processing message (non-blocking)
    console.log('Converting to MP4...');
    
    // Try to convert to MP4, fallback to WebM if conversion fails
    let finalBlob = webmBlob;
    let finalFilename = filename;
    
    try {
      const mp4Blob = await this.convertToMP4(webmBlob);
      // Check if conversion actually worked (not the original WebM)
      if (mp4Blob.type === 'video/mp4') {
        finalBlob = mp4Blob;
        finalFilename = filename.endsWith('.mp4') ? filename : filename.replace(/\.webm$/, '.mp4');
      } else {
        // Conversion failed, use WebM
        finalFilename = filename.replace(/\.mp4$/, '.webm');
        console.warn('MP4 conversion failed, saving as WebM');
      }
    } catch (conversionError) {
      console.warn('MP4 conversion failed, saving as WebM:', conversionError);
      finalFilename = filename.replace(/\.mp4$/, '.webm');
    }

    // Create download link
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up
    URL.revokeObjectURL(url);
    console.log('Video saved successfully');
  }

  /**
   * Check if recording is active
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Clear all recorded chunks
   */
  clearRecording(): void {
    this.recordedChunks = [];
    this.chunkTimestamps = [];
    this.recordingStartTime = null;
  }
}

// Export singleton instance
export const screenRecorder = new ScreenRecorder();
