"use client";

import { useEffect, useState, useTransition } from "react";
import { diaHora, type Cambio } from "@/lib/agenda";
import { deshacer, historialDe } from "./acciones";

const CAMPOS: Record<string, string> = {
  interno: "interno", dominio: "patente", programa: "tipo", tipo: "vehículo", marca: "marca", modelo: "modelo", unidad: "división",
  apellido: "apellido", nombre: "nombre", tipo_personal: "tipo de personal", jerarquia: "jerarquía", funcion: "función",
  calle: "personal de calle", guardia: "guardia", horario: "horario", activo: "activo", baja_motivo: "motivo de baja", baja_obs: "observación",
};
const valor = (k: string, v: unknown, nombreUnidad: (u: string) => string) =>
  v === null || v === undefined || v === "" ? "—" : k === "unidad" ? nombreUnidad(String(v)) : typeof v === "boolean" ? (v ? "sí" : "no")
    : k === "programa" ? (v === "policial" ? "Policial" : "Ojos en Alerta") : String(v);

export function Historial({ tabla, registro, puedeEditar, nombreUnidad, version, onCambio }: {
  tabla: "movil" | "personal"; registro: string; puedeEditar: boolean; nombreUnidad: (u: string) => string;
  version: number; onCambio: (mensaje: string) => void;
}) {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof historialDe>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    historialDe(tabla, registro).then((d) => vivo && setDatos(d));
    return () => { vivo = false; };
  }, [tabla, registro, version]);

  if (!datos) return <p className="text-sm text-tenue mt-3">Cargando historial…</p>;
  // Solo se deshace el último cambio vigente, de a un paso
  const ultimo = datos.cambios.find((c) => !c.deshecho && c.revierte === null);
  const quien = (u: string | null) => (u && datos.nombres[u]) || "";

  const lineas = [
    ...datos.cambios.map((c) => ({ id: "c" + c.id, fecha: c.creado_en, c })),
    ...datos.operaciones.map((o) => ({ id: "o" + o.id, fecha: o.creado_en, o })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <details className="mt-4" open={lineas.length > 0 && lineas.length <= 4}>
      <summary className="cursor-pointer font-semibold text-sm">Historial ({lineas.length})</summary>
      {error && <div className="aviso mal mt-2">{error}</div>}
      {!lineas.length && <p className="text-sm text-tenue mt-2">Sin movimientos desde que se cargó.</p>}
      <ul className="mt-2 grid gap-2">
        {lineas.map((l) => {
          if ("c" in l && l.c) {
            const c: Cambio = l.c;
            const claves = Object.keys(c.despues).filter((k) => k !== "baja_obs" || c.despues[k]);
            return (
              <li key={l.id} className="paso m-0 flex flex-wrap gap-2 justify-between">
                <span className={c.deshecho ? "line-through opacity-60" : ""}>
                  <b>{c.accion}</b> <span className="text-tenue text-sm">· {diaHora(c.creado_en)}{quien(c.usuario) ? ` · ${quien(c.usuario)}` : ""}</span>
                  {c.accion !== "Alta" && (
                    <span className="block text-sm">
                      {claves.map((k) => `${CAMPOS[k] ?? k}: ${valor(k, c.antes[k], nombreUnidad)} → ${valor(k, c.despues[k], nombreUnidad)}`).join(" · ")}
                    </span>
                  )}
                </span>
                {puedeEditar && ultimo?.id === c.id && c.accion !== "Alta" && (
                  <button className="boton" disabled={pendiente} onClick={() => iniciar(async () => {
                    setError(null);
                    const r = await deshacer(c.id);
                    if (r.error) setError(r.error); else onCambio(r.ok!);
                  })}>Deshacer</button>
                )}
              </li>
            );
          }
          if (!("o" in l)) return null;
          const o = l.o;
          return (
            <li key={l.id} className="text-sm px-1">
              <b>{o.tipo}</b> <span className="text-tenue">· {diaHora(o.creado_en)}{quien(o.usuario) ? ` · ${quien(o.usuario)}` : ""}</span>
              {o.detalle && <span className="block text-tenue">{o.detalle}</span>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
