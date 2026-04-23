import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useGestureControl — Robust hand gesture tracking hook using MediaPipe Tasks Vision.
 * 
 * Fixes from previous version:
 * - Creates its own internal video element to avoid the conditional rendering race condition
 * - Matches WASM CDN version to the installed npm package version
 * - Provides user-facing error/status messages instead of silent console.error
 * - Handles GPU delegate gracefully with CPU fallback
 * - Properly handles permission denied, missing camera, and browser compat
 * 
 * @param {boolean} isActive - Whether gesture tracking should be active
 * @returns {{ isReady, gestureState, videoRef, statusMessage, errorMessage }}
 */
export function useGestureControl(isActive) {
  const [isReady, setIsReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [gestureState, setGestureState] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    isPinching: false,
  });

  // This ref is passed to the consumer to attach to a <video> for preview display.
  // BUT we also create an internal hidden video element as fallback, so the hook
  // never depends on the consumer rendering the <video> in time.
  const videoRef = useRef(null);
  const internalVideoRef = useRef(null);
  const requestRef = useRef(null);
  const smoothedX = useRef(window.innerWidth / 2);
  const smoothedY = useRef(window.innerHeight / 2);
  const handLandmarkerRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (handLandmarkerRef.current) {
      try { handLandmarkerRef.current.close(); } catch (e) { /* ignore */ }
      handLandmarkerRef.current = null;
    }
    if (internalVideoRef.current) {
      internalVideoRef.current.srcObject = null;
      internalVideoRef.current.remove();
      internalVideoRef.current = null;
    }
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (!isActive) {
      cleanup();
      setStatusMessage('');
      setErrorMessage('');
      return;
    }

    let active = true;
    
    const setStatus = (msg) => { if (active) setStatusMessage(msg); };
    const setError = (msg) => { if (active) { setErrorMessage(msg); setStatusMessage(''); } };

    const initializeAI = async () => {
      try {
        // --- Step 1: Check Browser Compatibility ---
        setStatus('Checking browser compatibility...');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Camera access requires HTTPS or localhost. Your browser blocked it.');
          return;
        }

        // --- Step 2: Load MediaPipe WASM + Model ---
        setStatus('Downloading AI models...');
        console.log("🤖 GESTURE: Loading MediaPipe WASM runtime...");

        // Dynamically import to avoid breaking the bundle if the package is missing
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

        // Use the same version as the installed npm package for compatibility
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );

        if (!active) return;
        setStatus('Initializing hand tracker...');
        
        // Try GPU first, fall back to CPU
        let handLandmarker;
        try {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          console.log("🤖 GESTURE: Using GPU delegate ✓");
        } catch (gpuErr) {
          console.warn("🤖 GESTURE: GPU delegate failed, falling back to CPU...", gpuErr);
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          console.log("🤖 GESTURE: Using CPU delegate ✓");
        }

        if (!active) { handLandmarker.close(); return; }
        handLandmarkerRef.current = handLandmarker;

        // --- Step 3: Request Camera Access ---
        setStatus('Requesting camera permission...');
        console.log("🤖 GESTURE: Requesting camera...");

        let stream;
        try {
          // Try ideal resolution, gracefully degrade
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640, min: 320 },
              height: { ideal: 480, min: 240 },
              facingMode: "user"
            },
            audio: false
          });
        } catch (camErr) {
          // On mobile, facingMode might not be supported — retry without it
          console.warn("🤖 GESTURE: Retrying camera without facingMode...", camErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 480 } },
              audio: false
            });
          } catch (camErr2) {
            if (camErr2.name === 'NotAllowedError') {
              setError('Camera permission denied. Please allow camera access and try again.');
            } else if (camErr2.name === 'NotFoundError') {
              setError('No camera found on this device.');
            } else if (camErr2.name === 'NotReadableError') {
              setError('Camera is already in use by another application.');
            } else {
              setError(`Camera error: ${camErr2.message}`);
            }
            return;
          }
        }

        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        mediaStreamRef.current = stream;
        console.log("🤖 GESTURE: Camera connected ✓");

        // --- Step 4: Create Video Element ---
        // Create an internal hidden video element. This avoids the race condition where
        // the consumer's <video ref={videoRef}> hasn't rendered yet.
        const internalVideo = document.createElement('video');
        internalVideo.setAttribute('autoplay', '');
        internalVideo.setAttribute('playsinline', '');
        internalVideo.setAttribute('muted', '');
        internalVideo.muted = true;
        internalVideo.playsInline = true;
        internalVideo.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(internalVideo);
        internalVideoRef.current = internalVideo;

        internalVideo.srcObject = stream;

        // Also connect to the consumer's video ref for display preview
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        setStatus('Starting camera feed...');

        // Wait for the video to actually have data
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Camera feed timeout')), 10000);
          internalVideo.onloadeddata = () => { clearTimeout(timeout); resolve(); };
          internalVideo.onerror = (e) => { clearTimeout(timeout); reject(e); };
          internalVideo.play().catch(reject);
        });

        if (!active) return;
        console.log("🤖 GESTURE: Video feed active ✓ — Starting tracking!");
        setStatus('');
        setIsReady(true);

        // --- Step 5: Tracking Loop ---
        let lastTimestamp = -1;
        
        const predictWebcam = () => {
          if (!active || !internalVideoRef.current || !handLandmarkerRef.current) return;

          const video = internalVideoRef.current;
          
          // Only process if we have new video data (avoids duplicate timestamp errors)
          const nowMs = performance.now();
          if (nowMs <= lastTimestamp) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
          }
          lastTimestamp = nowMs;

          try {
            if (video.readyState < 2) {
              // Video not ready yet, skip this frame
              requestRef.current = requestAnimationFrame(predictWebcam);
              return;
            }

            const results = handLandmarkerRef.current.detectForVideo(video, nowMs);

            if (results.landmarks && results.landmarks.length > 0) {
              const landmarks = results.landmarks[0];
              const indexTip = landmarks[8];  // Index finger tip
              const thumbTip = landmarks[4];  // Thumb tip

              // Map AI coords (0-1 normalized, mirrored) to screen coords
              const targetX = (1 - indexTip.x) * window.innerWidth;
              const targetY = indexTip.y * window.innerHeight;

              // Smooth the movement for less jitter
              smoothedX.current += (targetX - smoothedX.current) * 0.3;
              smoothedY.current += (targetY - smoothedY.current) * 0.3;

              // Calculate 3D pinch distance (thumb tip to index tip)
              const dx = indexTip.x - thumbTip.x;
              const dy = indexTip.y - thumbTip.y;
              const dz = (indexTip.z || 0) - (thumbTip.z || 0);
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

              setGestureState({
                x: smoothedX.current,
                y: smoothedY.current,
                isPinching: distance < 0.08 // Much more forgiving threshold for varied hand sizes
              });
            }
          } catch (e) {
            // Don't log every dropped frame, just skip it
            if (e.message && !e.message.includes('timestamp')) {
              console.warn("🤖 GESTURE: Frame error:", e.message);
            }
          }

          if (active) {
            requestRef.current = requestAnimationFrame(predictWebcam);
          }
        };

        predictWebcam();

      } catch (err) {
        console.error("🤖 GESTURE: Initialization failed:", err);
        if (active) {
          if (err.message?.includes('Failed to fetch')) {
            setError('Failed to download AI models. Check your internet connection.');
          } else if (err.message?.includes('timeout')) {
            setError('Camera feed timed out. Try refreshing the page.');
          } else {
            setError(`Gesture control failed: ${err.message || 'Unknown error'}`);
          }
        }
      }
    };

    initializeAI();

    return () => {
      active = false;
      cleanup();
    };
  }, [isActive, cleanup]);

  // Sync the consumer's video ref whenever it becomes available (after render)
  useEffect(() => {
    if (isReady && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isReady]);

  return { isReady, gestureState, videoRef, statusMessage, errorMessage };
}