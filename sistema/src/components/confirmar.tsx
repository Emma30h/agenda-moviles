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
  // Último botón que se tocó (el que pidió la confirmación)
  const ultimoBoton = useRef<HTMLButtonElement | null>(null);
  const origen = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const anotar = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (b && !b.closest("dialog.confirmar")) ultimoBoton.current = b as HTMLButtonElement;
    };
    document.addEventListener("click", anotar, true);
    return () => document.removeEventListener("click", anotar, true);
  }, []);
  const confirmar = useCallback<Confirmar>((p) => new Promise((ok) => {
    origen.current = ultimoBoton.current;
    resolver.current = ok;
    setPedido(p);
  }), []);
  const cerrar = useCallback((ok: boolean) => {
    if (ok && origen.current) marcarOcupado(origen.current);
    resolver.current?.(ok); resolver.current = null; origen.current = null; setPedido(null);
  }, []);
  return (
    <Contexto.Provider value={confirmar}>
      {children}
      {pedido && <Tarjeta pedido={pedido} onRespuesta={cerrar} />}
    </Contexto.Provider>
  );
}

export const useConfirmar = () => useContext(Contexto);

/**
 * El botón que se confirmó muestra el círculo girando hasta que la acción termina:
 * cuando se vuelve a habilitar, cambia su texto (ej. «Ya reclamado») o desaparece
 * (ej. el reclamo se cerró). Tope de 30 segundos por si algo falla.
 */
function marcarOcupado(b: HTMLButtonElement) {
  b.setAttribute("aria-busy", "true");
  // El ítem al que pertenece el botón (fila, reclamo, situación) se apaga enseguida: respuesta inmediata
  const item = b.closest<HTMLElement>("[data-item], tr, li");
  item?.setAttribute("data-procesando", "");
  const texto = b.textContent;
  let estuvoDeshabilitado = b.disabled;
  let terminado = false;
  const fin = () => {
    if (terminado) return;
    terminado = true;
    b.removeAttribute("aria-busy");
    item?.removeAttribute("data-procesando");
    obs.disconnect();
    clearInterval(vigilar);
    clearTimeout(tope);
    clearTimeout(rapido);
  };
  const obs = new MutationObserver(() => {
    if (b.disabled) { estuvoDeshabilitado = true; return; }
    if (estuvoDeshabilitado || b.textContent !== texto) fin();
  });
  obs.observe(b, { attributes: true, attributeFilter: ["disabled"], childList: true, characterData: true, subtree: true });
  const vigilar = setInterval(() => { if (!b.isConnected) fin(); }, 300);
  // Si en 1,5 segundos nunca se deshabilitó, la acción no la está esperando: se saca el indicador
  const rapido = setTimeout(() => { if (!estuvoDeshabilitado && !b.disabled) fin(); }, 1500);
  const tope = setTimeout(fin, 30_000);
}

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
