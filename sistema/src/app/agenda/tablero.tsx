"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useAhora, useEnVivo } from "@/lib/en-vivo";
import {
  coincide, crearArbol, diaHora, hoyCordoba, ESTADOS, estadoMovil, fechaCorta, hora, minutosVencido, nombrePersona, textoMovil,
  TOLERANCIA_RELEVO_MIN, type Designacion, type Estado, type FueraServicio, type Motivo, type Movil, type Persona,
  type Reclamo, type Reserva, type Servicio, type Situacion, type Turno, type Unidad, hace, NOMBRE_DIRECCION,
} from "@/lib/agenda";
import { resolverReclamo } from "../tablero/acciones";
import { Gestion } from "./gestion";

export type Datos = {
  unidades: Unidad[]; turnos: Turno[]; motivos: Motivo[]; moviles: Movil[]; personal: Persona[]; situaciones: Situacion[];
  servicios: Servicio[]; fuera: FueraServicio[]; reservas: Reserva[]; designaciones: Designacion[]; reclamos: Reclamo[];
};

const LOGO = { ojos_en_alerta: "/img/ojos-en-alerta.png", policial: "/img/policia-cordoba.png" } as const;
const DIRECCIONES: Record<string, string> = { N: "Norte", S: "Sur", M: "Monitoreo", SUB: "Subdirección", G: "Dirección General" };

