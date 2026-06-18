/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, ChevronRight, Eye, Sparkles, Crosshair, Zap, RotateCcw, ThumbsUp, AlertCircle, Camera } from 'lucide-react';
import { WebcamTracker } from './WebcamTracker';
import { GestureCalibration } from '../types';
import { sound } from '../lib/audio';

interface TutorialProps {
  onBackToMenu: () => void;
  onGoToGame: () => void;
}

export const Tutorial: React.FC<TutorialProps> = ({ onBackToMenu, onGoToGame }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [pinchedStateLocal, setPinchedStateLocal] = useState<boolean>(false);
  const [targetHitCount, setTargetHitCount] = useState<number>(0);
  const trackerRef = useRef<any>(null);

  // Calibration defaults
  const [calibration, setCalibration] = useState<GestureCalibration>({
    pinchThreshold: 0.045,
    aimSmoothing: 0.22,
    mirrorCamera: true,
    gestureChoice: 'pinch'
  });

  // Local test target parameters
  const [testTarget, setTestTarget] = useState<{ x: number; y: number; hit: boolean }>({
    x: 0.4,
    y: 0.35,
    hit: false
  });

  const [localCrosshair, setLocalCrosshair] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [cameraIsTracking, setCameraIsTracking] = useState<boolean>(false);
  const [pinchDistanceMetric, setPinchDistanceMetric] = useState<number>(1.0);

  // Handle tracking coordinates update inside test arena
  const handleTrackingUpdate = (
    x: number,
    y: number,
    isTracking: boolean,
    isFiring: boolean,
    handLandmarks?: any[]
  ) => {
    setLocalCrosshair({ x, y });
    setCameraIsTracking(isTracking);
    setPinchedStateLocal(isFiring);

    if (isTracking && handLandmarks && handLandmarks[4] && handLandmarks[8]) {
      // Calculate active thumb-and-index distance metric for display
      const thumb = handLandmarks[4];
      const index = handLandmarks[8];
      const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y, thumb.z - index.z);
      setPinchDistanceMetric(parseFloat(dist.toFixed(3)));

      // If active firing is triggered in tutorial arena, check sandbox collision
      if (isFiring && !testTarget.hit) {
        // Map sandbox bounds
        const dx = x - testTarget.x;
        const dy = y - testTarget.y;
        const distToTgt = Math.hypot(dx, dy);

        if (distToTgt <= 0.08) { // Forgiving sandbox collision size
          setTestTarget(prev => ({ ...prev, hit: true }));
          sound.playHit();
          setTargetHitCount(c => c + 1);

          // Spawn new target randomly in sandbox soon
          setTimeout(() => {
            setTestTarget({
              x: 0.15 + Math.random() * 0.7,
              y: 0.2 + Math.random() * 0.5,
              hit: false
            });
          }, 1200);
        } else {
          sound.playLaser();
        }
      }
    }
  };

  const handleManualSandboxClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Force mouse shooting click
    sound.playLaser();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const dx = x - testTarget.x;
    const dy = y - testTarget.y;
    const distToTgt = Math.hypot(dx, dy);

    if (distToTgt <= 0.08) {
      setTestTarget(prev => ({ ...prev, hit: true }));
      sound.playHit();
      setTargetHitCount(c => c + 1);

      setTimeout(() => {
        setTestTarget({
          x: 0.15 + Math.random() * 0.7,
          y: 0.15 + Math.random() * 0.5,
          hit: false
        });
      }, 1200);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-6 bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl relative z-10">
      {/* LEFT COLUMN: Educational Guide Cards */}
      <div className="flex-1 flex flex-col justify-between min-h-[440px]">
        <div>
          {/* Header Title */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <div className="h-9 w-9 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white text-base font-mono uppercase tracking-wider font-semibold">
                Gesture Academy
              </h2>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
                Real-time Hand Pose Training
              </span>
            </div>
          </div>

          {/* Dynamic Step Content switcher */}
          {currentStep === 1 && (
            <div className="py-6 flex flex-col gap-4 animate-fade-in">
              <h4 className="text-white font-semibold text-sm">Welcome to CV Targeting!</h4>
              <p className="text-xs text-slate-350 leading-relaxed">
                Using advanced neuromorphic computer vision inside your browser, you can command the game deck simply by holding your hand in view of your camera. No glove or tracker hardware required!
              </p>
              <div className="mt-2 p-3 bg-white/5 rounded-xl border border-white/10 text-[11px] text-slate-300 leading-relaxed flex items-start gap-2.5 backdrop-blur-md shadow-md">
                <Crosshair className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Aiming Technique:</strong> Point your index finger forward. The floating reticle on the main game canvas will track your fingertip node (landmark 8) and smooth out shaky hands automatically!
                </span>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="py-6 flex flex-col gap-4 animate-fade-in">
              <h4 className="text-white font-semibold text-sm">Unleashing the Laser Blast</h4>
              <p className="text-xs text-slate-350 leading-relaxed">
                To fire your weapon on screen, bring your **Thumb and Index Finger together in a rapid pinch** and then let go!
              </p>
              <div className="bg-white/5 p-4 border border-white/10 rounded-2xl flex flex-col gap-2 backdrop-blur-md shadow-md">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-405 uppercase">
                  <span>Pinch Distance Trigger:</span>
                  <span className="text-emerald-400 font-bold">{pinchDistanceMetric}</span>
                </div>
                {/* Visual Progress bar showing landmark gap closeness */}
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/5 shadow-inner">
                  <div
                    className={`h-full transition duration-150 ${pinchedStateLocal ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.max(0, Math.min(100, (1 - pinchDistanceMetric * 12) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>Open hand</span>
                  <span>PINCHED (Laser ACTIVE)</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="py-6 flex flex-col gap-4 animate-fade-in">
              <h4 className="border-b border-white/10 pb-2 text-white font-mono text-xs uppercase tracking-wider text-emerald-400">
                Sandbox Arena Targets Pop
              </h4>
              <p className="text-xs text-slate-350 leading-relaxed">
                Use your webcam on the right panel to aim at the floating orb inside our testing sandbox. Practice your timing!
              </p>

              <div className="flex py-2 px-3 bg-white/5 rounded-xl border border-white/10 items-center justify-between text-xs backdrop-blur-md shadow-sm">
                <span className="text-slate-400 font-mono">Completed SandBox Hits:</span>
                <span className="text-amber-400 font-mono font-bold text-sm bg-white/5 px-3 py-0.5 rounded-lg border border-white/10">
                  {targetHitCount} / 5
                </span>
              </div>

              {targetHitCount >= 5 && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300 backdrop-blur-md">
                  <ThumbsUp className="h-4 w-4 animate-bounce" />
                  <span>Excellent precision! You are ready to blast target swarms in live operations.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step Actions Footer */}
        <div className="flex justify-between border-t border-white/10 pt-4 mt-6">
          <button
            onClick={currentStep > 1 ? () => { sound.playBlip(); setCurrentStep(s => s - 1); } : onBackToMenu}
            className="flex items-center gap-1 text-slate-350 hover:text-white font-mono text-xs uppercase tracking-wider font-semibold px-3 py-2 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl transition backdrop-blur-md active:scale-[0.98] shadow-md"
          >
            {currentStep === 1 ? 'Exit Academy' : 'Prev Step'}
          </button>

          {currentStep < 3 ? (
            <button
              onClick={() => {
                sound.playBlip();
                setCurrentStep(s => s + 1);
              }}
              className="flex items-center gap-1 px-4 py-2 bg-slate-100 hover:bg-white text-slate-950 font-mono text-xs font-bold uppercase tracking-wider rounded-xl transition active:scale-[0.98] shadow-md"
            >
              Next Lesson
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                sound.playBlip();
                onGoToGame();
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition animate-bounce border border-emerald-500/30"
            >
              Enter Match
              <Crosshair className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Camera Calibration and Testing Arena */}
      <div className="flex-1 max-w-sm mx-auto flex flex-col gap-4">
        {currentStep < 3 ? (
          /* Live Webcam bone tracking display node */
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest pl-1">
              Live Calibration Monitor
            </span>
            <WebcamTracker
              ref={trackerRef}
              onTrackingUpdate={handleTrackingUpdate}
              calibration={calibration}
              isPaused={false}
            />
          </div>
        ) : (
          /* Training Sandbox Game Frame */
          <div className="flex flex-col gap-2 w-full">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest pl-1">
              Target testing sandbox (Mouse supported)
            </span>
            <div
              onClick={handleManualSandboxClick}
              className="relative w-full aspect-[4/3] bg-slate-950/80 border border-white/10 rounded-2xl overflow-hidden cursor-none shadow-inner"
            >
              {/* Test target visual button */}
              {!testTarget.hit ? (
                <div
                  className="absolute w-12 h-12 bg-emerald-500 border border-emerald-300 rounded-full select-none flex items-center justify-center animate-pulse transition-all duration-300"
                  style={{
                    left: `${testTarget.x * 100}%`,
                    top: `${testTarget.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 15px rgba(16,185,129,0.8)'
                  }}
                >
                  <div className="w-4 h-4 rounded-full bg-white" />
                </div>
              ) : (
                <div
                  className="absolute w-16 h-16 bg-red-400/20 border-2 border-red-500 rounded-full select-none flex items-center justify-center animate-ping"
                  style={{
                    left: `${testTarget.x * 100}%`,
                    top: `${testTarget.y * 100}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <span className="text-[9px] font-mono text-red-400 uppercase tracking-wider font-extrabold pb-0.5">POPed</span>
                </div>
              )}

              {/* Aiming Reticle Overlay following user tracking */}
              <div
                className={`absolute w-10 h-10 border rounded-full select-none pointer-events-none transition duration-75 flex items-center justify-center ${
                  pinchedStateLocal ? 'border-red-500 scale-90 bg-red-500/10' : 'border-emerald-400 scale-100 bg-emerald-500/5'
                }`}
                style={{
                  left: `${localCrosshair.x * 100}%`,
                  top: `${localCrosshair.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: pinchedStateLocal ? '0 0 10px rgba(239,68,110,0.5)' : '0 0 10px rgba(52,211,153,0.3)'
                }}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${pinchedStateLocal ? 'bg-red-500' : 'bg-emerald-400'}`} />
              </div>

              {/* Status footer overlays */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                <div className="flex gap-1.5 items-center">
                  <span className={`w-2 h-2 rounded-full ${cameraIsTracking ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                    {cameraIsTracking ? 'Hands calibration active' : 'Waiting for hand...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Micro Camera Miniature Feed in Sandbox index */}
            <div className="absolute top-2 right-2 flex scale-[0.32] translate-y-[-110px] translate-x-[110px] pointer-events-none">
              <WebcamTracker
                ref={trackerRef}
                onTrackingUpdate={handleTrackingUpdate}
                calibration={calibration}
                isPaused={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
