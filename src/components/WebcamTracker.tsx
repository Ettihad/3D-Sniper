/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Camera as CameraIcon, AlertTriangle, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { sound } from '../lib/audio';
import { GestureCalibration } from '../types';

interface WebcamTrackerProps {
  onTrackingUpdate: (x: number, y: number, isTracking: boolean, isFiring: boolean, handLandmarks?: any) => void;
  calibration: GestureCalibration;
  isPaused: boolean;
}

export interface WebcamTrackerHandle {
  stopCamera: () => void;
  startCamera: () => void;
}

// Shared registry to store script loading promises to prevent double injection and timing races
const scriptLoadingPromises: Record<string, Promise<void>> = {};

const loadScriptWithRegistry = (src: string): Promise<void> => {
  if (scriptLoadingPromises[src]) {
    return scriptLoadingPromises[src];
  }

  const promise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement;
    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolve();
        return;
      }
      const onScriptLoad = () => {
        existingScript.dataset.loaded = 'true';
        resolve();
      };
      existingScript.addEventListener('load', onScriptLoad);
      existingScript.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.dataset.loaded = 'false';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(script);
  });

  scriptLoadingPromises[src] = promise;
  return promise;
};

export const WebcamTracker = forwardRef<WebcamTrackerHandle, WebcamTrackerProps>(
  ({ onTrackingUpdate, calibration, isPaused }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [engineStatus, setEngineStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
    const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [fps, setFps] = useState<number>(0);

    const handsInstanceRef = useRef<any>(null);
    const cameraInstanceRef = useRef<any>(null);
    const animationFrameRef = useRef<number | null>(null);
    const isComponentMounted = useRef<boolean>(true);

    // Sync props to refs to prevent stale closure bugs in asynchronous MediaPipe callbacks
    const isPausedRef = useRef<boolean>(isPaused);
    const calibrationRef = useRef<GestureCalibration>(calibration);
    const onTrackingUpdateRef = useRef(onTrackingUpdate);

    useEffect(() => {
      isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
      calibrationRef.current = calibration;
    }, [calibration]);

    useEffect(() => {
      onTrackingUpdateRef.current = onTrackingUpdate;
    }, [onTrackingUpdate]);

    // Filter values for EMA Smoothing
    const lastXRef = useRef<number>(0.5);
    const lastYRef = useRef<number>(0.5);
    const isPinchingRef = useRef<boolean>(false);
    const frameCountRef = useRef<number>(0);
    const lastFpsUpdateRef = useRef<number>(performance.now());

    // Allow parent component to stop/start the camera
    useImperativeHandle(ref, () => ({
      stopCamera: () => {
        cleanupTracker();
      },
      startCamera: () => {
        if (cameraPermission === 'granted') {
          initMediaPipe();
        }
      }
    }));

    useEffect(() => {
      isComponentMounted.current = true;
      // Start the media pipe tracking
      initMediaPipe();

      return () => {
        isComponentMounted.current = false;
        cleanupTracker();
      };
    }, []);

    // Cleanup MediaPipe completely to release resource hooks
    const cleanupTracker = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (cameraInstanceRef.current) {
        try {
          cameraInstanceRef.current.stop();
        } catch (e) {
          console.log('Error stopping camera:', e);
        }
        cameraInstanceRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (handsInstanceRef.current) {
        try {
          handsInstanceRef.current.close();
        } catch (e) {
          console.log('Error closing Hands tracker:', e);
        }
        handsInstanceRef.current = null;
      }
    };

    // Load scripts dynamically
    const loadMediaPipeScripts = async (): Promise<boolean> => {
      try {
        setEngineStatus('loading');
        
        // Load camera_utils and hands in parallel using registry to avoid race conditions
        await loadScriptWithRegistry('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScriptWithRegistry('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js');
        
        return true;
      } catch (err: any) {
        console.error('Failed to load MediaPipe CDN dependencies:', err);
        setErrorMessage('Could not retrieve tracking models from CDN. Please check your network or try again.');
        setEngineStatus('error');
        return false;
      }
    };

    const initMediaPipe = async () => {
      cleanupTracker();

      const scriptsLoaded = await loadMediaPipeScripts();
      if (!scriptsLoaded || !isComponentMounted.current) return;

      const windowAny = window as any;
      if (!windowAny.Hands || !windowAny.Camera) {
        setErrorMessage('MediaPipe Hand tracking engine binaries not loaded on window context.');
        setEngineStatus('error');
        return;
      }

      // 1. Setup Camera constraints and grab user permission
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        setCameraPermission('granted');
        testStream.getTracks().forEach(track => track.stop()); // Stop immediately
      } catch (mediaError: any) {
        console.error('Camera access denied:', mediaError);
        setCameraPermission('denied');
        setErrorMessage('Camera access denied. Please click the permissions icon on your address bar to enable webcam.');
        setEngineStatus('error');
        // Notify parent that we should fallback to mouse/touch mode
        onTrackingUpdateRef.current(0.5, 0.5, false, false);
        return;
      }

      // 2. Initialize MediaPipe Hands
      try {
        const hands = new windowAny.Hands({
          locateFile: (file: string) => {
            // If the file path is already a full URL, reuse it directly to avoid mismatch keys
            if (file.startsWith('https://cdn.jsdelivr.net') || file.startsWith('http')) {
              return file;
            }
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
          }
        });

        // Optimize settings for maximum framerate and lowest latency
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });

        hands.onResults((results: any) => {
          if (!isComponentMounted.current || isPausedRef.current) return;
          processTrackingResults(results);
        });

        handsInstanceRef.current = hands;

        // 3. Setup Webcam element
        if (videoRef.current) {
          let isProcessingFrame = false;
          const camera = new windowAny.Camera(videoRef.current, {
            onFrame: async () => {
              if (!isComponentMounted.current) return;
              if (isProcessingFrame) return; // Drop frame if still processing prediction to avoid queue backlogs
              if (handsInstanceRef.current && videoRef.current) {
                isProcessingFrame = true;
                try {
                  await handsInstanceRef.current.send({ image: videoRef.current });
                } catch (e) {
                  console.error('Hand tracking calculation error:', e);
                } finally {
                  isProcessingFrame = false;
                }
              }
            },
            width: 480,
            height: 360
          });

          await camera.start();
          cameraInstanceRef.current = camera;
          setEngineStatus('active');
        }
      } catch (err: any) {
        console.error('Fatal initialization error in hand-pose model:', err);
        setErrorMessage(`Initialization error: ${err.message || err}`);
        setEngineStatus('error');
      }
    };

    // Main tracking algorithm and gesture extraction!
    const processTrackingResults = (results: any) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      // Reset coordinates if no hand is detected
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        // Clear landmarks on overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onTrackingUpdateRef.current(lastXRef.current, lastYRef.current, false, false);
        return;
      }

      // Calculate FPS
      const now = performance.now();
      frameCountRef.current++;
      if (now - lastFpsUpdateRef.current >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current)));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      const handLandmarks = results.multiHandLandmarks[0];
      
      // Extract target coordinates - LandMark 8 (Index tip)
      const indexTip = handLandmarks[8];
      
      // Implement orientation alignment
      let rawX = indexTip.x;
      if (calibrationRef.current.mirrorCamera) {
        rawX = 1 - indexTip.x; // Mirroring maps movement correctly (Left -> Left)
      }
      const rawY = indexTip.y;

      // Apply coordinate scaling & clipping (aim sensitivity) to make the pointer reach corners comfortably of screen
      const sensitivity = calibrationRef.current.aimSensitivity ?? 1.8;
      
      // We map around the natural centers: x_center = 0.5, y_center = 0.45 (comfort level raised)
      const xCenter = 0.5;
      const yCenter = 0.45;
      
      const halfRangeX = 0.5 / sensitivity;
      const halfRangeY = 0.5 / sensitivity;
      
      const minX = xCenter - halfRangeX;
      const maxX = xCenter + halfRangeX;
      const minY = yCenter - halfRangeY;
      const maxY = yCenter + halfRangeY;
      
      let scaledX = (rawX - minX) / (maxX - minX);
      let scaledY = (rawY - minY) / (maxY - minY);
      
      // Clamp to 0..1 bounds
      scaledX = Math.max(0, Math.min(1, scaledX));
      scaledY = Math.max(0, Math.min(1, scaledY));

      // Apply Exponential Moving Average (EMA) to prevent jitter and maximize aiming precision
      const alpha = calibrationRef.current.aimSmoothing;
      const smoothX = alpha * scaledX + (1 - alpha) * lastXRef.current;
      const smoothY = alpha * scaledY + (1 - alpha) * lastYRef.current;

      // Update refs
      lastXRef.current = smoothX;
      lastYRef.current = smoothY;

      // Extract gestures (Pinch or Finger Gun)
      const thumbTip = handLandmarks[4];
      const middleTip = handLandmarks[12];

      const dx8 = thumbTip.x - indexTip.x;
      const dy8 = thumbTip.y - indexTip.y;
      const dz8 = thumbTip.z - indexTip.z;
      const distIndex = Math.hypot(dx8, dy8, dz8);

      const dx12 = thumbTip.x - middleTip.x;
      const dy12 = thumbTip.y - middleTip.y;
      const dz12 = thumbTip.z - middleTip.z;
      const distMiddle = Math.hypot(dx12, dy12, dz12);

      // Determine the minimum pinch distance (either index finger or middle finger)
      const minDistance = Math.min(distIndex, distMiddle);

      // Simple click state transition with threshold hysteresis to prevent stuttering fire
      let triggerFire = false;
      const pinchThreshold = calibrationRef.current.pinchThreshold;
      const releaseThreshold = pinchThreshold + 0.025; // Release requires higher gap

      if (isPinchingRef.current) {
        if (minDistance > releaseThreshold) {
          isPinchingRef.current = false;
        }
      } else {
        if (minDistance < pinchThreshold) {
          isPinchingRef.current = true;
          triggerFire = true; // Blast triggered on down-beat
        }
      }

      // Pass coordinates up to canvas engine (0..1 bounds)
      onTrackingUpdateRef.current(smoothX, smoothY, true, triggerFire, handLandmarks);

      // Draw cybernetic overlay overlaying the camera feed
      drawHandSkeletalOverlay(ctx, canvas, handLandmarks, minDistance < pinchThreshold);
    };

    // Draw highly stylized cyberpunk virtual tracking lines onto the Canvas overlay
    const drawHandSkeletalOverlay = (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      landmarks: any[],
      isFiring: boolean
    ) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Define skeletal connections
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [5, 9], [9, 10], [10, 11], [11, 12], // Middle
        [9, 13], [13, 14], [14, 15], [15, 16], // Ring
        [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [0, 17] // Palm Base Connection
      ];

      // Draw bones
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = isFiring ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.6)';
      
      connections.forEach(([p1, p2]) => {
        const pt1 = landmarks[p1];
        const pt2 = landmarks[p2];
        if (pt1 && pt2) {
          const x1 = calibrationRef.current.mirrorCamera ? (1 - pt1.x) * w : pt1.x * w;
          const y1 = pt1.y * h;
          const x2 = calibrationRef.current.mirrorCamera ? (1 - pt2.x) * w : pt2.x * w;
          const y2 = pt2.y * h;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
      });
      ctx.stroke();

      // Draw nodes (joints) with highly efficient batched drawing instructions
      ctx.beginPath();
      landmarks.forEach((pt, index) => {
        if (index === 8 || index === 4 || !pt) return;
        const cx = calibrationRef.current.mirrorCamera ? (1 - pt.x) * w : pt.x * w;
        const cy = pt.y * h;
        ctx.moveTo(cx + 3.5, cy);
        ctx.arc(cx, cy, 3.5, 0, 2 * Math.PI);
      });
      ctx.fillStyle = '#60a5fa';
      ctx.fill();

      // Draw trigger glowing hotspots (index tip 8 and thumb tip 4) separately
      [4, 8].forEach(index => {
        const pt = landmarks[index];
        if (!pt) return;
        const cx = calibrationRef.current.mirrorCamera ? (1 - pt.x) * w : pt.x * w;
        const cy = pt.y * h;
        
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        ctx.fillStyle = isFiring ? '#ef4444' : '#10b981';
        ctx.shadowColor = isFiring ? '#ef4444' : '#10b981';
        ctx.shadowBlur = 8;
        ctx.fill();
      });

      // Reset shadows immediately
      ctx.shadowBlur = 0;

      // Draw proximity guide between landmark 4 and index tip 8
      const p4 = landmarks[4];
      const p8 = landmarks[8];
      if (p4 && p8) {
        const x4 = calibrationRef.current.mirrorCamera ? (1 - p4.x) * w : p4.x * w;
        const y4 = p4.y * h;
        const x8 = calibrationRef.current.mirrorCamera ? (1 - p8.x) * w : p8.x * w;
        const y8 = p8.y * h;

        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = isFiring ? '#f87171' : '#34d399';
        ctx.moveTo(x4, y4);
        ctx.lineTo(x8, y8);
        ctx.stroke();
        ctx.setLineDash([]); // Reset
      }
    };

    return (
      <div className="relative w-full aspect-[4/3] max-w-sm mx-auto bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col items-center justify-center">
        {/* Mirror Camera Feed Behind Canvas Overlay */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none ${
            calibrationRef.current.mirrorCamera ? 'scale-x-[-1]' : ''
          } opacity-40 z-0`}
          playsInline
          muted
        />

        {/* Cyber Canvas Bone Overlay */}
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-10"
        />

        {/* Dynamic status display overlays */}
        {engineStatus === 'loading' && (
          <div className="absolute inset-0 z-20 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center animate-pulse">
            <RefreshCw className="h-10 w-10 text-emerald-400 animate-spin mb-4" />
            <h4 className="text-emerald-400 font-mono tracking-wider text-sm font-semibold uppercase">
              Connecting Neuromorphic Engine
            </h4>
            <p className="text-slate-400 text-xs mt-2 max-w-[240px]">
              Downloading tracking assets and compiling neural WebAssembly weights from CDN...
            </p>
          </div>
        )}

        {engineStatus === 'error' && (
          <div className="absolute inset-0 z-20 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center border-2 border-red-500/20 rounded-2xl">
            {cameraPermission === 'denied' ? (
              <ShieldAlert className="h-12 w-12 text-red-400 mb-3" />
            ) : (
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-3" />
            )}
            <h4 className="text-red-400 font-mono text-sm uppercase font-bold tracking-wider">
              Webcam Feed Blocked
            </h4>
            <p className="text-slate-300 text-xs mt-2 max-w-[260px] leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => {
                sound.playBlip();
                initMediaPipe();
              }}
              className="mt-4 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-mono font-medium transition duration-200"
            >
              Retry Connection
            </button>
          </div>
        )}

        {engineStatus === 'active' && (
          <div className="absolute bottom-3 left-3 z-20 flex gap-2 items-center">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest bg-slate-950/60 px-2 py-0.5 rounded">
              CV Tracking Live • {fps} FPS
            </span>
          </div>
        )}

        {/* Welcome layout if idle */}
        {engineStatus === 'idle' && (
          <div className="p-8 text-center flex flex-col items-center z-10">
            <CameraIcon className="h-10 w-10 text-emerald-400 mb-3 animate-pulse" />
            <h3 className="text-white text-sm font-mono tracking-wider uppercase font-semibold">
              Hands Gesture Mode
            </h3>
            <p className="text-slate-400 text-xs mt-2 max-w-[240px]">
              Grants system-level camera access to track target positioning using neural nodes.
            </p>
          </div>
        )}
      </div>
    );
  }
);

WebcamTracker.displayName = 'WebcamTracker';
