"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useAhora, useEnVivo } from "@/lib/en-vivo";
import {
  crearArbol, diaHora, ESTADOS, estadoMovil, fechaCorta, hace, hora, minutosVencido, motivoNoApto, NOMBRE_DIRECCION, PROGRAMAS,
  textoMovil, TOLERANCIA_RELEVO_MIN, type Estado, type Movil,
} from "@/lib/agenda";
import type { Datos } from "../agenda/tablero";
import { reclamarDireccion, reclamarMovil, resolverReclamo } from "./acciones";

const LOGO = { ojos_en_alerta: "/img/ojos-en-alerta.png", policial: "/img/policia-cordoba.png" } as const;
const COLUMNAS: Estado[] = ["servicio", "programado", "pendiente", "ocupado", "sin_agendar", "reservado", "fuera"];

export function Panel({ datos, guardia, raiz, reclama, edita }: {
  datos: Datos; guardia: { fecha: string; turno: string }; raiz: string; reclama: boolean; edita: boolean;
}) {
  const arbol = useMemo(() => crearArbol(datos.unidades), [datos.unidades]);
  const ahora = useAhora();
  const enVivo = useEnVivo(["servicio", "dotacion", "fuera_servicio", "reserva", "reclamo", "prestamo", "prestamo_personal", "reporte_frecuencia"], "tablero");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    iniciar(async () => { const r = await fn(); setAviso(r.error ? { ok: false, texto: r.error } : { ok: true, texto: r.ok! }); });

  const abiertos = useMemo(() => new Map(datos.servicios.map((s) => [s.movil, s])), [datos.servicios]);
  const fuera = useMemo(() => new Map(datos.fuera.map((f) => [f.movil, f])), [datos.fuera]);
  const reservas = useMemo(() => new Map(datos.reservas.filter((r) => r.fecha === guardia.fecha && r.turno === guardia.turno).map((r) => [r.movil, r])), [datos.reservas, guardia]);
  const motivos = useMemo(() => new Map(datos.motivos.map((m) => [m.id, m])), [datos.motivos]);
  const turno = datos.turnos.find((t) => t.id === guardia.turno);

  // Cada móvil cuenta para la unidad que lo usa (si está prestado, la que lo recibió)
  const prestamos = new Map(datos.prestamos.map((p) => [p.movil, p]));
  const usa = (m: Movil) => prestamos.get(m.id)?.destino ?? m.unidad;
  const filas = datos.moviles
    .filter((m) => raiz === "G" || arbol.dentro(usa(m), raiz))
    .map((m) => ({ m, e: estadoMovil(m, ahora, abiertos, fuera, reservas), dir: arbol.direccion(usa(m)) }));
  const prestPers = datos.prestamosPersonal.filter((q) => q.fecha === guardia.fecha && q.turno === guardia.turno);
  const prestadaA = new Map(prestPers.map((q) => [q.dni, q]));
  const enDotacion = new Set(datos.servicios.flatMap((s) => s.dotacion.map((d) => d.dni)));
  const direcciones = [...new Set(filas.map((f) => f.dir))].sort((a, b) => (["N", "S", "M"].indexOf(a) + 9) % 9 - (["N", "S", "M"].indexOf(b) + 9) % 9);

  const contar = (l: typeof filas) => {
    const c = Object.fromEntries(COLUMNAS.map((k) => [k, 0])) as Record<Estado, number>;
    l.forEach((f) => c[f.e]++);
    return c;
  };
  const incompleta = (m: Movil) => {
    const s = abiertos.get(m.id);
    if (!s) return null;
    if (!s.dotacion.length) return "Sin dotación";
    if (!s.dotacion.some((d) => d.rol === "chofer")) return "Sin chofer";
    if (s.dotacion.length < 2) return "Sale con 1 integrante";
    return null;
  };

  const automaticos = filas.filter((f) => f.e === "pendiente" && minutosVencido(abiertos.get(f.m.id)!, ahora) >= TOLERANCIA_RELEVO_MIN);
  const visible = (dir: string) => raiz === "G" || dir === raiz || arbol.dentro(dir, raiz) || arbol.dentro(raiz, dir);
  const reclamosAbiertos = datos.reclamos.filter((r) => !r.resuelto_en && visible(r.direccion));
  const resueltos = datos.reclamos.filter((r) => r.resuelto_en && visible(r.direccion));
  const sinAgendar = filas.filter((f) => f.e === "sin_agendar");
  const faltan = filas.filter((f) => ["fuera", "ocupado", "reservado", "pendiente"].includes(f.e));
  const incompletos = filas.map((f) => ({ ...f, prob: incompleta(f.m) })).filter((f) => f.prob);
  const movilPorId = new Map(datos.moviles.map((m) => [m.id, m]));
  const departamentos = datos.unidades.filter((u) => u.tipo === "departamento" && filas.some((f) => arbol.dentro(f.m.unidad, u.id)));

  return (
    <div className="grid gap-5">
      <section className="tarjeta p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tablero en vivo</h1>
          <p className="text-sm text-tenue">
            {turno?.nombre} del {fechaCorta(guardia.fecha)} · {hora(new Date(ahora).toISOString())} Hs
            <span className={`ml-2 etiqueta ${enVivo ? "ok" : ""}`}>{enVivo ? "● En vivo" : "Conectando…"}</span>
          </p>
        </div>
        <Link className="boton" href="/agenda">Ir a la Agenda</Link>
      </section>

      {aviso && <div className={`aviso ${aviso.ok ? "ok" : "mal"} flex justify-between gap-3`}><span>{aviso.texto}</span><button className="text-sm underline" onClick={() => setAviso(null)}>Cerrar</button></div>}

      {/* Reclamos */}
      <section className="tarjeta p-4 grid gap-3">
        <h2 className="font-semibold">Reclamos</h2>
        {automaticos.length > 0 && (
          <div className="aviso atento">
            <b>Automáticos: {automaticos.length} {automaticos.length === 1 ? "móvil lleva" : "móviles llevan"} más de {TOLERANCIA_RELEVO_MIN} minutos con el turno vencido sin relevo.</b>
            <ul className="mt-1 text-sm">
              {automaticos.map(({ m, dir }) => (
                <li key={m.id}>{NOMBRE_DIRECCION[dir] ?? dir} · {arbol.corto(m.unidad)} · {textoMovil(m)}{abiertos.get(m.id)?.designacion ? ` · ${abiertos.get(m.id)!.designacion}` : ""} · venció hace {hace(abiertos.get(m.id)!.fin_previsto, ahora)}</li>
              ))}
            </ul>
          </div>
        )}
        {datos.reportes.filter((r) => !r.resuelto_en && visible(r.direccion ?? "G")).length > 0 && (
          <div className="aviso mal">
            <b>Escuchados en frecuencia sin estar agendados:</b>
            <ul className="mt-1 text-sm">{datos.reportes.filter((r) => !r.resuelto_en && visible(r.direccion ?? "G")).map((r) => {
              const m = r.movil ? movilPorId.get(r.movil) : undefined;
              return <li key={r.id}>{hora(r.creado_en)} Hs · «{r.texto}»{m ? ` · ${textoMovil(m)} · ${NOMBRE_DIRECCION[r.direccion ?? ""] ?? ""}` : " · no figura en la flota"} · hace {hace(r.creado_en, ahora)}</li>;
            })}</ul>
          </div>
        )}
        {reclamosAbiertos.length === 0 && automaticos.length === 0 && <p className="text-sm text-tenue">No hay reclamos pendientes.</p>}
        {reclamosAbiertos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Enviado</th><th>A</th><th>Pedido</th><th>Ahora</th><th></th></tr></thead>
              <tbody>
                {reclamosAbiertos.map((r) => {
                  let ahoraTxt: React.ReactNode;
                  if (r.movil) {
                    const f = filas.find((x) => x.m.id === r.movil);
                    ahoraTxt = f ? <span className={`etiqueta ${ESTADOS[f.e].clase}`}>{ESTADOS[f.e].texto}</span> : "—";
                  } else {
                    const n = sinAgendar.filter((f) => f.dir === r.direccion).length, hechos = (r.total ?? n) - n;
                    ahoraTxt = <><span className={`etiqueta ${n ? "mal" : "ok"}`}>{n ? `Faltan ${n} de ${r.total}` : "Todo agendado"}</span>{hechos > 0 && <span className="block text-[12.5px] text-[var(--ok)]">Ya se agendaron o reservaron {hechos}</span>}</>;
                  }
                  return (
                    <tr key={r.id}>
                      <td className="text-sm">{diaHora(r.creado_en)}<span className="block text-tenue">hace {hace(r.creado_en, ahora)}</span></td>
                      <td>{NOMBRE_DIRECCION[r.direccion] ?? r.direccion}</td>
                      <td className="text-sm">{r.texto}</td>
                      <td>{ahoraTxt}</td>
                      <td>{edita && <button className="boton" disabled={pendiente} onClick={() => correr(() => resolverReclamo(r.id))}>Marcar resuelto</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {resueltos.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">Resueltos en las últimas 24 Hs ({resueltos.length})</summary>
            <ul className="mt-2 grid gap-1 text-sm">
              {resueltos.map((r) => (
                <li key={r.id}>{diaHora(r.resuelto_en!)} · {NOMBRE_DIRECCION[r.direccion] ?? r.direccion} · {r.texto} · <span className={`etiqueta ${r.automatico ? "ok" : "info"}`}>{r.automatico ? "Se resolvió solo" : "Marcado a mano"}</span> · tardó {hace(r.creado_en, Date.parse(r.resuelto_en!))}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Tarjetas por Dirección */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {direcciones.map((d) => {
          const l = filas.filter((f) => f.dir === d), c = contar(l);
          const inc = incompletos.filter((f) => f.dir === d).length;
          // Personal de la Dirección en esta guardia: sin los prestados a otra, más los recibidos
          const pers = datos.personal.filter((p) => { const q = prestadaA.get(p.dni); return arbol.direccion(q ? q.destino : p.unidad) === d; });
          const propios = datos.moviles.filter((m) => arbol.direccion(m.unidad) === d);
          const salen = propios.filter((m) => prestamos.has(m.id) && arbol.direccion(usa(m)) !== d).length;
          const entran = l.filter((f) => arbol.direccion(f.m.unidad) !== d).length;
          const enMovil = pers.filter((p) => enDotacion.has(p.dni)).length;
          const libres = pers.filter((p) => !enDotacion.has(p.dni) && !motivoNoApto(p, guardia.fecha, datos.situaciones)).length;
          const ya = datos.reclamos.some((r) => !r.resuelto_en && !r.movil && r.direccion === d && r.fecha === guardia.fecha && r.turno === guardia.turno);
          return (
            <article key={d} className="tarjeta p-4 grid gap-3">
              <h3 className="font-semibold">{d === "G" ? "Dirección General (sin Dirección asignada)" : d === "SUB" ? "Subdirección General" : `Dirección ${NOMBRE_DIRECCION[d] ?? d}`} <span className="text-tenue font-normal text-sm">· {l.length} móviles</span></h3>
              {(salen > 0 || entran > 0) && <p className="text-[12.5px] text-tenue -mt-2">Propios {propios.length}{salen ? ` · prestados a otra −${salen}` : ""}{entran ? ` · recibidos +${entran}` : ""}</p>}
              <div className={`text-4xl font-bold ${c.sin_agendar ? "text-[var(--bad)]" : "text-[var(--ok)]"}`}>{c.sin_agendar}<span className="text-sm font-normal text-tenue ml-2">sin agendar</span></div>
              <div className="flex flex-wrap gap-1.5">
                {COLUMNAS.filter((k) => k !== "sin_agendar" && c[k]).map((k) => <span key={k} className={`etiqueta ${ESTADOS[k].clase}`}>{ESTADOS[k].texto} {c[k]}</span>)}
                {inc > 0 && <span className="etiqueta atento">Dotación incompleta {inc}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 text-sm">
                <span className="etiqueta ok">Personal apto libre {libres}</span>
                <span className="etiqueta info">En un móvil {enMovil}</span>
              </div>
              {reclama && c.sin_agendar > 0 && (
                <button className="boton peligro" disabled={pendiente || ya} onClick={() => correr(() => reclamarDireccion(d, guardia.fecha, guardia.turno))}>
                  {ya ? "Ya reclamado en esta guardia" : `Reclamar los ${c.sin_agendar} sin agendar`}
                </button>
              )}
            </article>
          );
        })}
      </section>

      {/* Recuento por tipo y por departamento */}
      <section className="tarjeta overflow-x-auto">
        <h2 className="font-semibold px-4 pt-4">Recuento en este momento</h2>
        <table className="tabla mt-2">
          <thead><tr><th></th><th className="text-right">Total</th>{COLUMNAS.map((k) => <th key={k} className="text-right">{ESTADOS[k].texto}</th>)}</tr></thead>
          <tbody>
            {(Object.keys(PROGRAMAS) as (keyof typeof PROGRAMAS)[]).map((p) => {
              const l = filas.filter((f) => f.m.programa === p), c = contar(l);
              return <tr key={p}><td><span className="flex gap-2 items-center"><Image src={LOGO[p]} alt="" width={20} height={20} />{PROGRAMAS[p]}</span></td><td className="text-right">{l.length}</td>{COLUMNAS.map((k) => <td key={k} className="text-right">{c[k] || ""}</td>)}</tr>;
            })}
            {departamentos.map((dp) => {
              const l = filas.filter((f) => arbol.dentro(f.m.unidad, dp.id)), c = contar(l);
              return <tr key={dp.id}><td>{arbol.corto(dp.id)} <span className="text-tenue text-sm">({NOMBRE_DIRECCION[arbol.direccion(dp.id)] ?? ""})</span></td><td className="text-right">{l.length}</td>{COLUMNAS.map((k) => <td key={k} className="text-right">{c[k] || ""}</td>)}</tr>;
            })}
            <tr className="font-semibold"><td>Total</td><td className="text-right">{filas.length}</td>{COLUMNAS.map((k) => <td key={k} className="text-right">{contar(filas)[k] || ""}</td>)}</tr>
          </tbody>
        </table>
      </section>

      {(datos.prestamos.length > 0 || prestPers.length > 0) && (
        <section className="tarjeta overflow-x-auto">
          <h2 className="font-semibold px-4 pt-4">Préstamos activos</h2>
          {datos.prestamos.filter((p) => raiz === "G" || arbol.dentro(p.origen, raiz) || arbol.dentro(p.destino, raiz)).length > 0 && (
            <table className="tabla mt-2">
              <thead><tr><th>Móvil</th><th>De</th><th>A</th><th>Desde</th><th>Con dotación</th></tr></thead>
              <tbody>{datos.prestamos.filter((p) => raiz === "G" || arbol.dentro(p.origen, raiz) || arbol.dentro(p.destino, raiz)).map((p) => {
                const m = datos.moviles.find((x) => x.id === p.movil);
                return <tr key={p.id}><td><b>{m ? textoMovil(m) : "—"}</b></td><td>{arbol.corto(p.origen)} ({NOMBRE_DIRECCION[arbol.direccion(p.origen)]})</td><td>{arbol.corto(p.destino)} ({NOMBRE_DIRECCION[arbol.direccion(p.destino)]})</td><td className="text-sm">{diaHora(p.desde)}</td><td>{p.con_dotacion ? "Sí" : "No"}</td></tr>;
              })}</tbody>
            </table>
          )}
          {prestPers.length > 0 && (
            <table className="tabla mt-2">
              <thead><tr><th>Personal prestado en esta guardia</th><th>De</th><th>A</th></tr></thead>
              <tbody>{prestPers.filter((q) => raiz === "G" || arbol.dentro(q.origen, raiz) || arbol.dentro(q.destino, raiz)).map((q) => {
                const p = datos.personal.find((x) => x.dni === q.dni);
                return <tr key={q.id}><td>{p ? `${p.jerarquia ?? ""} ${p.apellido}, ${p.nombre}`.trim() : q.dni}</td><td>{arbol.corto(q.origen)}</td><td>{arbol.corto(q.destino)}</td></tr>;
              })}</tbody>
            </table>
          )}
        </section>
      )}

      {/* Lo que falta y por qué */}
      <section className="tarjeta overflow-x-auto">
        <h2 className="font-semibold px-4 pt-4">Móviles que faltan y por qué ({faltan.length})</h2>
        {faltan.length ? (
          <table className="tabla mt-2">
            <thead><tr><th>Móvil</th><th>División</th><th>Estado</th><th>Motivo</th><th>Desde</th></tr></thead>
            <tbody>
              {faltan.map(({ m, e }) => {
                const s = abiertos.get(m.id), fs = fuera.get(m.id), rs = reservas.get(m.id);
                const [motivo, desde] = fs ? [`${motivos.get(fs.motivo)?.nombre} (${motivos.get(fs.motivo)?.gravedad})${fs.obs ? " · " + fs.obs : ""}`, fs.desde]
                  : e === "reservado" && rs ? [`${rs.motivo}${rs.obs ? " · " + rs.obs : ""}`, rs.creado_en]
                  : s?.ocupado_motivo ? [`${motivos.get(s.ocupado_motivo)?.nombre}${s.ocupado_obs ? " · " + s.ocupado_obs : ""}`, s.ocupado_desde ?? s.inicio]
                  : s ? [`Turno vencido sin relevo (fin previsto ${diaHora(s.fin_previsto)})`, s.fin_previsto] : ["—", null];
                return (
                  <tr key={m.id}>
                    <td><b>{s?.designacion ? `${s.designacion} · ` : ""}{textoMovil(m)}</b></td>
                    <td>{arbol.corto(m.unidad)}</td>
                    <td><span className={`etiqueta ${ESTADOS[e].clase}`}>{ESTADOS[e].texto}</span></td>
                    <td className="text-sm">{motivo}</td>
                    <td className="text-sm">{desde ? `${diaHora(desde)} · hace ${hace(desde, ahora)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="p-4 text-sm text-tenue">Ningún móvil fuera de servicio, ocupado, reservado ni con el turno vencido.</p>}
      </section>

      {incompletos.length > 0 && (
        <section className="tarjeta overflow-x-auto">
          <h2 className="font-semibold px-4 pt-4">Agendados con dotación incompleta ({incompletos.length})</h2>
          <table className="tabla mt-2">
            <thead><tr><th>Móvil</th><th>División</th><th>Integrantes</th><th>Problema</th></tr></thead>
            <tbody>{incompletos.map(({ m, prob }) => (
              <tr key={m.id}><td><b>{abiertos.get(m.id)?.designacion ? `${abiertos.get(m.id)!.designacion} · ` : ""}{textoMovil(m)}</b></td><td>{arbol.corto(m.unidad)}</td><td>{abiertos.get(m.id)?.dotacion.length}</td><td>{prob}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <section className="tarjeta overflow-x-auto">
        <h2 className="font-semibold px-4 pt-4">Móviles sin agendar ({sinAgendar.length})</h2>
        <p className="px-4 text-sm text-tenue">En condiciones de salir (no están fuera de servicio ni reservados) y sin servicio abierto.</p>
        <table className="tabla mt-2">
          <thead><tr><th>Móvil</th><th>Vehículo</th><th>División</th><th>Dirección</th><th></th></tr></thead>
          <tbody>
            {sinAgendar.sort((a, b) => a.dir.localeCompare(b.dir) || arbol.corto(a.m.unidad).localeCompare(arbol.corto(b.m.unidad), "es", { numeric: true })).slice(0, 300).map(({ m, dir }) => {
              const ya = datos.reclamos.some((r) => !r.resuelto_en && r.movil === m.id);
              return (
                <tr key={m.id}>
                  <td><span className="flex gap-2 items-center"><Image src={LOGO[m.programa]} alt="" width={20} height={20} /><b>{textoMovil(m)}</b></span></td>
                  <td className="text-sm">{[m.marca, m.modelo].filter(Boolean).join(" ")}</td>
                  <td>{arbol.corto(m.unidad)}</td>
                  <td>{NOMBRE_DIRECCION[dir] ?? dir}</td>
                  <td>{reclama && <button className="boton" disabled={pendiente || ya} onClick={() => correr(() => reclamarMovil(m.id, guardia.fecha, guardia.turno))}>{ya ? "Reclamado" : "Reclamar"}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sinAgendar.length > 300 && <p className="p-3 text-sm text-tenue">Se muestran los primeros 300.</p>}
        {movilPorId.size === 0 && <p className="p-4 text-tenue">No hay móviles cargados.</p>}
      </section>
    </div>
  );
}
