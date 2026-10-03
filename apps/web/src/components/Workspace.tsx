'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { DailyRoutine, GameType, StaminaState, UserCard } from '../types/kanban';
import { CHARACTERS_DATABASE } from '../data/characters';
import { INITIAL_ROUTINE, INITIAL_STAMINA, loadBoards, saveBoards, loadCards, loadRoutine, loadStamina, restoreBackup, saveCards, saveRoutine, saveStamina } from '../lib/storage';
import { cardsOnBoard, columnsFor, DEFAULT_BOARDS, MAX_COLUMNS, moveCard, removeColumn, reorderColumns, setColumnOrder, setColumns, stageOptions, type BoardState } from '../lib/board';
import { parseBackup } from '../lib/backup';
import { openToday, serverDay } from '../lib/farming';
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
  const [columnDialog, setColumnDialog] = useState<string | 'new' | null>(null);
  const [columnName, setColumnName] = useState('');
  const [columnError, setColumnError] = useState('');
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
  const [user, setUser] = useState<string | null>(null);
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
    fetch('/api/data').then(async response => {
      if (!response.ok) return;
      if (response.status === 200) {
        const backup = parseBackup(await response.text());
        restoreBackup(backup);
        setBoards(backup.boards ?? DEFAULT_BOARDS); setCards(backup.cards); setStamina(backup.stamina); setRoutine(loadRoutine()); setReady(true); setError('');
      }
      setUser(response.headers.get('x-user'));
    }).catch(() => setNotice('Akun belum dapat dihubungi. Perubahan tetap tersimpan di perangkat ini.'));
  }, []);

  // Signed-in players mirror every saved change to their account; a guest stays local-only.
  useEffect(() => {
    if (!user || !ready) return;
    const timer = setTimeout(() => {
      fetch('/api/data', { method: 'PUT', body: JSON.stringify(snapshot()) })
        .then(response => { if (!response.ok) throw new Error(); })
        .catch(() => setError('Perubahan tersimpan di perangkat ini, tetapi belum tersinkron ke akun. Coba lagi nanti.'));
    }, 1000);
    return () => clearTimeout(timer);
  }, [user, ready, cards, stamina, routine, boards]);

  function updateCards(next: UserCard[]) {
    if (!ready) return;
    saveCards(next); setCards(next); setError('');
  }
  function persist(action: () => void) {
    try { action(); return true; } catch { setError('Perubahan belum tersimpan. Periksa ruang dan izin penyimpanan browser, lalu coba lagi.'); return false; }
  }
  function move(id: string, stage: string) {
    persist(() => updateCards(moveCard(cards, id, stage)));
  }
  function snapshot() { return { version: '1.0', cards, stamina, routine, boards }; }
  function download() {
    const blob = new Blob([JSON.stringify({ ...snapshot(), exportDate: new Date().toISOString() }, null, 2)], { type: 'application/json' });
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
  const activeBoard = boards.boards.find(board => board.id === boards.activeId);
  const columns = columnsFor(activeBoard);
  const stages = stageOptions(activeBoard);
  function openColumnDialog(id: string | 'new') {
    setColumnName(id === 'new' ? '' : activeBoard?.columns?.find(column => column.id === id)?.title ?? '');
    setColumnError(''); setColumnDialog(id);
  }
  function saveColumn() {
    const title = columnName.trim();
    if (!title || !columnDialog) return;
    const editing = columnDialog === 'new' ? null : columnDialog;
    if (columns.some(column => column.title.toLowerCase() === title.toLowerCase() && column.stage !== editing)) { setColumnError('Nama kolom sudah dipakai. Gunakan nama lain.'); return; }
    const current = activeBoard?.columns ?? [];
    const next = setColumns(boards, boards.activeId, editing
      ? current.map(column => column.id === editing ? { ...column, title } : column)
      : [...current, { id: crypto.randomUUID(), title }]);
    if (persist(() => { saveBoards(next); setBoards(next); })) setColumnDialog(null);
    else setColumnError('Kolom belum tersimpan. Periksa penyimpanan browser.');
  }
  function reorderColumn(fromStage: string, toStage: string) {
    const next = setColumnOrder(boards, boards.activeId, reorderColumns(columns.map(column => column.stage), fromStage, toStage));
    persist(() => { saveBoards(next); setBoards(next); });
  }
  function deleteColumn(id: string) {
    const column = activeBoard?.columns?.find(item => item.id === id);
    if (!column) return;
    const affected = cards.filter(card => card.stage === id).length;
    if (!window.confirm(`Hapus kolom "${column.title}"?${affected ? ` ${affected} kartu di dalamnya akan dipindah ke Rencana.` : ''}`)) return;
    const next = removeColumn(boards, cards, boards.activeId, id);
    persist(() => { saveCards(next.cards); saveBoards(next.boards); setCards(next.cards); setBoards(next.boards); });
  }
  const boardCards = cardsOnBoard(cards, boards.activeId);
  const today = loaded ? openToday(boardCards, serverDay(Date.now(), 8)) : [];
  const todayIds = new Set(today.flatMap(target => target.characters.map(character => character.id)));
  const visible = boardCards.filter(card => (game === 'ALL' || card.game === game) && (CHARACTERS_DATABASE.find(item => item.id === card.characterId)?.name ?? card.characterId).toLowerCase().includes(search.toLowerCase()));

  return <div className="app-shell"><Header activePath={page.path} user={user} /><div className="workspace"><main id="main-content" tabIndex={-1}>
    <div className="page-header"><div><h1>{page.title}</h1><p>{page.description}</p></div>{view === 'board' && <button className="button primary" disabled={!ready} onClick={() => setAdding(true)}><Icon name="plus" size={18} />Tambah karakter</button>}</div>
    {error && <div className="message error" role="alert">{error}{view !== 'settings' && <Link href="/settings">Buka pengaturan</Link>}</div>}
    {notice && <p className="message" role="status">{notice}</p>}
    {!loaded ? <div className="loading-state" role="status"><span /><span /><span /><p>Memuat papanmu...</p></div> : <>
      {view === 'board' && <>
        <div className="board-switcher"><label>Papan aktif<select value={boards.activeId} disabled={!ready} onChange={event => { const next = { ...boards, activeId: event.target.value }; persist(() => { saveBoards(next); setBoards(next); }); }}>{boards.boards.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label><button className="button secondary" disabled={!ready || boards.boards.length >= 50} onClick={() => { setBoardName(''); setBoardError(''); setCreatingBoard(true); }}><Icon name="plus" size={18} />Tambah papan</button><button className="button secondary" disabled={!ready || (activeBoard?.columns?.length ?? 0) >= MAX_COLUMNS} onClick={() => openColumnDialog('new')}><Icon name="plus" size={18} />Tambah kolom</button></div>
        <div className="board-toolbar"><div className="filter-tabs" aria-label="Filter game">{([['ALL', 'Semua game'], ['GENSHIN_IMPACT', 'Genshin Impact'], ['ZENLESS_ZONE_ZERO', 'Zenless Zone Zero']] as const).map(([value, label]) => <button key={value} aria-pressed={game === value} className={game === value ? 'active' : ''} onClick={() => setGame(value)}>{label}</button>)}</div><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Cari di papan</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari karakter..." /></label></div>
        <div className="board-caption"><span>{visible.length} karakter{game !== 'ALL' || search ? ' ditemukan' : ' di papanmu'}</span><span>Detail build tersedia di setiap kartu</span></div>
        {!!today.length && <section className="welcome-banner today-banner" aria-label="Domain yang buka hari ini"><div><h2>Hari ini jadwal farming mereka</h2><ul>{today.map(target => <li key={target.id}><strong>{target.name}</strong> ({target.location}): {target.characters.map(character => character.name).join(', ')}</li>)}</ul></div><Link href="/farming" className="text-button">Lihat jadwal</Link></section>}
        {!boardCards.length && ready && <div className="welcome-banner"><div><h2>Mulai dengan satu karakter.</h2><p>Pilih karakter yang ingin kamu build. Sisanya bisa menyusul.</p></div></div>}
        {boardCards.some(card => card.id.startsWith('demo-card-')) && <div className="welcome-banner"><p>Papan ini masih berisi kartu contoh dari versi sebelumnya. Progresnya bukan data akunmu.</p><button className="text-button" onClick={() => { if (window.confirm('Hapus kartu contoh pada papan ini beserta perubahan yang pernah kamu buat pada kartu contoh? Kartu buatanmu tetap disimpan.')) persist(() => updateCards(cards.filter(card => !((card.boardId ?? 'main') === boards.activeId && card.id.startsWith('demo-card-'))))); }}>Hapus kartu contoh</button></div>}
        {!!boardCards.length && !visible.length && <p className="empty-inline">Tidak ada karakter yang cocok. <button className="text-button" onClick={() => { setGame('ALL'); setSearch(''); }}>Hapus filter</button></p>}
        <KanbanBoard columns={columns} stages={stages} cards={visible} todayIds={todayIds} onOpenDetail={setSelected} onMoveCardStage={move} onAdd={() => { if (ready) setAdding(true); }} onRenameColumn={openColumnDialog} onDeleteColumn={deleteColumn} onReorderColumn={reorderColumn} />
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
    {columnDialog && <Dialog title={columnDialog === 'new' ? 'Tambah kolom' : 'Ganti nama kolom'} onClose={() => setColumnDialog(null)}><form onSubmit={event => { event.preventDefault(); saveColumn(); }}><div className="dialog-body"><label>Nama kolom<input autoFocus required maxLength={40} value={columnName} onChange={event => setColumnName(event.target.value)} placeholder="Contoh: Nunggu material" /></label>{columnError && <p className="message error" role="alert">{columnError}</p>}<p className="help-text">Kolom ini hanya muncul di papan yang aktif. Tiga kolom bawaan tidak bisa dihapus.</p></div><div className="dialog-footer"><button type="button" className="button secondary" onClick={() => setColumnDialog(null)}>Batal</button><button className="button primary" disabled={!columnName.trim()}>{columnDialog === 'new' ? 'Buat kolom' : 'Simpan nama'}</button></div></form></Dialog>}
    {adding && <AddCharacterModal stages={stages} onClose={() => setAdding(false)} onAddCard={card => persist(() => updateCards([...cards, { ...card, boardId: boards.activeId }]))} />}
    {selected && <CharacterDetailModal key={selected.id} card={selected} stages={stages} onClose={() => setSelected(null)} onSave={card => persist(() => updateCards(cards.map(item => item.id === card.id ? card : item)))} onDelete={id => persist(() => updateCards(cards.filter(item => item.id !== id)))} />}
  </div>;
}
