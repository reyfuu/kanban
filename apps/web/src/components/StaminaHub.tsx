import { useEffect, useState } from 'react';
import type { DailyRoutine, StaminaState } from '../types/kanban';
import { computeLiveStamina } from '../lib/calculator';
import { Icon } from './ui';

export function StaminaHub({ stamina, routine, onUpdateStamina, onUpdateRoutine }: {
  stamina: StaminaState; routine: DailyRoutine;
  onUpdateStamina: (value: StaminaState) => void; onUpdateRoutine: (value: DailyRoutine) => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(value => value + 1), 10000); return () => clearInterval(timer); }, []);
  const resin = computeLiveStamina(stamina.genshinResin, 200, stamina.genshinLastUpdated, 480);
  const battery = computeLiveStamina(stamina.zzzBattery, 240, stamina.zzzLastUpdated, 360);
  function update(game: 'genshin' | 'zzz', amount: number) {
    if (game === 'genshin') onUpdateStamina({ ...stamina, genshinResin: Math.max(0, Math.min(200, amount)), genshinLastUpdated: Date.now() });
    else onUpdateStamina({ ...stamina, zzzBattery: Math.max(0, Math.min(240, amount)), zzzLastUpdated: Date.now() });
  }
  return <div className="tool-content">
    <p className="notice">Masukkan stamina dari game. Timer di sini adalah estimasi lokal, belum tersambung ke HoYoLAB.</p>
    <div className="stamina-grid">{([
      ['genshin', 'Original Resin', 'Genshin Impact', resin, 200],
      ['zzz', 'Battery Charge', 'Zenless Zone Zero', battery, 240],
    ] as const).map(([game, name, title, live, cap]) => <section key={game} className="stamina-section">
      <div className="section-heading"><div><h2>{name}</h2><p className="muted">{title}</p></div><Icon name="routine" /></div>
      <label className="stamina-number"><span className="sr-only">{name} saat ini</span><input type="number" min={0} max={cap} value={live.current} onChange={event => update(game, Math.floor(+event.target.value))} /><span>/ {cap}</span></label>
      <progress value={live.current} max={cap} aria-label={name} />
      <p className="muted">{live.fullAtDate ? `Penuh sekitar ${live.fullAtDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (waktu perangkat)` : 'Stamina sudah penuh.'}</p>
      <div className="button-row"><button className="button secondary" onClick={() => update(game, live.current - 20)}>Pakai 20</button><button className="button secondary" onClick={() => update(game, live.current - 40)}>Pakai 40</button>{game === 'genshin' ? <button className="text-button" onClick={() => update(game, 200)}>Isi penuh</button> : <button className="text-button" disabled={routine.zzzCoffee} onClick={() => { update('zzz', live.current + 60); onUpdateRoutine({ ...routine, zzzCoffee: true }); }}>{routine.zzzCoffee ? 'Kopi sudah diambil' : 'Kopi +60'}</button>}</div>
      {game === 'zzz' && <div className="button-row"><button className="text-button" onClick={() => update('zzz', live.current - 60)}>Pakai 60</button><button className="text-button" onClick={() => update('zzz', live.current + 20)}>Tambah 20</button></div>}
      {game === 'genshin' && <button className="text-button" onClick={() => update('genshin', live.current + 20)}>Tambah 20</button>}
    </section>)}</div>
    <section className="routine-section"><h2>Checklist harian</h2><p className="muted">Selesaikan yang penting, lalu kembali menikmati game.</p><div className="checklist">{([
      ['genshinCommissions', 'Komisi harian', 'Genshin Impact'], ['genshinResinSpent', 'Gunakan resin', 'Genshin Impact'],
      ['zzzErrands', 'Inter-Knot errands', 'Zenless Zone Zero'], ['zzzCoffee', 'Ambil kopi', 'Zenless Zone Zero'], ['zzzScratchCard', 'Scratch card', 'Zenless Zone Zero'],
    ] as const).map(([key, label, game]) => <label className="checklist-row" key={key}><input type="checkbox" checked={routine[key]} onChange={event => onUpdateRoutine({ ...routine, [key]: event.target.checked })} /><span>{label}<small>{game}</small></span></label>)}</div><p className="help-text">Checklist berganti pada hari UTC yang baru. Reset server game dapat berbeda.</p></section>
    <section className="routine-section"><h2>Target mingguan</h2><div className="form-grid">{([['genshinWeeklyBosses', 'Weekly boss Genshin'], ['zzzNotoriousHunts', 'Notorious Hunt ZZZ']] as const).map(([key, title]) => <label key={key}>{title}<select value={routine[key]} onChange={event => onUpdateRoutine({ ...routine, [key]: +event.target.value })}>{[0, 1, 2, 3].map(value => <option key={value} value={value}>{value} dari 3 selesai</option>)}</select></label>)}</div><p className="help-text">Atur ulang target mingguan secara manual.</p></section>
  </div>;
}
