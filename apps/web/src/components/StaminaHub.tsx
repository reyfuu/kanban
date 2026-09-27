import React, { useEffect, useState } from 'react';
import { DailyRoutine, StaminaState } from '../types/kanban';
import { computeLiveStamina } from '../lib/calculator';

interface StaminaHubProps {
  stamina: StaminaState;
  routine: DailyRoutine;
  onUpdateStamina: (newStamina: StaminaState) => void;
  onUpdateRoutine: (newRoutine: DailyRoutine) => void;
}

export function StaminaHub({
  stamina,
  routine,
  onUpdateStamina,
  onUpdateRoutine,
}: StaminaHubProps) {
  const [, setTick] = useState(0);

  // Re-calculate live stamina every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const genshinLive = computeLiveStamina(
    stamina.genshinResin,
    200,
    stamina.genshinLastUpdated,
    480
  );

  const zzzLive = computeLiveStamina(
    stamina.zzzBattery,
    240,
    stamina.zzzLastUpdated,
    360
  );

  const handleAdjustResin = (delta: number) => {
    const current = genshinLive.current;
    const next = Math.max(0, Math.min(200, current + delta));
    onUpdateStamina({
      ...stamina,
      genshinResin: next,
      genshinLastUpdated: Date.now(),
    });
  };

  const handleAdjustBattery = (delta: number) => {
    const current = zzzLive.current;
    const next = Math.max(0, Math.min(240, current + delta));
    onUpdateStamina({
      ...stamina,
      zzzBattery: next,
      zzzLastUpdated: Date.now(),
    });
  };

  const handleDrinkCoffee = () => {
    if (!routine.zzzCoffee) {
      handleAdjustBattery(60);
      onUpdateRoutine({ ...routine, zzzCoffee: true });
    }
  };

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return 'Penuh sekarang!';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}j ${m}m lagi`;
  };

  const formatTime = (d: Date | null) => {
    if (!d) return 'Sekarang';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
            ⚡ Stamina Hub & Rutinitas Game
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono">
            LIVE TIMER
          </span>
        </div>
        <div className="text-xs text-slate-400">
          Reset Harian Server: <span className="font-mono text-cyan-400">04:00 WIB</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Genshin Impact Resin Card */}
        <div className="bg-slate-950 border border-amber-900/30 rounded-lg p-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Genshin Original Resin
            </span>
            <span className="text-xs font-mono font-bold text-amber-200">
              {genshinLive.current} <span className="text-slate-500">/ 200</span>
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-900 rounded-full h-2 mb-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-amber-600 to-amber-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(genshinLive.current / 200) * 100}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
            <span>
              Penuh: <strong className="text-slate-200">{formatTime(genshinLive.fullAtDate)}</strong>
            </span>
            <span className="font-mono text-amber-300">{formatCountdown(genshinLive.secondsUntilFull)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleAdjustResin(-20)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-mono cursor-pointer"
              title="Konsumsi 20 Resin"
            >
              -20
            </button>
            <button
              onClick={() => handleAdjustResin(-40)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-mono cursor-pointer"
              title="Konsumsi 40 Resin (Domain / Boss)"
            >
              -40
            </button>
            <button
              onClick={() => handleAdjustResin(20)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-mono cursor-pointer"
              title="Tambah 20 Resin"
            >
              +20
            </button>
            <button
              onClick={() => handleAdjustResin(200)}
              className="px-2 py-1 bg-amber-950/60 hover:bg-amber-900 border border-amber-800/60 text-amber-300 text-xs rounded ml-auto font-mono cursor-pointer"
            >
              Max
            </button>
          </div>
        </div>

        {/* ZZZ Battery Charge Card */}
        <div className="bg-slate-950 border border-cyan-900/30 rounded-lg p-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              ZZZ Battery Charge
            </span>
            <span className="text-xs font-mono font-bold text-cyan-200">
              {zzzLive.current} <span className="text-slate-500">/ 240</span>
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-900 rounded-full h-2 mb-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-cyan-600 to-cyan-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(zzzLive.current / 240) * 100}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
            <span>
              Penuh: <strong className="text-slate-200">{formatTime(zzzLive.fullAtDate)}</strong>
            </span>
            <span className="font-mono text-cyan-300">{formatCountdown(zzzLive.secondsUntilFull)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleAdjustBattery(-40)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-mono cursor-pointer"
              title="Konsumsi 40 Battery"
            >
              -40
            </button>
            <button
              onClick={() => handleAdjustBattery(-60)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-mono cursor-pointer"
              title="Konsumsi 60 Battery"
            >
              -60
            </button>
            <button
              onClick={() => handleAdjustBattery(20)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded font-mono cursor-pointer"
            >
              +20
            </button>
            <button
              onClick={handleDrinkCoffee}
              disabled={routine.zzzCoffee}
              className={`px-2 py-1 rounded text-xs ml-auto font-medium transition-all ${
                routine.zzzCoffee
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-950 text-indigo-300 border border-indigo-700 hover:bg-indigo-900 cursor-pointer'
              }`}
              title="Kopi Coff Cafe (+60 Battery)"
            >
              ☕ {routine.zzzCoffee ? 'Kopi Sudah' : '+60 Kopi'}
            </button>
          </div>
        </div>

        {/* Daily & Weekly Routine Checklist */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Checklist Harian & Mingguan</span>
            <span className="text-[10px] text-slate-500">Klik untuk centang</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none hover:text-amber-200">
              <input
                type="checkbox"
                checked={routine.genshinCommissions}
                onChange={(e) => onUpdateRoutine({ ...routine, genshinCommissions: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              <span>Genshin: Komisi Harian 4/4</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none hover:text-cyan-200">
              <input
                type="checkbox"
                checked={routine.zzzErrands}
                onChange={(e) => onUpdateRoutine({ ...routine, zzzErrands: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              />
              <span>ZZZ: Inter-Knot Errands & Newsstand</span>
            </label>

            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Weekly Boss GI:</span>
              <div className="flex items-center gap-1 font-mono">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() =>
                      onUpdateRoutine({
                        ...routine,
                        genshinWeeklyBosses: routine.genshinWeeklyBosses === num ? num - 1 : num,
                      })
                    }
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] cursor-pointer ${
                      routine.genshinWeeklyBosses >= num
                        ? 'bg-amber-600 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Notorious Hunt ZZZ:</span>
              <div className="flex items-center gap-1 font-mono">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() =>
                      onUpdateRoutine({
                        ...routine,
                        zzzNotoriousHunts: routine.zzzNotoriousHunts === num ? num - 1 : num,
                      })
                    }
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] cursor-pointer ${
                      routine.zzzNotoriousHunts >= num
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
