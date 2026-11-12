"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Ventana modal: se abre al montarse; Esc o ✕ la cierran. */
export function Dialogo({ titulo, subtitulo, onCerrar, children }: { titulo: ReactNode; subtitulo?: ReactNode; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const alCerrar = useRef(onCerrar);
  useEffect(() => { alCerrar.current = onCerrar; });
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const cerrar = () => alCerrar.current();
    d?.addEventListener("close", cerrar);
    return () => d?.removeEventListener("close", cerrar);
  }, []);
  return (
    <dialog ref={ref} className="dialogo">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h2 className="text-lg font-semibold">{titulo}</h2>
          {subtitulo && <p className="text-sm text-tenue">{subtitulo}</p>}
        </div>
        <button className="boton" onClick={() => ref.current?.close()} aria-label="Cerrar">✕</button>
      </div>
      {children}
    </dialog>
  );
}
