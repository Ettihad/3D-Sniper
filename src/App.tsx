/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, startTransition } from 'react';
import {
  Crosshair,
  Trophy,
  Sliders,
  HelpCircle,
  Camera,
  MousePointer,
  Activity as ActivityIcon,
  Settings,
  Flame,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Play,
  Share2
} from 'lucide-react';
import { GameState, GameDifficulty, GestureCalibration, GameMode } from './types';
import { GameCanvas } from './components/GameCanvas';
import { Leaderboard } from './components/Leaderboard';
import { Tutorial } from './components/Tutorial';
import { WebcamTracker, WebcamTrackerHandle } from './components/WebcamTracker';
import { sound } from './lib/audio';

export default function App() {
  // Navigation tabs and layout states
  const [activeTab, setActiveTab] = useState<'play' | 'academy' | 'leaderboard' | 'config'>('play');
  const [gameState, setGameState] = useState<GameState>('menu');
  const [controlMode, setControlMode] = useState<'camera' | 'mouse'>('camera');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('medium');
  const [gameMode, setGameMode] = useState<GameMode>('survival');

  // Unified hand pose state variables feed
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [isCVTracking, setIsCVTracking] = useState<boolean>(false);
  const [isCVFiring, setIsCVFiring] = useState<boolean>(false);

  // Calibration settings
  const [calibration, setCalibration] = useState<GestureCalibration>({
    pinchThreshold: 0.055, // Sensitivity bounding box (optimized for seamless triggering)
    aimSmoothing: 0.25, // Exponential weight for highly responsive & stable tracking
    mirrorCamera: true, // Auto mirror orientation alignment
    gestureChoice: 'pinch',
    aimSensitivity: 1.8 // Smooth natural reach mapping directly beneath finger
  });

  const mainTrackerRef = useRef<WebcamTrackerHandle | null>(null);

  // Global sound setting to keep header synced
  const [isMutedGlobal, setIsMutedGlobal] = useState<boolean>(sound.getMuteState());

  useEffect(() => {
    // Force set name to Guest if empty
    if (!localStorage.getItem('fingerShootName')) {
      localStorage.setItem('fingerShootName', 'Rookie Ranger');
    }
  }, []);

  // Sync sounds
  const handleToggleMuteGlobal = () => {
    const isMuted = sound.toggleMute();
    setIsMutedGlobal(isMuted);
  };

  // High rate coordinate pipeline mapped directly from spatial camera results
  const handleTrackingUpdate = (
    x: number,
    y: number,
    isTracking: boolean,
    isFiring: boolean
  ) => {
    setCrosshairPos({ x, y });
    setIsCVTracking(isTracking);
    setIsCVFiring(isFiring);
  };

  const onManualFire = () => {
    // Visual shoot recoil feedback can go here if needed
  };

  const onManualMove = (x: number, y: number) => {
    setCrosshairPos({ x, y });
    setIsCVTracking(true);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300 relative overflow-x-hidden pb-12">
      
      {/* Premium Ambient Background Spheres & Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.06)_0%,_rgba(2,6,23,0)_70%)] pointer-events-none z-0" />
      <div className="absolute top-20 left-[10%] w-[350px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none z-0 animate-pulse" />
      <div className="absolute bottom-10 right-[15%] w-[400px] h-[400px] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
        style={{
          backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* 1. Header Navigation HUD */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 relative z-10">
          
          {/* Logo with pulsing neon targets */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-9 w-9 bg-emerald-500/15 border border-emerald-500/50 rounded-xl flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Crosshair className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
            </div>
            
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight leading-none">
                3D Sniper
              </h1>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5 block">
                Fingertip Target Practice
              </span>
            </div>
          </div>

          {/* Core HUD Deck tabs switcher */}
          <nav className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
            <button
              onClick={() => {
                sound.playBlip();
                startTransition(() => {
                  setActiveTab('play');
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-xl transition-all duration-300 ${
                activeTab === 'play'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                  : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <ActivityIcon className="h-3.5 w-3.5" />
              Play Game
            </button>

            <button
              onClick={() => {
                sound.playBlip();
                startTransition(() => {
                  setActiveTab('academy');
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-xl transition-all duration-300 ${
                activeTab === 'academy'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                  : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              How to Play
            </button>

            <button
              onClick={() => {
                sound.playBlip();
                startTransition(() => {
                  setActiveTab('leaderboard');
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-xl transition-all duration-300 ${
                activeTab === 'leaderboard'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                  : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              Leaderboard
            </button>

            <button
              onClick={() => {
                sound.playBlip();
                startTransition(() => {
                  setActiveTab('config');
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-xl transition-all duration-300 ${
                activeTab === 'config'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                  : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </nav>

          {/* Sound, calibration and profiles HUD panel */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMuteGlobal}
              className="p-2 border border-white/10 rounded-xl bg-white/5 text-slate-400 hover:text-white transitionbackdrop-blur-md hover:bg-white/10"
              title="Toggle game audio"
            >
              {isMutedGlobal ? <VolumeX className="h-4 w-4 text-red-400 animate-pulse" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
            </button>

            <a
              href="https://ai.studio/build"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/95 hover:bg-emerald-500/95 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] text-white font-mono text-xs uppercase font-bold rounded-xl active:scale-[0.98] transition-all duration-300 border border-emerald-400/30"
            >
              <Share2 className="h-3.5 w-3.5" />
              Export Code
            </a>
          </div>

        </div>
      </header>


      {/* Main layout */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* View switching */}
        {activeTab === 'play' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Play area */}
            <div className="lg:col-span-3">
              <GameCanvas
                gameState={gameState}
                setGameState={setGameState}
                difficulty={difficulty}
                gameMode={gameMode}
                crosshairPos={crosshairPos}
                isTracking={isCVTracking}
                isFiring={isCVFiring}
                controlMode={controlMode}
                setControlMode={setControlMode}
                onManualFire={onManualFire}
                onManualMove={onManualMove}
              />
            </div>

            {/* Sidebar controls */}
            <div className="flex flex-col gap-6 relative z-10">
              
              {/* Webcam view */}
              {controlMode === 'camera' && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest font-semibold flex items-center gap-1">
                      <Camera className="h-3 w-3 text-emerald-400" />
                      Hand Tracking Feed
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 uppercase">
                      Active
                    </span>
                  </div>
                  
                  <WebcamTracker
                    ref={mainTrackerRef}
                    onTrackingUpdate={handleTrackingUpdate}
                    calibration={calibration}
                    isPaused={false}
                  />

                  {gameState === 'playing' && (
                    <div className="p-3 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl mt-1.5 text-[11px] text-slate-300 leading-relaxed shadow-lg">
                      <p>
                        <strong>Quick Tip:</strong> Align your hand inside the webcam box. Aim with your index finger, pinch with your thumb to shoot!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {controlMode === 'mouse' && (
                <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center text-center py-8 shadow-xl">
                  <MousePointer className="h-10 w-10 text-emerald-400 mb-3 animate-pulse" />
                  <span className="text-xs font-mono font-bold uppercase text-slate-200">
                    Mouse Control Fallback
                  </span>
                  <p className="text-[10px] text-slate-350 mt-2 max-w-[200px] leading-relaxed">
                    Camera tracking is off. Simply move your mouse or tap targets directly on screen to shoot.
                  </p>
                </div>
              )}

              {/* Game Mode Selector */}
              <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl flex flex-col gap-4 shadow-xl">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Game Match Mode
                </span>

                <div className="flex flex-col gap-2.5">
                  {(['instant', 'timed_60', 'survival'] as GameMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        sound.playBlip();
                        setGameMode(mode);
                      }}
                      className={`text-left p-3.5 rounded-2xl border flex flex-col transition-all duration-300 relative overflow-hidden group ${
                        gameMode === mode
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="text-xs font-mono font-bold uppercase tracking-wide flex items-center gap-1.5">
                        {mode === 'instant' ? '⚡ Hearts Mode' : mode === 'timed_60' ? '⏱️ Time Trial' : '🔥 Extension Survival'}
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-300 mt-1 leading-relaxed">
                        {mode === 'instant' 
                          ? 'Infinite classic mode. Traditional multi-life survival.' 
                          : mode === 'timed_60' 
                            ? '60-second limit score rush. Aim for the highest possible points!' 
                            : 'Dynamic time constraints. Hitting targets adds time, missing subtracts.'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Instant Battle Config (Difficulty) */}
              <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl flex flex-col gap-4 shadow-xl">
                <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest font-semibold flex items-center gap-1">
                  <Sliders className="h-3 w-3 text-emerald-400" />
                  Game Difficulty
                </span>

                <div className="grid grid-cols-2 gap-2">
                  {(['easy', 'medium', 'hard', 'expert'] as GameDifficulty[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        sound.playBlip();
                        setDifficulty(level);
                      }}
                      className={`py-2 px-3 rounded-xl border font-mono text-xs uppercase font-medium transition-all duration-300 ${
                        difficulty === level
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/15'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {activeTab === 'academy' && (
          <div className="animate-fade-in">
            <Tutorial
              onBackToMenu={() => {
                startTransition(() => {
                  setActiveTab('play');
                });
                setGameState('menu');
              }}
              onGoToGame={() => {
                startTransition(() => {
                  setActiveTab('play');
                });
                setGameState('playing');
              }}
            />
          </div>
        )}         {activeTab === 'leaderboard' && (
          <div className="max-w-3xl mx-auto animate-fade-in relative z-10">
            <Leaderboard />
          </div>
        )}

        {activeTab === 'config' && (
          <div className="max-w-2xl mx-auto bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col gap-6 animate-fade-in relative z-10">
            
            {/* Section Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="h-9 w-9 bg-emerald-500/15 border border-emerald-500/50 rounded-xl flex items-center justify-center">
                <Settings className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white text-base font-mono uppercase tracking-wider font-semibold">
                  Game Settings
                </h3>
                <span className="text-[10px] text-slate-405 font-mono uppercase tracking-widest">
                  Fine-tune Computer Vision Filters
                </span>
              </div>
            </div>

            {/* Config Input Form blocks */}
            <div className="flex flex-col gap-5">
              
              {/* Smoothing modifier */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-200">Aim coordinate smoothing filter (EMA)</span>
                  <span className="text-emerald-400 font-bold">{calibration.aimSmoothing}</span>
                </div>
                <input
                  type="range"
                  min="0.08"
                  max="0.80"
                  step="0.02"
                  value={calibration.aimSmoothing}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCalibration(prev => ({ ...prev, aimSmoothing: val }));
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/5"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Butter Smooth (0.08)</span>
                  <span>Super Rapid / Snappy (0.80)</span>
                </div>
              </div>

              {/* Pinch threshold modifier */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-200">Pinch distance sensitivity</span>
                  <span className="text-emerald-400 font-bold">{calibration.pinchThreshold}</span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="0.07"
                  step="0.005"
                  value={calibration.pinchThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCalibration(prev => ({ ...prev, pinchThreshold: val }));
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/5"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Tight Pinch (0.02 - Forgiving)</span>
                  <span>Loose Pinch (0.07 - High speed trigger)</span>
                </div>
              </div>

              {/* Aim Sensitivity modifier */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-200">Webcam movement sensitivity (Aim Reach)</span>
                  <span className="text-emerald-400 font-bold">{calibration.aimSensitivity ?? 1.8}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.1"
                  value={calibration.aimSensitivity ?? 1.8}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCalibration(prev => ({ ...prev, aimSensitivity: val }));
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/5"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Full Range (1.0x - Requires Wide Arms)</span>
                  <span>Responsive (3.0x - Tiny Finger Twitches)</span>
                </div>
              </div>

              {/* Cameras mirroring options toggles */}
              <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10 text-xs shadow-lg">
                <div className="flex flex-col">
                  <span className="text-slate-200 font-semibold">Webcam mirror-image alignment</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Flipped lens mapping so physical hand direction matches reticle vectors perfectly.</span>
                </div>
                <button
                  onClick={() => {
                    sound.playBlip();
                    setCalibration(prev => ({ ...prev, mirrorCamera: !prev.mirrorCamera }));
                  }}
                  className={`px-4 py-1.5 border font-mono uppercase tracking-wider font-semibold rounded-xl text-[10px] transition-all duration-300 ${
                    calibration.mirrorCamera
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/15'
                  }`}
                >
                  {calibration.mirrorCamera ? 'On (Mirrored)' : 'Off (Raw)'}
                </button>
              </div>

            </div>

          </div>
        )}

      </main>

    </div>
  );
}
export { App };
