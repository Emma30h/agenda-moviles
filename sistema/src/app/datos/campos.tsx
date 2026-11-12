"use client";

import type { ReactNode } from "react";
import { crearArbol, type Unidad } from "@/lib/agenda";

type Arbol = ReturnType<typeof crearArbol>;

/** Divisiones y departamentos donde se puede cargar, agrupados por Dirección. */
export function SelectorUnidad({ arbol, unidades, raiz, valor, onChange }: {
  arbol: Arbol; unidades: Unidad[]; raiz: string; valor: string; onChange: (v: string) => void;
}) {
  const ops = unidades.filter((u) => (u.tipo === "division" || u.tipo === "departamento") && (raiz === "G" || arbol.dentro(u.id, raiz)));
  const grupos = [...new Set(ops.map((u) => arbol.direccion(u.id)))];
  return (
    <select className="entrada" value={valor} onChange={(e) => onChange(e.target.value)} required>
      <option value="">Elegí una opción</option>
      {grupos.map((g) => (
        <optgroup key={g} label={arbol.porId.get(g)?.nombre ?? g}>
          {ops.filter((u) => arbol.direccion(u.id) === g).map((u) => (
            <option key={u.id} value={u.id}>{u.tipo === "departamento" ? "· " : "— "}{u.nombre}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function Campo({ texto, ayuda, error, children }: { texto: string; ayuda?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{texto}</span>
      {children}
      {error ? <div className="ayuda mal">{error}</div> : ayuda ? <div className="ayuda">{ayuda}</div> : null}
    </label>
  );
}

/** Filtro desplegable con casillas (selección múltiple). */
export function FiltroMultiple({ texto, opciones, valor, onChange }: {
  texto: string; opciones: { valor: string; texto: string; cantidad?: number }[]; valor: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <details className="relative">
      <summary className={`chip cursor-pointer list-none ${valor.length ? "on" : ""}`}>{texto}{valor.length ? ` (${valor.length})` : ""} ▾</summary>
      <div className="absolute z-10 mt-1 tarjeta p-2 grid gap-1 max-h-72 overflow-auto min-w-60">
        {opciones.map((o) => (
          <label key={o.valor} className="flex gap-2 items-center text-sm px-1">
            <input type="checkbox" checked={valor.includes(o.valor)} onChange={() => onChange(valor.includes(o.valor) ? valor.filter((x) => x !== o.valor) : [...valor, o.valor])} />
            <span className="grow">{o.texto}</span>{o.cantidad != null && <b>{o.cantidad}</b>}
          </label>
        ))}
        {valor.length > 0 && <button className="text-sm underline text-tenue text-left px-1" onClick={() => onChange([])}>Quitar selección</button>}
      </div>
    </details>
  );
}

export function Chips<T extends string>({ opciones, valor, onChange }: { opciones: { valor: T; texto: string; cantidad: number }[]; valor: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const on = valor.includes(o.valor);
        return (
          <button key={o.valor} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? valor.filter((x) => x !== o.valor) : [...valor, o.valor])}>
            {o.texto} <b className="ml-1">{o.cantidad}</b>
          </button>
        );
      })}
    </div>
  );
}