export function Tablero({ datos, guardia, raiz, edita, esCargador }: {
  datos: Datos; guardia: { fecha: string; turno: string }; raiz: string; edita: boolean; esCargador: boolean;
}) {
  const router = useRouter();
  const arbol = useMemo(() => crearArbol(datos.unidades), [datos.unidades]);
  const ahora = useAhora();
  const [filtroEstado, setFiltroEstado] = useState<Estado[]>([]);
  const [filtroDir, setFiltroDir] = useState<string[]>([]);
  const [filtroDiv, setFiltroDiv] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const enVivo = useEnVivo(["servicio", "dotacion", "fuera_servicio", "reserva", "reclamo"], "agenda");
  const [resolviendo, iniciar] = useTransition();
  const reclamosAbiertos = datos.reclamos.filter((r) => !r.resuelto_en && (raiz === "G" || r.direccion === raiz || arbol.dentro(r.direccion, raiz) || arbol.dentro(raiz, r.direccion)));

  const abiertos = useMemo(() => new Map(datos.servicios.map((s) => [s.movil, s])), [datos.servicios]);
  const fuera = useMemo(() => new Map(datos.fuera.map((f) => [f.movil, f])), [datos.fuera]);
  const reservas = useMemo(
    () => new Map(datos.reservas.filter((r) => r.fecha === guardia.fecha && r.turno === guardia.turno).map((r) => [r.movil, r])),
    [datos.reservas, guardia],
  );
  const personas = useMemo(() => new Map(datos.personal.map((p) => [p.dni, p])), [datos.personal]);
  const motivos = useMemo(() => new Map(datos.motivos.map((m) => [m.id, m])), [datos.motivos]);
  const turnos = useMemo(() => new Map(datos.turnos.map((t) => [t.id, t])), [datos.turnos]);

  const visibles = useMemo(() => datos.moviles.filter((m) => raiz === "G" || arbol.dentro(m.unidad, raiz)), [datos.moviles, raiz, arbol]);
  const filas = useMemo(
    () => visibles.map((m) => ({ m, estado: estadoMovil(m, ahora, abiertos, fuera, reservas), dir: arbol.direccion(m.unidad) })),
    [visibles, ahora, abiertos, fuera, reservas, arbol],
  );

  const conteo = (lista: typeof filas) => {
    const c = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, 0])) as Record<Estado, number>;
    lista.forEach((f) => c[f.estado]++);
    return c;
  };
  const enDir = filtroDir.length ? filas.filter((f) => filtroDir.includes(f.dir)) : filas;
  const cuenta = conteo(enDir);
  const reclamados = enDir.filter((f) => f.estado === "pendiente" && minutosVencido(abiertos.get(f.m.id)!, ahora) >= TOLERANCIA_RELEVO_MIN);
  const direcciones = [...new Set(filas.map((f) => f.dir))].sort();
  const divisiones = [...new Set(enDir.map((f) => f.m.unidad))].sort((a, b) => arbol.corto(a).localeCompare(arbol.corto(b), "es", { numeric: true }));

  const lista = enDir
    .filter((f) => !filtroEstado.length || filtroEstado.includes(f.estado))
    .filter((f) => !filtroDiv.length || filtroDiv.includes(f.m.unidad))
    .filter((f) => {
      if (!busqueda.trim()) return true;
      const s = abiertos.get(f.m.id);
      const gente = s?.dotacion.map((d) => { const p = personas.get(d.dni); return p ? nombrePersona(p) + " " + p.dni : d.dni; }).join(" ") ?? "";
      return coincide(`${f.m.interno ?? ""} ${f.m.dominio} ${f.m.marca ?? ""} ${f.m.modelo ?? ""} ${s?.designacion ?? ""} ${gente} ${arbol.corto(f.m.unidad)}`, busqueda);
    })
    .sort((a, b) => ESTADOS[a.estado].orden - ESTADOS[b.estado].orden || (a.m.interno ?? 1e9) - (b.m.interno ?? 1e9));

  const grupos = new Map<string, typeof lista>();
  for (const f of lista) grupos.set(f.m.unidad, [...(grupos.get(f.m.unidad) ?? []), f]);
  const ordenGrupos = [...grupos.keys()].sort((a, b) => arbol.corto(a).localeCompare(arbol.corto(b), "es", { numeric: true }));

  const alternar = <T,>(lista: T[], set: (v: T[]) => void, v: T) => set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  const movilAbierto = abierto ? datos.moviles.find((m) => m.id === abierto) : undefined;
  const turnoActual = turnos.get(guardia.turno);

  return (
    <div className="grid gap-4">
      {/* Guardia */}
      <section className="tarjeta p-4 flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-xl font-semibold">Agenda de la guardia</h1>
          <p className="text-sm text-tenue">
            {turnoActual?.nombre} del {fechaCorta(guardia.fecha)} · {turnoActual ? `${turnoActual.hora_inicio.slice(0, 5)} a ${turnoActual.hora_fin.slice(0, 5)} Hs` : ""}
            <span className={`ml-2 etiqueta ${enVivo ? "ok" : ""}`} title="La pantalla se actualiza sola cuando alguien carga algo">
              {enVivo ? "● En vivo" : "Conectando…"}
            </span>
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); router.push(`/agenda?fecha=${f.get("fecha")}&turno=${f.get("turno")}`); }}>
          <label className="campo"><span>Fecha</span><input className="entrada" type="date" name="fecha" defaultValue={guardia.fecha} key={guardia.fecha} /></label>
          <label className="campo"><span>Turno</span>
            <select className="entrada" name="turno" defaultValue={guardia.turno} key={guardia.turno}>
              {datos.turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <button className="boton" type="submit">Ver guardia</button>
          <button className="boton" type="button" onClick={() => router.push("/agenda")}>Guardia actual</button>
        </form>
      </section>

      {aviso && <div className="aviso ok flex justify-between gap-3"><span>{aviso}</span><button className="text-sm underline" onClick={() => setAviso(null)}>Cerrar</button></div>}

      {reclamosAbiertos.length > 0 && (
        <div className="aviso atento grid gap-2">
          <b>{esCargador ? "Reclamos del General" : "Reclamos abiertos"} ({reclamosAbiertos.length})</b>
          {reclamosAbiertos.map((r) => (
            <div key={r.id} className="flex flex-wrap gap-2 items-center justify-between text-sm">
              <span>{NOMBRE_DIRECCION[r.direccion] ?? r.direccion} · {r.texto} · hace {hace(r.creado_en, ahora)}</span>
              {edita && <button className="boton" disabled={resolviendo} onClick={() => iniciar(async () => { const x = await resolverReclamo(r.id); setAviso(x.error ?? x.ok ?? null); })}>Marcar resuelto</button>}
            </div>
          ))}
          <span className="text-[12.5px]">Se cierran solos cuando se agenda o reserva lo pedido.</span>
        </div>
      )}

      {reclamados.length > 0 && (
        <div className="aviso atento">
          <b>{reclamados.length} {reclamados.length === 1 ? "móvil lleva" : "móviles llevan"} más de {TOLERANCIA_RELEVO_MIN} minutos con el turno vencido y sin relevo.</b>{" "}
          {esCargador ? "Relevalos, cerralos o marcá que siguen ocupados." : "Se le reclama al cargador de cada Dirección."}{" "}
          <button className="underline" onClick={() => setFiltroEstado(["pendiente"])}>Ver cuáles</button>
        </div>
      )}

      {/* Resumen y filtros (selección múltiple: dentro de un filtro se suman, entre filtros se combinan) */}
      <section className="tarjeta p-4 grid gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ESTADOS) as Estado[]).sort((a, b) => ESTADOS[a].orden - ESTADOS[b].orden).map((e) => (
            <button key={e} type="button" className={`chip ${filtroEstado.includes(e) ? "on" : ""}`} aria-pressed={filtroEstado.includes(e)} onClick={() => alternar(filtroEstado, setFiltroEstado, e)}>
              {ESTADOS[e].texto} <b className="ml-1">{cuenta[e]}</b>
            </button>
          ))}
        </div>
        {raiz === "G" && direcciones.length > 1 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[13px] text-tenue mr-1">Dirección</span>
            {direcciones.map((d) => (
              <button key={d} type="button" className={`chip ${filtroDir.includes(d) ? "on" : ""}`} onClick={() => alternar(filtroDir, setFiltroDir, d)}>
                {DIRECCIONES[d] ?? d} <b className="ml-1">{filas.filter((f) => f.dir === d).length}</b>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          <input className="entrada max-w-sm" type="search" placeholder="Búsqueda rápida: interno, dominio, designación o persona" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <details className="relative">
            <summary className="chip cursor-pointer list-none">División{filtroDiv.length ? ` (${filtroDiv.length})` : ""} ▾</summary>
            <div className="absolute z-10 mt-1 tarjeta p-2 grid gap-1 max-h-72 overflow-auto min-w-56">
              {divisiones.map((u) => (
                <label key={u} className="flex gap-2 items-center text-sm px-1">
                  <input type="checkbox" checked={filtroDiv.includes(u)} onChange={() => alternar(filtroDiv, setFiltroDiv, u)} />
                  {arbol.corto(u)}
                </label>
              ))}
            </div>
          </details>
          {(filtroEstado.length || filtroDiv.length || filtroDir.length || busqueda) ? (
            <button className="text-sm underline text-tenue" onClick={() => { setFiltroEstado([]); setFiltroDiv([]); setFiltroDir([]); setBusqueda(""); }}>Limpiar filtros</button>
          ) : null}
          <span className="text-sm text-tenue ml-auto">{lista.length} de {enDir.length} móviles</span>
        </div>
      </section>

      {/* Lista por división */}
      {ordenGrupos.length === 0 && <div className="tarjeta p-6 text-tenue">No hay móviles con esos filtros.</div>}
      {ordenGrupos.map((u) => (
        <section key={u} className="tarjeta overflow-hidden">
          <h2 className="px-4 py-2 text-sm font-semibold border-b border-linea bg-[var(--panel-2)]">{arbol.corto(u)} <span className="text-tenue font-normal">· {grupos.get(u)!.length}</span></h2>
          <ul>
            {grupos.get(u)!.map(({ m, estado }) => {
              const s = abiertos.get(m.id), fs = fuera.get(m.id), rs = reservas.get(m.id);
              const vencido = s && estado === "pendiente" ? minutosVencido(s, ahora) : 0;
              return (
                <li key={m.id} className="fila-movil">
                  <button type="button" className="w-full text-left px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 items-center" onClick={() => setAbierto(m.id)}>
                    <Image src={LOGO[m.programa]} alt={m.programa === "policial" ? "Policial" : "Ojos en Alerta"} width={28} height={28} className="shrink-0" />
                    <span className="min-w-40">
                      <b>{textoMovil(m)}</b>
                      <span className="block text-[12.5px] text-tenue">{[m.marca, m.modelo].filter(Boolean).join(" ")}</span>
                    </span>
                    <span className={`etiqueta ${ESTADOS[estado].clase}`}>
                      {ESTADOS[estado].texto}{vencido ? ` · hace ${vencido >= 60 ? Math.floor(vencido / 60) + " h " : ""}${vencido % 60} min` : ""}
                    </span>
                    {m.revisar && <span className="etiqueta atento" title={m.revisar}>Dato a corregir</span>}
                    <span className="text-sm grow">
                      {s && <>
                        {s.designacion && <b className="mr-2">{s.designacion}</b>}
                        <span className="text-tenue">{hora(s.inicio)} a {hoyCordoba(new Date(s.fin_previsto)) === hoyCordoba(new Date(s.inicio)) ? hora(s.fin_previsto) + " Hs" : diaHora(s.fin_previsto)}</span>
                        {s.ocupado_motivo && <span className="text-tenue"> · {motivos.get(s.ocupado_motivo)?.nombre}</span>}
                        <span className="block">{s.dotacion.map((d) => { const p = personas.get(d.dni); return p ? `${p.jerarquia ?? ""} ${p.apellido}`.trim() : d.dni; }).join(" · ")}</span>
                      </>}
                      {fs && <span className="text-tenue">{motivos.get(fs.motivo)?.nombre} · desde {diaHora(fs.desde)}</span>}
                      {rs && !s && <span className="text-tenue">{rs.motivo}{rs.obs ? ` · ${rs.obs}` : ""}</span>}
                    </span>
                    <span className="text-sm text-acento">{edita ? "Gestionar ›" : "Ver ›"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {movilAbierto && (
        <Gestion
          key={movilAbierto.id}
          movil={movilAbierto}
          estado={estadoMovil(movilAbierto, ahora, abiertos, fuera, reservas)}
          servicio={abiertos.get(movilAbierto.id)}
          fuera={fuera.get(movilAbierto.id)}
          reserva={reservas.get(movilAbierto.id)}
          datos={datos}
          guardia={guardia}
          arbol={arbol}
          edita={edita && (raiz === "G" || arbol.dentro(movilAbierto.unidad, raiz))}
          abiertos={abiertos}
          ahora={ahora}
          onCerrar={(msg) => { setAbierto(null); if (msg) setAviso(msg); }}
        />
      )}
    </div>
  );
}
