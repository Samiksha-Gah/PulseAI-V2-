/**
 * Screen Recorder Utility
 * Records canvas/video stream with a rolling buffer for the last few seconds
 */

export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recordingDuration: number = 20000; // 20 seconds buffer
  private chunkTimestamps: number[] = [];
  private isRecording: boolean = false;
  private cleanupInterval: number | null = null;
  private recordingStartTime: number | null = null; // Track when recording started

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
      this.mediaRecorder.start(500); // Get chunks every 500ms for better performance
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

      // Wait a bit for any pending chunks to be processed
      setTimeout(() => {
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

        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        resolve(blob);
      }, 800);
    });
  }

  /**
   * Download the recorded video
   */
  async downloadVideo(filename: string = 'cpr-recording.webm'): Promise<void> {
    const blob = await this.getRecordedVideo();

    if (!blob) {
      console.warn('No video data to download');
      return;
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up
    URL.revokeObjectURL(url);
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

