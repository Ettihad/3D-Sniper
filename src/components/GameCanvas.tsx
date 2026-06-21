/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { Target as TargetIcon, Shield, Sliders, Trophy, Flame, Eye, RefreshCw, Volume2, VolumeX, MousePointer, Camera } from 'lucide-react';
import { GameState, GameDifficulty, GameMode, Target, ScoreRecord, Particle } from '../types';
import { sound } from '../lib/audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  difficulty: GameDifficulty;
  gameMode: GameMode;
  crosshairPos: { x: number; y: number };
  isTracking: boolean;
  isFiring: boolean;
  controlMode: 'camera' | 'mouse';
  setControlMode: (mode: 'camera' | 'mouse') => void;
  onManualFire: () => void;
  onManualMove: (x: number, y: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  difficulty,
  gameMode,
  crosshairPos,
  isTracking,
  isFiring,
  controlMode,
  setControlMode,
  onManualFire,
  onManualMove,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const [, startTransition] = useTransition();

  // Core Game Loop State (held in refs for high frame rate rendering without re-renders)
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(5);
  const comboRef = useRef<number>(0);
  const maxComboRef = useRef<number>(0);
  const shotsFiredRef = useRef<number>(0);
  const targetsHitRef = useRef<number>(0);
  
  const targetsRef = useRef<Target[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);
  const gameStartTimeRef = useRef<number>(0);
  const gameEndTimeRef = useRef<number>(0);

  // Sound and speed settings in state
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [currentLives, setCurrentLives] = useState<number>(5);
  const [currentCombo, setCurrentCombo] = useState<number>(0);
  const [currentTimeLeft, setCurrentTimeLeft] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(sound.getMuteState());

  // Bullet tracking for recoil and visuals
  const flashAlphaRef = useRef<number>(0); // Screen white flash value on shoot
  const laserHitsRef = useRef<{ x: number; y: number; time: number }[]>([]);

  // Track firing logic
  const lastProcessedFiringRef = useRef<boolean>(false);

  // Notified caches to prevent redundant setStates in requestAnimationFrame loops
  const lastNotifiedScoreRef = useRef<number>(0);
  const lastNotifiedLivesRef = useRef<number>(5);
  const lastNotifiedComboRef = useRef<number>(0);
  const lastNotifiedTimeLeftRef = useRef<number>(0);
  const lastNotifiedSpeedMultiplierRef = useRef<number>(1.0);

  // Ref-based sync to completely bypass stale React render loop closures in requestAnimationFrame
  const crosshairPosRef = useRef(crosshairPos);
  const isTrackingRef = useRef(isTracking);
  const isFiringRef = useRef(isFiring);

  useEffect(() => {
    crosshairPosRef.current = crosshairPos;
  }, [crosshairPos]);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  // High-performance ResizeObserver to handle canvas dimensions cleanly without layout reflow thrashing
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let resizeRafId: number;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      const wRounded = Math.round(width);
      const hRounded = Math.round(height);
      
      cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        if (canvas.width !== wRounded || canvas.height !== hRounded) {
          canvas.width = wRounded;
          canvas.height = hRounded;
        }
      });
    });

    resizeObserver.observe(container);

    // Bootstrap initial dimensions
    const rect = container.getBoundingClientRect();
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeRafId);
    };
  }, []);

  useEffect(() => {
    isFiringRef.current = isFiring;
  }, [isFiring]);

  // Run the core engine loops when "playing"
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      return;
    }

    // Initialize game specs
    scoreRef.current = 0;
    livesRef.current = 5;
    comboRef.current = 0;
    maxComboRef.current = 0;
    shotsFiredRef.current = 0;
    targetsHitRef.current = 0;
    targetsRef.current = [];
    particlesRef.current = [];
    gameStartTimeRef.current = Date.now();
    lastSpawnTimeRef.current = Date.now();
    
    if (gameMode === 'timed_60') {
      gameEndTimeRef.current = Date.now() + 60000;
      setCurrentTimeLeft(60);
      lastNotifiedTimeLeftRef.current = 60;
    } else if (gameMode === 'survival') {
      gameEndTimeRef.current = Date.now() + 30000;
      setCurrentTimeLeft(30);
      lastNotifiedTimeLeftRef.current = 30;
    } else {
      gameEndTimeRef.current = 0;
      setCurrentTimeLeft(0);
      lastNotifiedTimeLeftRef.current = 0;
    }

    lastNotifiedScoreRef.current = 0;
    lastNotifiedLivesRef.current = 5;
    lastNotifiedComboRef.current = 0;
    lastNotifiedSpeedMultiplierRef.current = 1.0;

    setSpeedMultiplier(1.0);
    setCurrentScore(0);
    setCurrentLives(5);
    setCurrentCombo(0);

    // Initial splash targets
    spawnTarget();
    spawnTarget();

    const loop = () => {
      updateGameEngine();
      drawGameEngine();
      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gameState, difficulty, gameMode]);

  // Handle external firing inputs triggered by tracking hands
  useEffect(() => {
    if (gameState !== 'playing') return;

    if (isFiring && !lastProcessedFiringRef.current) {
      triggerShoot();
    }
    lastProcessedFiringRef.current = isFiring;
  }, [isFiring, gameState]);

  // Adjust speeds and spawns adaptively over elapsed time
  const getDifficultySettings = () => {
    const base = {
      spawnInterval: 1800,
      targetBaseSpeed: 0.003,
      bombChance: 0.08,
      shieldChance: 0.04,
      speedyChance: 0.10,
    };

    switch (difficulty) {
      case 'easy':
        return { ...base, spawnInterval: 2200, targetBaseSpeed: 0.0022, bombChance: 0.02, shieldChance: 0.08, speedyChance: 0.05 };
      case 'medium':
        return { ...base, spawnInterval: 1600, targetBaseSpeed: 0.0038, bombChance: 0.12, shieldChance: 0.05, speedyChance: 0.15 };
      case 'hard':
        return { ...base, spawnInterval: 1100, targetBaseSpeed: 0.0055, bombChance: 0.22, shieldChance: 0.03, speedyChance: 0.22 };
      case 'expert':
        return { ...base, spawnInterval: 800, targetBaseSpeed: 0.0072, bombChance: 0.32, shieldChance: 0.02, speedyChance: 0.30 };
    }
  };

  const spawnTarget = () => {
    const elapsedSeconds = (Date.now() - gameStartTimeRef.current) / 1000;
    const settings = getDifficultySettings();
    const speedFactor = settings.targetBaseSpeed * (1.0 + elapsedSeconds * 0.03); // Adaptive speed scaling

    const rand = Math.random();
    let type: Target['type'] = 'regular';
    let color = '#3b82f6'; // Neon Blue
    let points = 10;
    let radius = 25;

    if (rand < settings.bombChance) {
      type = 'bomb';
      color = '#ef4444'; // Neon Red
      points = -15;
      radius = 22;
    } else if (rand < settings.bombChance + settings.shieldChance) {
      type = 'shield';
      color = '#10b981'; // Neon Green (Recovery)
      points = 5;
      radius = 20;
    } else if (rand < settings.bombChance + settings.shieldChance + settings.speedyChance) {
      type = 'speedy';
      color = '#f59e0b'; // Gold Bullet
      points = 30;
      radius = 16;
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = speedFactor * (type === 'speedy' ? 1.7 : type === 'bomb' ? 1.2 : 1.0);

    const newTarget: Target = {
      id: Math.random().toString(),
      x: 0.1 + Math.random() * 0.8, // Percentage bounds
      y: 0.1 + Math.random() * 0.5, // Spawn in top half mostly
      radius: radius,
      type: type,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      points: points,
      color: color,
      health: 1,
      maxHealth: 1,
      createdAt: Date.now(),
      pulseSpeed: 1.5 + Math.random() * 2,
      pulsePhase: Math.random() * Math.PI,
      shrinkRate: difficulty === 'hard' || difficulty === 'expert' ? 0.0001 : 0, 
    };

    targetsRef.current.push(newTarget);
    lastSpawnTimeRef.current = Date.now();
  };

  // Perform physics updates, collisions, triggers, and boundary checks
  const updateGameEngine = () => {
    const elapsedSeconds = (Date.now() - gameStartTimeRef.current) / 1000;
    const settings = getDifficultySettings();
    const intervalFactor = Math.max(500, settings.spawnInterval - elapsedSeconds * 20); // Dynamic compression over time

    // Calculate Adaptive multiplier for HUD
    const speedMultVal = parseFloat((1.0 + elapsedSeconds * 0.035).toFixed(2));
    if (Math.floor(elapsedSeconds) % 5 === 0 && lastNotifiedSpeedMultiplierRef.current !== speedMultVal) {
      lastNotifiedSpeedMultiplierRef.current = speedMultVal;
      setSpeedMultiplier(speedMultVal);
    }

    // 1. Spawning cycle
    if (Date.now() - lastSpawnTimeRef.current > intervalFactor) {
      spawnTarget();
    }

    // 2. Clear out elapsed laser markers
    const nowLocal = Date.now();
    laserHitsRef.current = laserHitsRef.current.filter(hit => nowLocal - hit.time < 350);

    // 3. Update Targets mechanics
    const activeTargets = targetsRef.current;
    const remainingTargets: Target[] = [];

    activeTargets.forEach(target => {
      // Apply translation vec
      target.x += target.vx;
      target.y += target.vy;

      // Pulse waves
      target.pulsePhase += target.pulseSpeed * 0.05;

      // Handle bounding box reflections (x coordinate bounds: 0.05..0.95)
      if (target.x < 0.05 || target.x > 0.95) {
        target.vx *= -1;
        target.x = Math.max(0.05, Math.min(0.95, target.x));
      }
      // Handle y bounces
      if (target.y < 0.05 || target.y > 0.80) {
        target.vy *= -1;
        target.y = Math.max(0.05, Math.min(0.80, target.y));
      }

      // Check if target has shrunk to zero or elapsed
      let keep = true;
      if (target.shrinkRate > 0) {
        target.radius -= target.shrinkRate * 100;
        if (target.radius <= 5) {
          keep = false;
        }
      }

      // Check target expiry (e.g. self exploding after 6 seconds of sitting, except bombs)
      if (Date.now() - target.createdAt > 7000 && target.type !== 'bomb') {
        keep = false;
        if (target.type !== 'shield') {
          // Missed standard targets cost lives!
          deductLife();
          if (gameMode === 'survival') {
            gameEndTimeRef.current = Math.max(Date.now(), gameEndTimeRef.current - 2000);
          }
        }
      }

      if (keep) {
        remainingTargets.push(target);
      }
    });

    targetsRef.current = remainingTargets;

    // 4. Particle calculations
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
    });

    // Remove expired sparkles
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

    // 5. Update UI values at reasonable intervals
    if (scoreRef.current !== lastNotifiedScoreRef.current) {
      lastNotifiedScoreRef.current = scoreRef.current;
      setCurrentScore(scoreRef.current);
    }

    // 6. Handle timer updates in timed modes
    if (gameMode === 'timed_60' || gameMode === 'survival') {
      const remainingMs = gameEndTimeRef.current - Date.now();
      const remainingSec = Math.max(0, remainingMs / 1000);
      const currentVal = parseFloat(remainingSec.toFixed(1));
      
      if (currentVal !== lastNotifiedTimeLeftRef.current) {
        lastNotifiedTimeLeftRef.current = currentVal;
        setCurrentTimeLeft(currentVal);
      }

      if (remainingMs <= 0) {
        triggerGameOver();
      }
    }
  };

  // Screen-level shoot blast activator
  const triggerShoot = () => {
    shotsFiredRef.current++;
    flashAlphaRef.current = 0.45; // Initiates flash
    sound.playLaser();

    // Map screen targets
    const canvas = canvasRef.current;
    if (!canvas) return;

    const hitLogX = crosshairPosRef.current.x * canvas.width;
    const hitLogY = crosshairPosRef.current.y * canvas.height;

    laserHitsRef.current.push({ x: hitLogX, y: hitLogY, time: Date.now() });

    const activeTargets = targetsRef.current;
    let hitAny = false;

    // Check matches from top-to-bottom layers
    const nextTargets: Target[] = [];
    
    activeTargets.forEach(target => {
      const tgtAbsX = target.x * canvas.width;
      const tgtAbsY = target.y * canvas.height;
      
      const distance = Math.hypot(tgtAbsX - hitLogX, tgtAbsY - hitLogY);

      // Collide test
      if (distance <= target.radius + 15) { // Add padding to make laser shots more forgiving
        hitAny = true;
        targetsHitRef.current++;
        
        // Execute collision effects
        if (target.type === 'bomb') {
          sound.playBomb();
          streakBroke();
          scoreRef.current = Math.max(0, scoreRef.current + target.points);
          deductLife();
          if (gameMode === 'survival') {
            gameEndTimeRef.current = Math.max(Date.now(), gameEndTimeRef.current - 5000);
          }
          createExplosion(tgtAbsX, tgtAbsY, target.color, 16);
        } else if (target.type === 'shield') {
          sound.playShield();
          // Gain lives back up to maximum 6!
          livesRef.current = Math.min(6, livesRef.current + 1);
          if (lastNotifiedLivesRef.current !== livesRef.current) {
            lastNotifiedLivesRef.current = livesRef.current;
            setCurrentLives(livesRef.current);
          }
          scoreRef.current += target.points;
          if (gameMode === 'survival') {
            gameEndTimeRef.current += 4000;
          }
          createExplosion(tgtAbsX, tgtAbsY, target.color, 12);
        } else {
          sound.playHit();
          // Grow Combo streak!
          comboRef.current++;
          if (lastNotifiedComboRef.current !== comboRef.current) {
            lastNotifiedComboRef.current = comboRef.current;
            setCurrentCombo(comboRef.current);
          }
          if (comboRef.current > maxComboRef.current) {
            maxComboRef.current = comboRef.current;
          }

          // Trigger dynamic combo sounds
          if (comboRef.current % 3 === 0) {
            sound.playCombo(comboRef.current);
          }

          const multiplier = Math.floor(comboRef.current / 4) + 1;
          scoreRef.current += target.points * multiplier;
          if (gameMode === 'survival') {
            if (target.type === 'speedy') {
              gameEndTimeRef.current += 3000;
            } else {
              gameEndTimeRef.current += 1500;
            }
          }
          createExplosion(tgtAbsX, tgtAbsY, target.color, 10);
        }
      } else {
        nextTargets.push(target);
      }
    });

    if (!hitAny) {
      // Fired and missed clean targets resets combos but doesn't instantly cost lives
      streakBroke();
      if (gameMode === 'survival') {
        gameEndTimeRef.current = Math.max(Date.now(), gameEndTimeRef.current - 800);
      }
    } else {
      targetsRef.current = nextTargets;
    }
  };

  const streakBroke = () => {
    comboRef.current = 0;
    if (lastNotifiedComboRef.current !== 0) {
      lastNotifiedComboRef.current = 0;
      setCurrentCombo(0);
    }
  };

  const deductLife = () => {
    if (gameMode !== 'instant') return;
    livesRef.current--;
    if (lastNotifiedLivesRef.current !== livesRef.current) {
      lastNotifiedLivesRef.current = livesRef.current;
      setCurrentLives(livesRef.current);
    }
    if (livesRef.current <= 0) {
      triggerGameOver();
    }
  };

  const triggerGameOver = () => {
    sound.playGameOver();
    setGameState('gameover');
    saveStats();
  };

  const saveStats = () => {
    try {
      const totalShots = shotsFiredRef.current || 1;
      const accuracy = Math.round((targetsHitRef.current / totalShots) * 100);
      
      const newRecord: ScoreRecord = {
        id: Math.random().toString(),
        playerName: localStorage.getItem('fingerShootName') || 'Guest Ranger',
        score: scoreRef.current,
        accuracy: accuracy,
        difficulty: difficulty,
        mode: gameMode,
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        shotsFired: totalShots,
        targetsHit: targetsRef.current.length,
        maxCombo: maxComboRef.current,
      };

      const historyJSON = localStorage.getItem('fingerShootScores');
      const records: ScoreRecord[] = historyJSON ? JSON.parse(historyJSON) : [];
      records.push(newRecord);
      
      // Sort and keep top 25 high scores
      records.sort((a,b) => b.score - a.score);
      localStorage.setItem('fingerShootScores', JSON.stringify(records.slice(0, 25)));
    } catch (e) {
      console.error('Error saving scoreboard records:', e);
    }
  };

  // Generate sparkly radial star bursts
  const createExplosion = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const p: Particle = {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1 + Math.random() * 3,
        color: color,
        alpha: 1.0,
        decay: 0.015 + Math.random() * 0.02,
        growth: -0.05
      };
      particlesRef.current.push(p);
    }
  };

  // Complete HTML Canvas rendering layers
  const drawGameEngine = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // A. Transparent clear with radial backdrop glow representation 
    ctx.fillStyle = '#030712'; // Deepest Slate Black
    ctx.fillRect(0, 0, w, h);

    // Draw grid mesh lines for spatial matrix feel with zero layout calculations/multiple batches
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 40;
    for (let x = 0; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // B. Render active target rings
    targetsRef.current.forEach(tgt => {
      const absX = tgt.x * w;
      const absY = tgt.y * h;
      const scalePulse = 1.0 + Math.sin(tgt.pulsePhase) * 0.06;
      const drawRad = tgt.radius * scalePulse;

      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = tgt.color;

      if (tgt.type === 'bomb') {
        // Draw standard triangular alarm shape
        ctx.beginPath();
        ctx.fillStyle = tgt.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        
        ctx.moveTo(absX, absY - drawRad);
        ctx.lineTo(absX + drawRad, absY + drawRad);
        ctx.lineTo(absX - drawRad, absY + drawRad);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Warning skull placeholder mark
        ctx.fillStyle = '#030712';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('X', absX, absY + (drawRad / 2));
      } else if (tgt.type === 'shield') {
        // Draw green octagon shield
        ctx.beginPath();
        const sides = 8;
        for (let i = 0; i < sides; i++) {
          const sideAngle = (i * Math.PI * 2) / sides;
          const sx = absX + Math.cos(sideAngle) * drawRad;
          const sy = absY + Math.sin(sideAngle) * drawRad;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.strokeStyle = tgt.color;
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();
        
        // Plus life symbol in middle
        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.moveTo(absX - 4, absY);
        ctx.lineTo(absX + 4, absY);
        ctx.moveTo(absX, absY - 4);
        ctx.lineTo(absX, absY + 4);
        ctx.stroke();
      } else if (tgt.type === 'speedy') {
        // Draw golden orbits
        ctx.beginPath();
        ctx.arc(absX, absY, drawRad, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
        ctx.strokeStyle = tgt.color;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Small lightning center
        ctx.beginPath();
        ctx.arc(absX, absY, drawRad * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      } else {
        // Regular balloon targets
        ctx.beginPath();
        ctx.arc(absX, absY, drawRad, 0, 2 * Math.PI);
        
        // Add subtle radial gradient
        const grad = ctx.createRadialGradient(absX - drawRad/3, absY - drawRad/3, 1, absX, absY, drawRad);
        grad.addColorStop(0, '#60a5fa');
        grad.addColorStop(1, '#1e40af');

        ctx.fillStyle = grad;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        // Draw timer countdown bar overlay (showing time left before target vanishes)
        const age = Date.now() - tgt.createdAt;
        const ratioLeft = Math.max(0, 1 - age / 7000);
        ctx.beginPath();
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2.5;
        ctx.arc(absX, absY, drawRad + 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * ratioLeft));
        ctx.stroke();
      }

      ctx.restore();
    });

    // C. Render explosion particles
    particlesRef.current.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // Reset

    // D. Render shooting laser trails with auto-cleanup of expired hits
    const renderNow = Date.now();
    laserHitsRef.current = laserHitsRef.current.filter(laser => renderNow - laser.time < 350);

    laserHitsRef.current.forEach(laser => {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 4;
      ctx.moveTo(laser.x, laser.y);
      ctx.lineTo(laser.x, laser.y);
      ctx.stroke();

      // Outer rings expanding outward from the hit center
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
      ctx.lineWidth = 1.5;
      const ageMs = renderNow - laser.time;
      ctx.arc(laser.x, laser.y, ageMs * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    });

    // E. Draw active aiming Crosshair
    const targetAbsX = crosshairPosRef.current.x * w;
    const targetAbsY = crosshairPosRef.current.y * h;

    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = isFiringRef.current ? '#f87171' : isTrackingRef.current ? '#34d399' : '#ffffff';

    // Halo outer ring
    ctx.beginPath();
    ctx.strokeStyle = isFiringRef.current ? '#fc8181' : isTrackingRef.current ? '#a7f3d0' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.arc(targetAbsX, targetAbsY, isFiringRef.current ? 12 : 18, 0, 2 * Math.PI);
    ctx.stroke();

    // Spoke cross lines
    ctx.beginPath();
    ctx.strokeStyle = isFiringRef.current ? '#ef4444' : isTrackingRef.current ? '#10b981' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    
    // Horizontal spoke
    ctx.moveTo(targetAbsX - 25, targetAbsY);
    ctx.lineTo(targetAbsX - 8, targetAbsY);
    ctx.moveTo(targetAbsX + 8, targetAbsY);
    ctx.lineTo(targetAbsX + 25, targetAbsY);

    // Vertical spoke
    ctx.moveTo(targetAbsX, targetAbsY - 25);
    ctx.lineTo(targetAbsX, targetAbsY - 8);
    ctx.moveTo(targetAbsX, targetAbsY + 8);
    ctx.lineTo(targetAbsX, targetAbsY + 25);
    ctx.stroke();

    // Center point
    ctx.beginPath();
    ctx.fillStyle = isFiringRef.current ? '#ef4444' : isTrackingRef.current ? '#10b981' : '#ffffff';
    ctx.arc(targetAbsX, targetAbsY, 3, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();

    // F. Screen Fire Shock flash overlay
    if (flashAlphaRef.current > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlphaRef.current})`;
      ctx.fillRect(0, 0, w, h);
      flashAlphaRef.current -= 0.045; // Rapid decay
    }
  };

  // Convert click events on local Canvas area to pointer targets (Mouse mode)
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (controlMode !== 'mouse' || gameState !== 'playing') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    onManualMove(rawX, rawY);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (controlMode !== 'mouse' || gameState !== 'playing') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    onManualMove(rawX, rawY);
    crosshairPosRef.current = { x: rawX, y: rawY };
    
    onManualFire();
    triggerShoot();
  };

  const handleMuteToggle = () => {
    setIsAudioMuted(sound.toggleMute());
  };

  return (
    <div className="relative w-full flex flex-col bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
      {/* 1. HUD / Scoreboard Panel */}
      <div className="flex flex-wrap justify-between items-center gap-4 py-4 px-6 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">Score</span>
            <span className="text-2xl sm:text-3xl font-mono text-emerald-400 font-extrabold tracking-tight select-none shadow-sm">
              {currentScore}
            </span>
          </div>

          <div className="hidden sm:flex flex-col border-l border-white/10 pl-4">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">Speed mult</span>
            <span className="text-sm font-mono text-amber-400 font-bold select-none">
              {speedMultiplier}x
            </span>
          </div>

          {(gameMode === 'timed_60' || gameMode === 'survival') && (
            <div className="flex flex-col border-l border-white/10 pl-4">
              <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">Time Left</span>
              <span className={`text-xl font-mono font-black select-none tracking-tight ${currentTimeLeft <= 10.0 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`}>
                {currentTimeLeft.toFixed(1)}s
              </span>
            </div>
          )}
        </div>

        {/* Lives representation for Instant or badge for timed/survival modes */}
        {gameMode === 'instant' ? (
          <div className="flex gap-1.5 items-center bg-white/5 px-4 py-2 border border-white/10 rounded-2xl backdrop-blur-md">
            <span className="text-slate-400 text-[10px] font-mono uppercase tracking-widest mr-2 select-none">
              Rangers
            </span>
            <div className="flex gap-1">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Shield
                  id={`shield-life-${idx}`}
                  key={idx}
                  className={`h-5 w-5 transition duration-300 ${
                    idx < currentLives
                      ? 'text-emerald-500 fill-emerald-500/20'
                      : 'text-slate-700/40 fill-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5 items-center bg-emerald-500/5 px-4 py-2 border border-emerald-500/20 rounded-2xl backdrop-blur-md">
            <span className="text-[10px] font-mono font-black uppercase tracking-wider text-emerald-400 select-none">
              {gameMode === 'timed_60' ? '⏱️ 60s Attack' : '⚡ Time Survival'}
            </span>
          </div>
        )}

        {/* Combos dashboard readout */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Flame className={`h-4 w-4 mr-1.5 transition ${currentCombo > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
            <span className="text-xs font-mono text-emerald-300 uppercase font-semibold">
              Combo Streak: <strong className="text-amber-400 font-bold">{currentCombo}</strong>
            </span>
          </div>

          <button
            onClick={handleMuteToggle}
            className="p-2 border border-white/10 rounded-xl bg-white/5 text-slate-400 hover:text-white transition hover:bg-white/10 backdrop-blur-md"
            title="Toggle game audio"
          >
            {isAudioMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* 2. Interactive HTML5 Canvas Renderer */}
      <div ref={containerRef} className="relative flex-1 bg-slate-950/80 min-h-[360px] md:min-h-[460px] overflow-hidden">
        {gameState !== 'playing' && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-lg flex flex-col items-center justify-center p-8 text-center z-10 transition duration-500">
            {gameState === 'menu' && (
              <div className="max-w-md flex flex-col items-center animate-fade-in">
                <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/40 rounded-3xl flex items-center justify-center mb-6 shadow-inner animate-pulse">
                  <TargetIcon className="h-8 w-8 text-emerald-400" />
                </div>
                <h1 className="text-3xl md:text-4xl text-white font-sans tracking-tight font-extrabold pb-1">
                  3D Sniper
                </h1>
                <div className="mb-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[10px] rounded-full uppercase tracking-wider font-bold">
                  Mode: <span className="text-white">{gameMode === 'instant' ? 'Instant Shooting' : gameMode === 'timed_60' ? '60s Time Attack' : 'Time Survival (Normal)'}</span>
                </div>
                <p className="text-xs md:text-sm text-slate-400 leading-relaxed mb-8">
                  {gameMode === 'instant'
                    ? 'Pop high-speed cybernetic targets under traditional lives-based survival rules. Take your time, aim well, and avoid hitting active traps!'
                    : gameMode === 'timed_60'
                    ? 'A rapid-fire 60-second race against the clock! Focus entirely on popping as many targets as possible before the countdown timer hits zero.'
                    : 'The ultimate target survival! Your remaining clock depends entirely on how many objects you shoot. Hits add seconds, while misses and traps drain time.'}
                </p>

                <div className="w-full">
                  <button
                    onClick={() => {
                      sound.playBlip();
                      setGameState('playing');
                    }}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 font-sans text-xs uppercase tracking-widest font-bold text-slate-950 rounded-2xl active:scale-[0.98] transition-all duration-300"
                  >
                    Start Game
                  </button>
                </div>
              </div>
            )}

            {gameState === 'gameover' && (
              <div className="max-w-sm flex flex-col items-center">
                <div className="h-14 w-14 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl flex items-center justify-center mb-5 animate-bounce">
                  <Trophy className="h-7 w-7 text-emerald-400" />
                </div>
                <h2 className="text-2xl text-emerald-400 font-sans tracking-wider font-bold mb-1 uppercase">
                  Combat Mission Over
                </h2>
                <div className="bg-white/5 border border-white/10 backdrop-blur-md p-5 rounded-2xl my-4 w-full shadow-lg">
                  <div className="flex justify-between py-1 px-1 border-b border-white/10 text-xs">
                    <span className="text-slate-400 font-mono">Mission Mode:</span>
                    <span className="text-white font-mono font-semibold uppercase">
                      {gameMode === 'instant' ? 'Instant' : gameMode === 'timed_60' ? '60s Attack' : 'Survival'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 px-1 border-b border-white/10 text-xs mt-2">
                    <span className="text-slate-400 font-mono">Total Points:</span>
                    <span className="text-emerald-400 font-mono font-bold text-sm">{scoreRef.current}</span>
                  </div>
                  <div className="flex justify-between py-1 px-1 text-xs mt-2">
                    <span className="text-slate-400 font-mono">Max Combo:</span>
                    <span className="text-amber-400 font-mono font-bold text-sm">{maxComboRef.current}x</span>
                  </div>
                </div>

                <div className="w-full flex gap-3">
                  <button
                    onClick={() => {
                      sound.playBlip();
                      setGameState('playing');
                    }}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase tracking-wider font-bold rounded-2xl transition hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-400/20 active:scale-[0.98]"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={() => {
                      sound.playBlip();
                      setGameState('menu');
                    }}
                    className="px-5 py-3 border border-white/10 hover:bg-white/10 text-slate-300 font-mono text-xs uppercase tracking-wider rounded-2xl transition backdrop-blur-md active:scale-[0.98]"
                  >
                    Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <canvas
          ref={canvasRef}
          onPointerMove={handleCanvasPointerMove}
          onPointerDown={handleCanvasPointerDown}
          className="w-full h-full select-none cursor-none pointer-events-auto"
        />

        {/* Floating crosshair prompt overlay when camera calibration tracking is lost */}
        {gameState === 'playing' && controlMode === 'camera' && !isTracking && (
          <div className="absolute inset-0 z-0 bg-slate-950/60 pointer-events-none flex flex-col items-center justify-center p-4">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center shadow-2xl animate-pulse backdrop-blur-xl">
              <Eye className="h-8 w-8 text-amber-500 mb-2" />
              <span className="text-amber-500 text-xs font-mono font-medium tracking-wider uppercase">
                Detecting hand grid...
              </span>
              <p className="text-slate-300 text-[10px] mt-1 text-center max-w-[220px]">
                Please align your hand inside the webcam viewer. Ensure the camera lens is unobstructed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer Control Mode Toggles */}
      <div className="flex justify-between items-center px-6 py-4 border-t border-white/10 bg-white/5 select-none backdrop-blur-md">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              sound.playBlip();
              startTransition(() => {
                setControlMode('camera');
              });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all duration-300 ${
              controlMode === 'camera'
                ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/15'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            Webcam Hands
          </button>

          <button
            onClick={() => {
              sound.playBlip();
              startTransition(() => {
                setControlMode('mouse');
              });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all duration-300 ${
              controlMode === 'mouse'
                ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/15'
            }`}
          >
            <MousePointer className="h-3.5 w-3.5" />
            Mouse/Touch fallback
          </button>
        </div>

        <div className="flex gap-2 text-[10px] font-mono text-slate-300 bg-white/5 px-3 py-1.5 border border-white/10 rounded-xl backdrop-blur-md">
          <Sliders className="h-3 w-3 text-slate-400" />
          <span>Difficulty: <strong className="text-emerald-400 uppercase font-black">{difficulty}</strong></span>
        </div>
      </div>
    </div>
  );
};
