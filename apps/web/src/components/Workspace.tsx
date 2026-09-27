'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { DailyRoutine, GameType, KanbanStage, StaminaState, UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';
import { INITIAL_ROUTINE, INITIAL_STAMINA, loadBoards, saveBoards, loadCards, loadRoutine, loadStamina, restoreBackup, saveCards, saveRoutine, saveStamina } from '../lib/storage';
import { cardsOnBoard, DEFAULT_BOARDS, type BoardState, moveCard } from '../lib/board';
import { parseBackup } from '../lib/backup';
import { Header } from './Header';
import { Dialog, Icon } from './ui';
import { KanbanBoard } from './KanbanBoard';
import { AddCharacterModal } from './AddCharacterModal';
import { CharacterDetailModal } from './CharacterDetailModal';
import { StaminaHub } from './StaminaHub';
import { FarmingCalendar, GachaPlanner } from './Tools';

const PAGES = {
  board: { path: '/', title: 'Papan karakter', description: 'Satu build, satu langkah. Tentukan fokusmu hari ini.' },
  routine: { path: '/routine', title: 'Rutinitas', description: 'Catat stamina dan selesaikan aktivitas harianmu.' },
  farming: { path: '/farming', title: 'Jadwal farming', description: 'Rencanakan material yang ingin kamu kumpulkan.' },
  gacha: { path: '/gacha', title: 'Gacha planner', description: 'Hitung tabunganmu sebelum banner berikutnya.' },
  settings: { path: '/settings', title: 'Pengaturan', description: 'Kelola cadangan data dan kenali sumber informasinya.' },
};

