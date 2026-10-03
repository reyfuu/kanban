'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';

const paths = {
  board: 'M3 4h18v16H3z M9 4v16 M15 4v16',
  routine: 'M13 2 4 14h7l-1 8 10-13h-7z',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16',
  gacha: 'm12 3 9 9-9 9-9-9z M3 12h18 M12 3l4 9-4 9-4-9z',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  plus: 'M12 5v14 M5 12h14',
  close: 'm6 6 12 12 M18 6 6 18',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  check: 'm5 12 4 4L19 6',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3.1 4 M6.3 7.3A18 18 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4-.9 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  edit: 'M4 20h4L19 9a2 2 0 0 0-3-3L5 17z M14 7l3 3',
  trash: 'M4 7h16 M10 4h4 M6 7l1 13h10l1-13 M10 11v5 M14 11v5',
};

export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function Avatar({ name, src }: { name: string; src?: string | undefined }) {
  const [failed, setFailed] = useState(false);
  return <span className="avatar">{src && !failed ? <Image src={src} alt="" fill sizes="56px" onError={() => setFailed(true)} /> : <span>{name.slice(0, 2).toUpperCase()}</span>}</span>;
}

export function Dialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`dialog ${className}`} aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-header"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Tutup dialog" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}
