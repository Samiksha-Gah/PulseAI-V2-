# PulseAI: Real-Time CPR Training with Computer Vision

## Inspiration

Cardiac arrest can happen anywhere, at any time. According to the American Heart Association, effective bystander CPR can double or triple survival rates, yet only about 46% of people who experience cardiac arrest receive CPR before professional help arrives. Traditional CPR training requires expensive manikins, in-person classes, and periodic recertification—barriers that prevent many people from learning this life-saving skill.

We built **PulseAI** to democratize CPR training by bringing it directly to people's devices. Using just a webcam and a browser, anyone can practice CPR technique and receive real-time, AI-powered feedback on their compression rate, depth, and hand placement—the three critical metrics that determine CPR effectiveness.

## What We Learned

Building PulseAI was a deep dive into several cutting-edge technologies:

### Computer Vision in the Browser
We learned to leverage **TensorFlow.js** and **MoveNet** for real-time pose detection entirely in the browser—no server required. This taught us about:
- Optimizing ML model inference for 30 FPS performance
- Handling WebGL backend initialization and memory management
- Working with pose keypoints and understanding their spatial relationships

### Privacy-First Design
Implementing **OpenCV.js** for face detection and blurring taught us the importance of privacy in healthcare applications. We learned to:
- Process video frames in real-time with minimal performance impact
- Cascade classifier initialization and optimization
- Balancing privacy protection with computational efficiency

### Real-Time Signal Processing
Calculating accurate CPR metrics from noisy pose data required learning:
- **BPM calculation** using weighted averages and interval analysis: \\(BPM = \\frac{60}{\\text{avg interval}}\\)
- **Depth estimation** from normalized keypoint distances: \\(depth = \\text{normalize}(\\|wrist - shoulder\\|)\\)
- **Compression detection** using threshold-based state machines to filter false positives

### Web Performance Optimization
Achieving smooth 30 FPS with multiple ML models running simultaneously required:
- Throttling pose detection to balance accuracy and performance
- Efficient canvas rendering pipelines
- Memory management for long-running sessions

## How We Built It

### Architecture

PulseAI is built as a **React + TypeScript** single-page application with a modular component architecture:

```
Frontend (React + TypeScript)
├── CameraFeed.tsx          # Webcam capture, pose detection, face blurring
├── FeedbackPanel.tsx       # Real-time metrics display with color-coded feedback
├── WalkthroughMode.tsx     # Step-by-step CPR instruction flow
├── FeedbackMode.tsx        # Live practice mode with metrics
└── Utils/
    ├── cprLogic.ts         # Core CPR metric calculations
    └── cprRules.ts         # AHA-compliant feedback rules
```

### Technical Stack

- **Frontend Framework**: React 18 with TypeScript for type safety
- **Build Tool**: Vite for fast development and optimized production builds
- **ML Framework**: TensorFlow.js with MoveNet Lightning model for pose detection
- **Computer Vision**: OpenCV.js for face detection and blurring
- **Styling**: TailwindCSS with custom animations via Framer Motion

### Key Algorithms

**Compression Rate (BPM) Calculation:**
We track compression timestamps and calculate BPM using a weighted average approach:

$$BPM = 0.7 \times BPM_{new} + 0.3 \times BPM_{previous}$$

This smoothing algorithm reduces noise while maintaining responsiveness to actual rate changes.

**Compression Depth Estimation:**
Depth is calculated from the normalized distance between wrist and shoulder keypoints, accounting for camera angle and user distance:

$$depth_{normalized} = \frac{\|wrist - shoulder\|}{frame\_height}$$

**Hand Placement Analysis:**
We compute the center point between shoulders and compare wrist positions to determine if hands are properly centered on the chest, providing feedback when placement deviates by more than 15% from center.

### Real-Time Processing Pipeline

1. **Video Capture**: Webcam stream at 30 FPS
2. **Face Blurring**: OpenCV.js processes each frame to detect and blur faces
3. **Pose Detection**: MoveNet analyzes the blurred frame for body keypoints (runs at ~10 FPS to balance performance)
4. **Metric Calculation**: CPR metrics computed from keypoint positions
5. **Feedback Generation**: Rules engine evaluates metrics against AHA guidelines
6. **UI Update**: React state updates trigger smooth visual feedback

## Challenges We Faced

### Challenge 1: Pose Detection Accuracy
**Problem**: Initial pose detection was inconsistent, especially when users moved or changed angles.

**Solution**: We implemented a state machine for compression detection that tracks depth changes over time, filtering out false positives. We also added smoothing algorithms to stabilize BPM calculations.

### Challenge 2: Performance at Scale
**Problem**: Running TensorFlow.js, OpenCV.js, and React simultaneously caused frame drops and lag.

**Solution**: 
- Throttled pose detection to 10 FPS while maintaining 30 FPS video capture
- Optimized OpenCV face detection to run on every 3rd frame
- Used React refs to minimize re-renders
- Leveraged WebGL backend for GPU acceleration

### Challenge 3: Cross-Device Compatibility
**Problem**: Different devices and browsers had varying performance characteristics and camera APIs.

**Solution**: 
- Implemented graceful degradation for devices without WebGL
- Added camera permission handling and fallback UI states
- Tested across Chrome, Firefox, and Safari to ensure compatibility

### Challenge 4: Accurate Depth Measurement
**Problem**: Converting 2D keypoint positions to real-world depth measurements is inherently difficult without camera calibration.

**Solution**: We normalized depth measurements relative to the user's frame size and shoulder width, providing relative feedback rather than absolute measurements. While not perfect, this approach gives users consistent feedback for improvement.

### Challenge 5: Real-Time Feedback Latency
**Problem**: Users need immediate feedback to adjust their technique, but ML inference takes time.

**Solution**: We implemented a priority-based feedback system that shows the most critical issues first, and used optimistic UI updates to make feedback feel instant even when calculations lag slightly.

## Impact and Future Work

PulseAI makes CPR training accessible to anyone with a smartphone or computer. By removing barriers like cost, scheduling, and location, we hope to increase the number of people trained in CPR.

**Future enhancements** could include:
- Multi-person detection for training scenarios
- Integration with wearable devices for more accurate metrics
- Cloud-based session recording and progress tracking
- AR overlays for enhanced visual guidance
- Integration with emergency services for real-world scenarios

---

**Note**: This is a training application. In real emergencies, always call 911 immediately.

