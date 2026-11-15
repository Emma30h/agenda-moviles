"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Pedido = {
  titulo: string;
  mensaje?: ReactNode;
  boton?: string;          // texto del botón que confirma
  peligro?: boolean;       // acción que no conviene hacer sin pensar: botón rojo y el foco en «Cancelar»
};
type Confirmar = (p: Pedido) => Promise<boolean>;

const Contexto = createContext<Confirmar>(async () => true);

/** Tarjeta de confirmación de la app (reemplaza al cartel del navegador). */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirmar = useCallback<Confirmar>((p) => new Promise((ok) => { resolver.current = ok; setPedido(p); }), []);
  const cerrar = useCallback((ok: boolean) => { resolver.current?.(ok); resolver.current = null; setPedido(null); }, []);
  return (
    <Contexto.Provider value={confirmar}>
      {children}
      {pedido && <Tarjeta pedido={pedido} onRespuesta={cerrar} />}
    </Contexto.Provider>
  );
}

export const useConfirmar = () => useContext(Contexto);

function Tarjeta({ pedido, onRespuesta }: { pedido: Pedido; onRespuesta: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const aceptar = useRef<HTMLButtonElement>(null);
  const respondio = useRef(false);
  const responder = (ok: boolean) => { if (respondio.current) return; respondio.current = true; ref.current?.close(); onRespuesta(ok); };
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    (pedido.peligro ? cancelar : aceptar).current?.focus();
    // Esc o clic afuera = cancelar
    const alCerrar = () => { if (!respondio.current) { respondio.current = true; onRespuesta(false); } };
    d?.addEventListener("close", alCerrar);
    return () => d?.removeEventListener("close", alCerrar);
  }, [pedido, onRespuesta]);
  return (
    <dialog ref={ref} className="dialogo confirmar" aria-labelledby="confirmar-titulo" aria-describedby="confirmar-mensaje"
      onClick={(e) => { if (e.target === ref.current) responder(false); }}>
      <div className="flex gap-3 items-start">
        <span className={`confirmar-icono ${pedido.peligro ? "peligro" : ""}`} aria-hidden>{pedido.peligro ? "!" : "?"}</span>
        <div className="grid gap-1">
          <h2 id="confirmar-titulo" className="text-lg font-semibold">{pedido.titulo}</h2>
          {pedido.mensaje && <div id="confirmar-mensaje" className="text-sm text-tenue">{pedido.mensaje}</div>}
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-5">
        <button ref={cancelar} type="button" className="boton" onClick={() => responder(false)}>Cancelar</button>
        <button ref={aceptar} type="button" className={`boton ${pedido.peligro ? "peligro" : "primario"}`} onClick={() => responder(true)}>{pedido.boton ?? "Confirmar"}</button>
      </div>
    </dialog>
  );
}
