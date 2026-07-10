import { useEffect, useState } from 'react';

type Toast = { id: number; type: 'success' | 'error'; msg: string };
let pushFn: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function toast(msg: string, type: 'success' | 'error' = 'success') {
  pushFn?.({ msg, type });
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    pushFn = (t) => {
      const id = Date.now() + Math.random();
      setItems((cur) => [...cur, { ...t, id }]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), 3500);
    };
    return () => { pushFn = null; };
  }, []);
  return (
    <>
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
      ))}
    </>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