export function Workspace({ view = 'board' }: { view?: keyof typeof PAGES }) {
  const [boards, setBoards] = useState<BoardState>(DEFAULT_BOARDS);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardError, setBoardError] = useState('');
  const [cards, setCards] = useState<UserCard[]>([]);
  const [stamina, setStamina] = useState<StaminaState>(INITIAL_STAMINA);
  const [routine, setRoutine] = useState<DailyRoutine>(INITIAL_ROUTINE);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [game, setGame] = useState<GameType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<UserCard | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const page = PAGES[view];

  useEffect(() => {
    try {
      const savedBoards = loadBoards();
      const savedCards = loadCards();
      if (savedCards.some(card => !savedBoards.boards.some(board => board.id === (card.boardId ?? 'main')))) throw new Error('Papan kartu tidak ditemukan');
      setBoards(savedBoards);
      const savedStamina = loadStamina();
      const savedRoutine = loadRoutine();
      setCards(savedCards); setStamina(savedStamina); setRoutine(savedRoutine); setReady(true);
    } catch { setError('Data lokal tidak dapat dibaca. Data aslinya tetap disimpan. Periksa izin penyimpanan browser atau pulihkan backup di Pengaturan.'); }
    setLoaded(true);
  }, []);

  function updateCards(next: UserCard[]) {
    if (!ready) return;
    saveCards(next); setCards(next); setError('');
  }
  function persist(action: () => void) {
    try { action(); return true; } catch { setError('Perubahan belum tersimpan. Periksa ruang dan izin penyimpanan browser, lalu coba lagi.'); return false; }
  }
  function move(id: string, stage: KanbanStage) {
    persist(() => updateCards(moveCard(cards, id, stage)));
  }
  function download() {
    const blob = new Blob([JSON.stringify({ version: '1.0', exportDate: new Date().toISOString(), cards, stamina, routine, boards }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `hoyokanban-${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Backup berhasil disiapkan. Simpan file JSON di tempat yang aman.');
  }
  async function importFile(file: File) {
    setNotice(''); setError('');
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran file maksimal 2 MB.');
      const backup = parseBackup(await file.text());
      if (!window.confirm(`Ganti data lokal dengan ${backup.cards.length} kartu dari backup? Ekspor data lama dahulu bila masih dibutuhkan.`)) return;
      restoreBackup(backup);
      setBoards(backup.boards ?? DEFAULT_BOARDS);
      setCards(backup.cards); setStamina(backup.stamina); setRoutine(loadRoutine()); setReady(true);
      setNotice(`${backup.cards.length} kartu berhasil dipulihkan.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impor gagal. Data lama tidak diganti.'); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }
  const boardCards = cardsOnBoard(cards, boards.activeId);
  const visible = boardCards.filter(card => (game === 'ALL' || card.game === game) && (CHARACTERS_DATABASE.find(item => item.id === card.characterId)?.name ?? card.characterId).toLowerCase().includes(search.toLowerCase()));

  return <div className="app-shell"><Header activePath={page.path} /><div className="workspace"><main id="main-content" tabIndex={-1}>
    <div className="page-header"><div><h1>{page.title}</h1><p>{page.description}</p></div>{view === 'board' && <button className="button primary" disabled={!ready} onClick={() => setAdding(true)}><Icon name="plus" size={18} />Tambah karakter</button>}</div>
    {error && <div className="message error" role="alert">{error}{view !== 'settings' && <Link href="/settings">Buka pengaturan</Link>}</div>}
    {notice && <p className="message" role="status">{notice}</p>}
    {!loaded ? <div className="loading-state" role="status"><span /><span /><span /><p>Memuat papanmu...</p></div> : <>
      {view === 'board' && <>
        <div className="board-switcher"><label>Papan aktif<select value={boards.activeId} disabled={!ready} onChange={event => { const next = { ...boards, activeId: event.target.value }; persist(() => { saveBoards(next); setBoards(next); }); }}>{boards.boards.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label><button className="button secondary" disabled={!ready || boards.boards.length >= 50} onClick={() => { setBoardName(''); setBoardError(''); setCreatingBoard(true); }}><Icon name="plus" size={18} />Tambah papan</button></div>
        <div className="board-toolbar"><div className="filter-tabs" aria-label="Filter game">{([['ALL', 'Semua game'], ['GENSHIN_IMPACT', 'Genshin Impact'], ['ZENLESS_ZONE_ZERO', 'Zenless Zone Zero']] as const).map(([value, label]) => <button key={value} aria-pressed={game === value} className={game === value ? 'active' : ''} onClick={() => setGame(value)}>{label}</button>)}</div><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Cari di papan</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari karakter..." /></label></div>
        <div className="board-caption"><span>{visible.length} karakter{game !== 'ALL' || search ? ' ditemukan' : ' di papanmu'}</span><span>Detail build tersedia di setiap kartu</span></div>
        {!boardCards.length && ready && <div className="welcome-banner"><div><h2>Mulai dengan satu karakter.</h2><p>Pilih karakter yang ingin kamu build. Sisanya bisa menyusul.</p></div></div>}
        {boardCards.some(card => card.id.startsWith('demo-card-')) && <div className="welcome-banner"><p>Papan ini masih berisi kartu contoh dari versi sebelumnya. Progresnya bukan data akunmu.</p><button className="text-button" onClick={() => { if (window.confirm('Hapus kartu contoh pada papan ini beserta perubahan yang pernah kamu buat pada kartu contoh? Kartu buatanmu tetap disimpan.')) persist(() => updateCards(cards.filter(card => !((card.boardId ?? 'main') === boards.activeId && card.id.startsWith('demo-card-'))))); }}>Hapus kartu contoh</button></div>}
        {!!boardCards.length && !visible.length && <p className="empty-inline">Tidak ada karakter yang cocok. <button className="text-button" onClick={() => { setGame('ALL'); setSearch(''); }}>Hapus filter</button></p>}
        <KanbanBoard cards={visible} onOpenDetail={setSelected} onMoveCardStage={move} onAdd={() => { if (ready) setAdding(true); }} />
      </>}
      {view === 'routine' && ready && <StaminaHub stamina={stamina} routine={routine} onUpdateStamina={value => persist(() => { saveStamina(value); setStamina(value); })} onUpdateRoutine={value => persist(() => { saveRoutine(value); setRoutine(value); })} />}
      {view === 'farming' && <FarmingCalendar cards={boardCards} boardName={boards.boards.find(board => board.id === boards.activeId)?.name ?? 'Papan utama'} />}
      {view === 'gacha' && <GachaPlanner />}
      {view === 'settings' && <div className="settings-content"><section className="settings-section"><h2>Cadangan data</h2><p>Data tersimpan di browser ini. Ekspor sebelum berganti perangkat, domain, atau membersihkan browser.</p><div className="button-row"><button className="button secondary" disabled={!ready} onClick={download}><Icon name="download" size={18} />Ekspor JSON</button><button className="button secondary" onClick={() => fileInput.current?.click()}><Icon name="upload" size={18} />Impor JSON</button><input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" aria-label="File backup JSON" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); }} /></div><p className="help-text">Backup berisi semua papan, kartu, stamina, dan rutinitas. Saldo gacha disimpan terpisah pada browser ini.</p></section>
        <section className="settings-section"><h2>Akun</h2><div className="settings-row"><div><strong>Kamu menggunakan mode tamu</strong><p>Papan lokal tetap bisa dipakai tanpa akun.</p></div><Link href="/login" className="button secondary">Halaman masuk<Icon name="arrow" size={16} /></Link></div></section>
        <section className="settings-section"><h2>Sumber data game</h2><p>Katalog diambil dari genshin-db dan Nanoka, dengan roster ZZZ dicocokkan ke Enka. Sinkronisasi progres akun HoYoLAB belum aktif.</p><ul className="source-list"><li><a href="https://github.com/theBowja/genshin-db" target="_blank" rel="noreferrer">genshin-db<Icon name="arrow" size={16} /></a><span>Katalog Genshin: karakter, senjata, dan material.</span></li><li><a href="https://github.com/EnkaNetwork/API-docs" target="_blank" rel="noreferrer">Enka.Network<Icon name="arrow" size={16} /></a><span>Showcase publik Genshin dan ZZZ. Tidak mencakup seluruh akun.</span></li><li><a href="https://seria.is-a.dev/genshin.py/" target="_blank" rel="noreferrer">HoYoLAB melalui genshin.py<Icon name="arrow" size={16} /></a><span>Akses data akun memerlukan autentikasi tersendiri.</span></li></ul></section>
      </div>}
    </>}
    <footer className="workspace-footer"><span>Rencanakan build. Nikmati perjalanannya.</span><span>Tidak berafiliasi dengan HoYoverse.</span></footer>
  </main></div>
    {creatingBoard && <Dialog title="Tambah papan" onClose={() => setCreatingBoard(false)}><form onSubmit={event => { event.preventDefault(); const name = boardName.trim(); if (!name) return; if (boards.boards.some(board => board.name.toLowerCase() === name.toLowerCase())) { setBoardError('Nama papan sudah dipakai. Gunakan nama lain.'); return; } const id = crypto.randomUUID(); const next = { boards: [...boards.boards, { id, name }], activeId: id }; if (persist(() => { saveBoards(next); setBoards(next); })) setCreatingBoard(false); else setBoardError('Papan belum tersimpan. Periksa penyimpanan browser.'); }}><div className="dialog-body"><label>Nama papan<input autoFocus required maxLength={60} value={boardName} onChange={event => setBoardName(event.target.value)} placeholder="Contoh: Tim Abyss" /></label>{boardError && <p className="message error" role="alert">{boardError}</p>}<p className="help-text">Setiap papan memiliki kartu sendiri. Data tetap tersimpan di browser ini.</p></div><div className="dialog-footer"><button type="button" className="button secondary" onClick={() => setCreatingBoard(false)}>Batal</button><button className="button primary" disabled={!boardName.trim()}>Buat papan</button></div></form></Dialog>}
    {adding && <AddCharacterModal onClose={() => setAdding(false)} onAddCard={card => persist(() => updateCards([...cards, { ...card, boardId: boards.activeId }]))} />}
    {selected && <CharacterDetailModal key={selected.id} card={selected} onClose={() => setSelected(null)} onSave={card => persist(() => updateCards(cards.map(item => item.id === card.id ? card : item)))} onDelete={id => persist(() => updateCards(cards.filter(item => item.id !== id)))} />}
  </div>;
}
