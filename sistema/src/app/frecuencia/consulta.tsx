"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useAhora, useEnVivo } from "@/lib/en-vivo";
import {
  crearArbol, diaHora, ESTADOS, estadoMovil, hace, hora, NOMBRE_DIRECCION, ROLES_DOTACION, textoMovil,
} from "@/lib/agenda";
import type { Datos } from "../agenda/tablero";
import { consultarFrecuencia, resolverReporte, type Respuesta } from "./acciones";

const LOGO = { ojos_en_alerta: "/img/ojos-en-alerta.png", policial: "/img/policia-cordoba.png" } as const;
export function Consulta({ datos, guardia, puedeResolver, raiz }: {
  datos: Datos; guardia: { fecha: string; turno: string }; puedeResolver: boolean; raiz: string;
}) {
  const arbol = useMemo(() => crearArbol(datos.unidades), [datos.unidades]);
  const ahora = useAhora();
  const enVivo = useEnVivo(["servicio", "dotacion", "fuera_servicio", "reporte_frecuencia", "prestamo"], "frecuencia");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<(Respuesta & { cuando: string; consulta: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const abiertos = useMemo(() => new Map(datos.servicios.map((s) => [s.movil, s])), [datos.servicios]);
  const fuera = useMemo(() => new Map(datos.fuera.map((f) => [f.movil, f])), [datos.fuera]);
  const reservas = useMemo(() => new Map(datos.reservas.filter((r) => r.fecha === guardia.fecha && r.turno === guardia.turno).map((r) => [r.movil, r])), [datos.reservas, guardia]);
  const movil = (id: string) => datos.moviles.find((m) => m.id === id)!;

  const consultar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const consulta = q;
    iniciar(async () => {
      const r = await consultarFrecuencia(consulta);
      if (r.tipo === "error") { setError(r.error); return; }
      setRes({ ...r, cuando: hora(new Date().toISOString()), consulta });
    });
  };

  const visible = (dir: string | null) => raiz === "G" || !dir || dir === raiz || arbol.dentro(dir, raiz) || arbol.dentro(raiz, dir);
  const abiertosRep = datos.reportes.filter((r) => !r.resuelto_en && visible(r.direccion));
  const resueltos = datos.reportes.filter((r) => r.resuelto_en && visible(r.direccion));

  return (
    <div className="grid gap-5">
      <section className="tarjeta p-4 grid gap-3">
        <div className="flex flex-wrap justify-between gap-2 items-start">
          <div>
            <h1 className="text-xl font-semibold">Móvil escuchado en frecuencia</h1>
            <p className="text-sm text-tenue">Escribí la designación, el interno o la patente que se escuchó. La app dice si está agendado; si no, deja un aviso para su Dirección.</p>
          </div>
          <span className={`etiqueta ${enVivo ? "ok" : ""}`}>{enVivo ? "● En vivo" : "Conectando…"}</span>
        </div>
        <form className="flex flex-wrap gap-2" onSubmit={consultar}>
          <input className="entrada max-w-md uppercase text-lg" value={q} onChange={(e) => setQ(e.target.value)} placeholder="URCA 10, 361 o AG247UZ" autoFocus autoComplete="off" />
          <button className="boton primario" disabled={pendiente}>{pendiente ? "Consultando…" : "Verificar"}</button>
        </form>
        {error && <div className="aviso mal">{error}</div>}
        {res && <Tarjeta r={res} arbol={arbol} onCerrar={() => setRes(null)} />}
      </section>

      <section className="tarjeta p-4 grid gap-3">
        <h2 className="font-semibold">Reportes abiertos ({abiertosRep.length})</h2>
        {!abiertosRep.length && <p className="text-sm text-tenue">No hay reportes pendientes.</p>}
        {abiertosRep.length > 0 && (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Hora</th><th>Se escuchó</th><th>Móvil</th><th>Dirección</th><th>Ahora</th><th></th></tr></thead>
              <tbody>{abiertosRep.map((r) => {
                const m = r.movil ? movil(r.movil) : null;
                const e = m ? estadoMovil(m, ahora, abiertos, fuera, reservas) : null;
                return (
                  <tr key={r.id}>
                    <td className="text-sm">{hora(r.creado_en)} Hs<span className="block text-tenue">hace {hace(r.creado_en, ahora)}</span></td>
                    <td><b>{r.texto}</b></td>
                    <td>{m ? textoMovil(m) : <span className="etiqueta mal">No figura en la flota</span>}</td>
                    <td>{r.direccion ? NOMBRE_DIRECCION[r.direccion] ?? r.direccion : "—"}</td>
                    <td>{e ? <span className={`etiqueta ${ESTADOS[e].clase}`}>{ESTADOS[e].texto}</span> : "—"}</td>
                    <td>{puedeResolver && <button className="boton" disabled={pendiente} onClick={() => iniciar(async () => { const x = await resolverReporte(r.id); if (x.error) setError(x.error); })}>Resolver</button>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        {resueltos.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">Resueltos en las últimas 24 Hs ({resueltos.length})</summary>
            <ul className="mt-2 grid gap-1 text-sm">{resueltos.map((r) => (
              <li key={r.id}>{diaHora(r.resuelto_en!)} · {r.texto}{r.movil ? ` · ${textoMovil(movil(r.movil))}` : ""} · <span className={`etiqueta ${r.automatico ? "ok" : "info"}`}>{r.automatico ? "Se agendó" : "Resuelto a mano"}</span></li>
            ))}</ul>
          </details>
        )}
      </section>
    </div>
  );
}

function Tarjeta({ r, arbol, onCerrar }: { r: Respuesta & { cuando: string; consulta: string }; arbol: ReturnType<typeof crearArbol>; onCerrar: () => void }) {
  if (r.tipo === "vacio" || r.tipo === "error") return <div className="aviso atento">Escribí la designación, el interno o la patente.</div>;
  if (r.tipo === "varios") return (
    <div className="aviso atento">¿Cuál de estas quisiste decir? <b>{r.opciones.join(" · ")}</b>. Escribila completa y volvé a verificar. No se creó ningún aviso.</div>
  );
  const ok = r.tipo === "agendado";
  const estilo = ok ? "border-[var(--ok)] bg-[var(--ok-bg)]" : "border-[var(--bad)] bg-[var(--bad-bg)]";
  const dir = (u: string) => NOMBRE_DIRECCION[arbol.direccion(u)] ?? "";
  return (
    <div role="status" className={`rounded-xl border-2 p-4 flex gap-4 items-start ${estilo}`}>
      <div className={`text-3xl font-bold leading-none ${ok ? "text-[var(--ok)]" : "text-[var(--bad)]"}`} aria-hidden>{ok ? "✓" : "✕"}</div>
      <div className="grow grid gap-1">
        <div className={`text-lg font-semibold ${ok ? "text-[var(--ok)]" : "text-[var(--bad)]"}`}>
          {r.tipo === "agendado" ? (r.previa ? "Está agendado con otra designación" : r.ocupado ? "Está agendado (sigue ocupado en un procedimiento)" : "Está agendado")
            : r.tipo === "no_agendado" ? (r.fuera ? "Figura fuera de servicio" : "No está agendado")
            : "No figura en la flota ni en la agenda"}
          <span className="ml-2 font-mono text-texto">{r.consulta.toUpperCase()}</span>
        </div>
        {r.tipo === "agendado" && <>
          {r.parecido && <div className="text-[var(--warn)]">Se tomó como <b>{r.parecido}</b> (escrito parecido). Revisá que sea esa.</div>}
          {r.previa && <div>{r.previa} ahora opera como <b>{r.designacion}</b></div>}
          <div className="flex gap-2 items-center"><Image src={LOGO[r.programa]} alt="" width={22} height={22} /><b>{r.designacion ?? "Sin designación"}</b> · {r.movil}</div>
          <div>{arbol.corto(r.unidad)} · Dirección {dir(r.unidad)}</div>
          <div>Turno de {hora(r.inicio)} a {hora(r.fin)} Hs · {r.dotacion.length} integrante(s)</div>
          <div className="text-sm text-tenue">{r.dotacion.map((d) => `${ROLES_DOTACION[d.rol as keyof typeof ROLES_DOTACION] ?? d.rol}: ${d.nombre}`).join(" · ")}</div>
        </>}
        {r.tipo === "no_agendado" && <>
          <div className="flex gap-2 items-center"><Image src={LOGO[r.programa]} alt="" width={22} height={22} /><b>{r.movil}</b> · {r.vehiculo}</div>
          <div>{arbol.corto(r.unidad)} · Dirección {dir(r.unidad)}</div>
          <div className="text-sm">{r.nuevo ? "Se creó un aviso para su Dirección." : "Ya había un aviso abierto para este móvil."}</div>
        </>}
        {r.tipo === "desconocido" && <>
          <div>Revisá cómo se escuchó: <b>{r.texto}</b></div>
          <div className="text-sm">{r.nuevo ? "Quedó un aviso para revisarlo." : "Ya había un aviso abierto con ese texto."}</div>
        </>}
        <div className="flex justify-between items-center mt-1 text-sm text-tenue">
          <span>Consultado a las {r.cuando} Hs</span>
          <button className="boton" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
