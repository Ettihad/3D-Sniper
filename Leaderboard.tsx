/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Star, BrainCircuit, Delete, Trash2, ArrowUpRight, Award, Flame } from 'lucide-react';
import { ScoreRecord } from '../types';
import { sound } from '../lib/audio';

export const Leaderboard: React.FC = () => {
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [playerName, setPlayerName] = useState<string>('Space Ranger');
  const [isEditingName, setIsEditingName] = useState<boolean>(false);

  useEffect(() => {
    loadLocalScores();
    const storedName = localStorage.getItem('fingerShootName');
    if (storedName) {
      setPlayerName(storedName);
    } else {
      localStorage.setItem('fingerShootName', 'Space Ranger');
    }
  }, []);

  const loadLocalScores = () => {
    try {
      const stored = localStorage.getItem('fingerShootScores');
      if (stored) {
        setRecords(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playBlip();
    if (playerName.trim()) {
      localStorage.setItem('fingerShootName', playerName.trim());
      setIsEditingName(false);
      // Update any guest name records in state for consistency
      loadLocalScores();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you absolutely sure you want to completely erase your shooting history and high scores?')) {
      sound.playBomb();
      localStorage.removeItem('fingerShootScores');
      setRecords([]);
    }
  };

  // Compile calculations for career stats
  const totalRounds = records.length;
  const bestScore = records.reduce((max, r) => (r.score > max ? r.score : max), 0);
  const avgAccuracy = totalRounds
    ? Math.round(records.reduce((sum, r) => sum + r.accuracy, 0) / totalRounds)
    : 0;
  const highestCombo = records.reduce((max, r) => (r.maxCombo > max ? r.maxCombo : max), 0);

  return (
    <div className="w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col gap-6 relative z-10">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex gap-3 items-center">
          <div className="h-10 w-10 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-center">
            <Trophy className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white text-base font-mono tracking-wider uppercase font-semibold">
              Ranger Hall of Fame
            </h3>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
              Persistent Local Scoreboard
            </p>
          </div>
        </div>

        {/* Change Name Module */}
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 border border-white/10 rounded-2xl backdrop-blur-md">
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex gap-1.5 pt-0.5 animate-fade-in">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={18}
                className="bg-white/5 text-xs font-mono border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-emerald-500 backdrop-blur-md"
                placeholder="Ranger Call Sign"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] uppercase font-bold rounded-lg transition"
              >
                Save
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="text-slate-400 text-[10px] font-mono uppercase tracking-widest">Call sign:</span>
              <span className="text-emerald-300 font-mono font-bold text-xs select-none">
                {playerName}
              </span>
              <button
                onClick={() => {
                  sound.playBlip();
                  setIsEditingName(true);
                }}
                className="text-[10px] font-mono text-slate-450 hover:text-white underline transition"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Career Dashboard Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 p-3.5 border border-white/10 rounded-2xl flex flex-col hover:bg-white/10 transition-all duration-300 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest">Mission Runs</span>
          <span className="text-xl font-mono text-white font-extrabold mt-1">{totalRounds}</span>
        </div>

        <div className="bg-white/5 p-3.5 border border-white/10 rounded-2xl flex flex-col hover:bg-white/10 transition-all duration-300 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest">Personal Best</span>
          <span className="text-xl font-mono text-emerald-400 font-extrabold mt-1">{bestScore}</span>
        </div>

        <div className="bg-white/5 p-3.5 border border-white/10 rounded-2xl flex flex-col hover:bg-white/10 transition-all duration-300 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest">Avg Hit Rate</span>
          <span className="text-xl font-mono text-amber-400 font-extrabold mt-1">{avgAccuracy}%</span>
        </div>

        <div className="bg-white/5 p-3.5 border border-white/10 rounded-2xl flex flex-col hover:bg-white/10 transition-all duration-300 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest">Peak Combo</span>
          <span className="text-xl font-mono text-teal-400 font-extrabold mt-1">{highestCombo}x</span>
        </div>
      </div>

      {/* Scores Table listing top records */}
      <div className="flex-1 bg-white/5 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md shadow-lg">
        {records.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-400 flex flex-col items-center">
            <Award className="h-8 w-8 text-slate-500 mb-2" />
            <span className="text-xs font-mono uppercase tracking-wider">No Combat Record Logged</span>
            <p className="text-[10px] text-slate-450 mt-1 max-w-[240px]">
              Complete your first session on Web or Touch options to submit your score here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead className="bg-white/10 border-b border-white/10 text-slate-300 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Ranger</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Acc</th>
                  <th className="py-3 px-4">Streak</th>
                  <th className="py-3 px-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.slice(0, 10).map((record, index) => (
                  <tr key={record.id} className="hover:bg-white/10 transition-all duration-200">
                    <td className="py-2.5 px-4 font-bold text-center w-12">
                      {index === 0 ? (
                        <span className="text-amber-400">#1 👑</span>
                      ) : index === 1 ? (
                        <span className="text-slate-300">#2 🥈</span>
                      ) : index === 2 ? (
                        <span className="text-amber-600">#3 🥉</span>
                      ) : (
                        `#${index + 1}`
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-white font-semibold flex items-center gap-1.5 flex-wrap">
                      <span>{record.playerName}</span>
                      {record.mode && (
                        <span className={`text-[8px] font-mono uppercase px-1.5 py-0.2 rounded-md border ${
                          record.mode === 'instant' 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                            : record.mode === 'timed_60' 
                              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                          {record.mode === 'instant' ? 'Instant' : record.mode === 'timed_60' ? '60s' : 'Survival'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-extrabold text-emerald-400">
                      {record.score}
                    </td>
                    <td className="py-2.5 px-4 text-amber-400">
                      {record.accuracy}%
                    </td>
                    <td className="py-2.5 px-4 text-teal-400">
                      {record.maxCombo}x
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-right text-[10px]">
                      {record.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {records.length > 0 && (
        <div className="flex justify-end p-1 border-t border-white/10 mt-1">
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 bg-red-500/10 text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-xl text-[10px] font-mono font-medium transition duration-200 backdrop-blur-md"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Wipe Scoreboard Data
          </button>
        </div>
      )}
    </div>
  );
};
