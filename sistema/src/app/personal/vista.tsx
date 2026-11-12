"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Dialogo } from "@/components/dialogo";
import {
  casiIgual, coincide, compacto, crearArbol, diaHora, fechaCorta, hoyCordoba, motivoNoApto, MOTIVOS_BAJA_PERSONA, nombrePersona,
  TIPOS_SITUACION, type Persona, type PrestamoPersona, type Turno, type Unidad, guardiaActual,
} from "@/lib/agenda";
import { jerarquiasDe, llevaJerarquia, TIPOS_PERSONAL, type TipoPersonal } from "@/lib/reglas";
import {
  bajaPersona, cargarSituacion, guardarPersona, notasDe, prestarPersona, quitarPrestamoPersona, quitarSituacion, reincorporarPersona, terminarSituacion, type DatosPersona,
} from "../datos/acciones";
import { Campo, Chips, FiltroMultiple, SelectorUnidad } from "../datos/campos";
import { Historial } from "../datos/historial";
import { FormBaja } from "../moviles/vista";

export type FichaPersona = Persona & {
  funcion: string | null; guardia: string | null; horario: string | null; revista: string | null;
  baja_motivo: string | null; baja_fecha: string | null; baja_obs: string | null;
};
export type SituacionFicha = { id: number; dni: string; tipo: string; detalle: string | null; desde: string; hasta: string | null; origen: string };
type Arbol = ReturnType<typeof crearArbol>;
type Aptitud = "apto" | "no_apto" | "en_movil" | "baja";

export function VistaPersonal({ unidades, personal, situaciones, enMovil, raiz, raizEdita, prestamos, turnos, esGeneral }: {
  unidades: Unidad[]; personal: FichaPersona[]; situaciones: SituacionFicha[]; enMovil: Record<string, string>; raiz: string; raizEdita: string | null;
  prestamos: PrestamoPersona[]; turnos: Turno[]; esGeneral: boolean;
}) {
  const arbol = useMemo(() => crearArbol(unidades), [unidades]);
  const hoy = hoyCordoba();
  const [fApt, setFApt] = useState<Aptitud[]>([]);
  const [fTipo, setFTipo] = useState<string[]>([]);
  const [fCalle, setFCalle] = useState<("si" | "no")[]>([]);
  const [fDiv, setFDiv] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState<string | "nueva" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const puedeEditar = (u: string) => !!raizEdita && (raizEdita === "G" || arbol.dentro(u, raizEdita));
  const visibles = useMemo(() => personal.filter((p) => raiz === "G" || arbol.dentro(p.unidad, raiz)), [personal, raiz, arbol]);
  const aptitud = useMemo(() => {
    const m = new Map<string, { a: Aptitud; motivo: string | null }>();
    for (const p of visibles) {
      if (!p.activo) { m.set(p.dni, { a: "baja", motivo: p.baja_motivo }); continue; }
      if (enMovil[p.dni]) { m.set(p.dni, { a: "en_movil", motivo: enMovil[p.dni] }); continue; }
      const mot = motivoNoApto(p, hoy, situaciones);
      m.set(p.dni, { a: mot ? "no_apto" : "apto", motivo: mot });
    }
    return m;
  }, [visibles, enMovil, situaciones, hoy]);

  const cuenta = (f: (p: FichaPersona) => boolean) => visibles.filter(f).length;
  const lista = visibles
    .filter((p) => !fApt.length || fApt.includes(aptitud.get(p.dni)!.a))
    .filter((p) => !fTipo.length || fTipo.includes(p.tipo_personal))
    .filter((p) => !fCalle.length || fCalle.includes(p.calle ? "si" : "no"))
    .filter((p) => !fDiv.length || fDiv.includes(p.unidad))
    .filter((p) => !q.trim() || coincide(`${p.apellido} ${p.nombre} ${p.dni} ${p.jerarquia ?? ""} ${p.funcion ?? ""}`, q));
  const divisiones = [...new Set(visibles.map((p) => p.unidad))].sort((a, b) => arbol.corto(a).localeCompare(arbol.corto(b), "es", { numeric: true }));
  const elegida = abierto && abierto !== "nueva" ? personal.find((p) => p.dni === abierto) : undefined;
  const ETQ: Record<Aptitud, [string, string]> = { apto: ["ok", "Apto"], no_apto: ["mal", "No apto"], en_movil: ["info", "En un móvil"], baja: ["", "Dado de baja"] };

  return (
    <div className="grid gap-4">
      <section className="tarjeta p-4 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Personal</h1>
          <p className="text-sm text-tenue">Altas, pases, bajas y situaciones (TNO, licencias, suspensiones). Todo queda en el historial.</p>
        </div>
        {raizEdita && <button className="boton primario" onClick={() => setAbierto("nueva")}>Agregar persona</button>}
      </section>

      {aviso && <div className="aviso ok flex justify-between gap-3"><span>{aviso}</span><button className="text-sm underline" onClick={() => setAviso(null)}>Cerrar</button></div>}

      <section className="tarjeta p-4 grid gap-3">
        <Chips valor={fApt} onChange={setFApt} opciones={(["apto", "no_apto", "en_movil", "baja"] as Aptitud[]).map((a) => ({ valor: a, texto: ETQ[a][1] + (a === "apto" || a === "no_apto" ? " hoy" : ""), cantidad: cuenta((p) => aptitud.get(p.dni)!.a === a) }))} />
        <div className="flex flex-wrap gap-2 items-center">
          <input className="entrada max-w-sm" type="search" placeholder="Búsqueda rápida: apellido, nombre, DNI o jerarquía" value={q} onChange={(e) => setQ(e.target.value)} />
          <FiltroMultiple texto="Tipo de personal" valor={fTipo} onChange={setFTipo}
            opciones={Object.entries(TIPOS_PERSONAL).map(([k, v]) => ({ valor: k, texto: v, cantidad: cuenta((p) => p.tipo_personal === k) }))} />
          <FiltroMultiple texto="Personal de calle" valor={fCalle} onChange={(v) => setFCalle(v as typeof fCalle)}
            opciones={[{ valor: "si", texto: "Sí", cantidad: cuenta((p) => p.calle) }, { valor: "no", texto: "No", cantidad: cuenta((p) => !p.calle) }]} />
          <FiltroMultiple texto="División" valor={fDiv} onChange={setFDiv}
            opciones={divisiones.map((u) => ({ valor: u, texto: arbol.corto(u), cantidad: cuenta((p) => p.unidad === u) }))} />
          {(fApt.length || fTipo.length || fCalle.length || fDiv.length || q) ? (
            <button className="text-sm underline text-tenue" onClick={() => { setFApt([]); setFTipo([]); setFCalle([]); setFDiv([]); setQ(""); }}>Limpiar filtros</button>
          ) : null}
          <span className="text-sm text-tenue ml-auto">{lista.length} personas</span>
        </div>
      </section>

      <section className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>Persona</th><th>DNI</th><th>División</th><th>Guardia</th><th>Estado hoy</th></tr></thead>
          <tbody>
            {lista.slice(0, 300).map((p) => {
              const ap = aptitud.get(p.dni)!;
              return (
                <tr key={p.dni} className="cursor-pointer hover:bg-[var(--panel-2)]" onClick={() => setAbierto(p.dni)}>
                  <td><b>{nombrePersona(p)}</b><span className="block text-[12.5px] text-tenue">{TIPOS_PERSONAL[p.tipo_personal as TipoPersonal]}{p.calle ? " · de calle" : ""}{p.funcion ? ` · ${p.funcion}` : ""}</span></td>
                  <td>{p.dni}</td>
                  <td>{arbol.corto(p.unidad)}</td>
                  <td className="text-sm">{[p.guardia, p.horario].filter(Boolean).join(" · ")}</td>
                  <td><span className={`etiqueta ${ETQ[ap.a][0]}`}>{ETQ[ap.a][1]}</span>{ap.motivo && <span className="block text-[12.5px] text-tenue">{ap.motivo}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length > 300 && <p className="p-3 text-sm text-tenue">Se muestran las primeras 300. Usá la búsqueda o los filtros.</p>}
        {!lista.length && <p className="p-4 text-tenue">No hay personas con esos filtros.</p>}
      </section>

      {abierto === "nueva" && raizEdita && (
        <Dialogo titulo="Agregar persona" onCerrar={() => setAbierto(null)}>
          <FormPersona arbol={arbol} unidades={unidades} raizEdita={raizEdita} personal={personal} onListo={(msg) => { setAbierto(null); setAviso(msg); }} />
        </Dialogo>
      )}
      {elegida && (
        <Ficha key={elegida.dni} p={elegida} arbol={arbol} unidades={unidades} personal={personal} raizEdita={raizEdita}
          editable={puedeEditar(elegida.unidad)} situaciones={situaciones.filter((s) => s.dni === elegida.dni)}
          enMovil={enMovil[elegida.dni]} motivo={motivoNoApto(elegida, hoy, situaciones)}
          prestamos={prestamos.filter((q) => q.dni === elegida.dni)} turnos={turnos} esGeneral={esGeneral}
          onCerrar={() => setAbierto(null)} onAviso={setAviso} />
      )}
    </div>
  );
}

const estadoSit = (s: SituacionFicha, hoy: string) => (s.desde > hoy ? "prox" : s.hasta && s.hasta < hoy ? "fin" : "vig");
const SITB = { vig: ["mal", "Vigente"], prox: ["info", "Próxima"], fin: ["", "Terminada"] } as const;

function Ficha({ p, arbol, unidades, personal, raizEdita, editable, situaciones, enMovil, motivo, prestamos, turnos, esGeneral, onCerrar, onAviso }: {
  p: FichaPersona; arbol: Arbol; unidades: Unidad[]; personal: FichaPersona[]; raizEdita: string | null; editable: boolean;
  situaciones: SituacionFicha[]; enMovil?: string; motivo: string | null; prestamos: PrestamoPersona[]; turnos: Turno[]; esGeneral: boolean;
  onCerrar: () => void; onAviso: (s: string) => void;
}) {
  const [modo, setModo] = useState<"ver" | "editar" | "baja" | "situacion" | "prestar">("ver");
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [pendiente, iniciar] = useTransition();
  const hoy = hoyCordoba();
  const listo = (msg: string) => { onAviso(msg); setVersion((v) => v + 1); setModo("ver"); };
  const correr = (fn: () => Promise<{ ok?: string; error?: string }>) => iniciar(async () => { setError(null); const r = await fn(); if (r.error) setError(r.error); else listo(r.ok!); });
  const ids = situaciones.map((s) => s.id).join(",");
  useEffect(() => {
    if (!editable || !ids) return;
    let vivo = true;
    notasDe(ids.split(",").map(Number)).then((n) => vivo && setNotas(n));
    return () => { vivo = false; };
  }, [editable, ids]);

  return (
    <Dialogo titulo={nombrePersona(p)} subtitulo={`DNI ${p.dni} · ${TIPOS_PERSONAL[p.tipo_personal as TipoPersonal]} · ${arbol.porId.get(p.unidad)?.nombre}`} onCerrar={onCerrar}>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        {!p.activo ? <span className="etiqueta">Dado de baja</span> : enMovil ? <span className="etiqueta info">En un móvil · {enMovil}</span>
          : motivo ? <span className="etiqueta mal">No apto hoy · {motivo}</span> : <span className="etiqueta ok">Apto hoy</span>}
      </div>
      <dl className="paso grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
        <dt className="text-tenue">Función</dt><dd>{p.funcion ?? "—"}</dd>
        <dt className="text-tenue">Personal de calle</dt><dd>{p.calle ? "Sí" : "No"}</dd>
        <dt className="text-tenue">Guardia y horario</dt><dd>{[p.guardia, p.horario].filter(Boolean).join(" · ") || "—"}</dd>
        {p.revista && <><dt className="text-tenue">Situación de revista</dt><dd>{p.revista}</dd></>}
      </dl>
      {!p.activo && <div className="paso">Baja: <b>{p.baja_motivo}</b>{p.baja_fecha ? ` · ${diaHora(p.baja_fecha)}` : ""}{p.baja_obs ? ` · ${p.baja_obs}` : ""}. Se puede reincorporar.</div>}
      {error && <div className="aviso mal mt-3">{error}</div>}

      <div className="mt-4">
        <h3 className="font-semibold text-sm">Situación</h3>
        {!situaciones.length && <p className="text-sm text-tenue mt-1">Sin licencias, TNO ni suspensiones cargadas.</p>}
        <ul className="grid gap-2 mt-2">
          {situaciones.map((s) => {
            const e = estadoSit(s, hoy);
            return (
              <li key={s.id} className="paso m-0 flex flex-wrap gap-2 items-center justify-between">
                <span>
                  <b>{s.tipo}</b>{s.detalle ? ` · ${s.detalle}` : ""} <span className={`etiqueta ${SITB[e][0]}`}>{SITB[e][1]}</span>
                  <span className="block text-sm text-tenue">{fechaCorta(s.desde)}/{s.desde.slice(0, 4)} a {s.hasta ? `${fechaCorta(s.hasta)}/${s.hasta.slice(0, 4)}` : "sin fecha de fin"}{s.origen === "importacion" ? " · de la nómina" : ""}{notas[s.id] ? ` · ${notas[s.id]}` : ""}</span>
                </span>
                {editable && e !== "fin" && (
                  <span className="flex gap-2">
                    {e === "vig" && <button className="boton" disabled={pendiente} onClick={() => correr(() => terminarSituacion(s.id))}>Terminar hoy</button>}
                    <button className="boton" disabled={pendiente} onClick={() => correr(() => quitarSituacion(s.id))}>Quitar</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {prestamos.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-sm">Préstamos</h3>
          <ul className="grid gap-2 mt-2">{prestamos.map((q) => (
            <li key={q.id} className="paso m-0 flex flex-wrap gap-2 items-center justify-between">
              <span>A <b>{arbol.porId.get(q.destino)?.nombre}</b> · {turnos.find((t) => t.id === q.turno)?.nombre} del {fechaCorta(q.fecha)}{q.obs ? ` · ${q.obs}` : ""}</span>
              {editable && <button className="boton" disabled={pendiente} onClick={() => correr(() => quitarPrestamoPersona(q.id))}>Anular</button>}
            </li>
          ))}</ul>
        </div>
      )}

      {editable && modo === "ver" && (
        <div className="flex flex-wrap gap-2 mt-4">
          {p.activo && <button className="boton primario" onClick={() => setModo("situacion")}>Cargar licencia, TNO o suspensión</button>}
          {p.activo && <button className="boton" onClick={() => setModo("editar")}>Editar datos o cargar un pase</button>}
          {p.activo && <button className="boton" onClick={() => setModo("prestar")}>Prestar para una guardia</button>}
          {p.activo && <button className="boton peligro" onClick={() => setModo("baja")}>Dar de baja</button>}
          {!p.activo && <button className="boton primario" disabled={pendiente} onClick={() => correr(() => reincorporarPersona(p.dni))}>Reincorporar</button>}
        </div>
      )}
      {modo === "situacion" && (
        <FormSituacion dni={p.dni} enMovil={enMovil} pendiente={pendiente} onVolver={() => setModo("ver")}
          onEnviar={(t, d, h, o) => correr(() => cargarSituacion(p.dni, t, d, h, o))} />
      )}
      {modo === "prestar" && (
        <FormPrestarPersona arbol={arbol} unidades={unidades} turnos={turnos} raiz={esGeneral ? "G" : arbol.direccion(p.unidad)} origen={p.unidad}
          pendiente={pendiente} onVolver={() => setModo("ver")}
          onEnviar={(d, f, t, o) => correr(() => prestarPersona(p.dni, d, f, t, o))} />
      )}
      {modo === "editar" && raizEdita && (
        <div className="mt-4"><FormPersona p={p} arbol={arbol} unidades={unidades} raizEdita={raizEdita} personal={personal} onListo={listo} onVolver={() => setModo("ver")} /></div>
      )}
      {modo === "baja" && (
        <FormBaja motivos={MOTIVOS_BAJA_PERSONA} aviso={enMovil ? `Está en ${enMovil}: al darlo de baja, sale de ese móvil.` : undefined}
          pendiente={pendiente} onVolver={() => setModo("ver")} onEnviar={(m, o) => correr(() => bajaPersona(p.dni, m, o))} />
      )}
      {!editable && <p className="text-sm text-tenue mt-4">Podés ver a esta persona, pero no editarla.</p>}
      <Historial tabla="personal" registro={p.dni} puedeEditar={editable} nombreUnidad={(u) => arbol.corto(u)} version={version} onCambio={listo} />
    </Dialogo>
  );
}

function FormSituacion({ enMovil, pendiente, onEnviar, onVolver }: {
  dni: string; enMovil?: string; pendiente: boolean; onEnviar: (tipo: string, desde: string, hasta: string, obs: string) => void; onVolver: () => void;
}) {
  const hoy = hoyCordoba();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState("");
  const malas = hasta && hasta < desde;
  const vigente = desde <= hoy && (!hasta || hasta >= hoy);
  return (
    <form className="grid gap-3 mt-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (!malas) onEnviar(String(f.get("tipo")), desde, hasta, String(f.get("obs") ?? "")); }}>
      <Campo texto="Tipo"><select className="entrada" name="tipo">{TIPOS_SITUACION.map((t) => <option key={t}>{t}</option>)}</select></Campo>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Campo texto="Desde"><input className="entrada" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required /></Campo>
        <Campo texto="Hasta" ayuda="Si todavía no tiene fecha de fin, dejalo vacío." error={malas ? "Es anterior a la fecha de inicio." : null}>
          <input className="entrada" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Campo>
      </div>
      <Campo texto="Observación (opcional)" ayuda="Sin datos médicos. Solo la ve quien puede editar a esta persona."><input className="entrada" name="obs" maxLength={200} /></Campo>
      {enMovil && vigente && <div className="aviso atento">Está en {enMovil}: al guardar, sale de ese móvil y queda registrado.</div>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="boton" onClick={onVolver}>Volver</button>
        <button type="submit" className="boton primario" disabled={pendiente || !!malas}>{pendiente ? "Guardando…" : "Guardar situación"}</button>
      </div>
    </form>
  );
}

function FormPersona({ p, arbol, unidades, raizEdita, personal, onListo, onVolver }: {
  p?: FichaPersona; arbol: Arbol; unidades: Unidad[]; raizEdita: string; personal: FichaPersona[]; onListo: (msg: string) => void; onVolver?: () => void;
}) {
  const [dni, setDni] = useState(p?.dni ?? "");
  const [d, setD] = useState<DatosPersona>({
    apellido: p?.apellido ?? "", nombre: p?.nombre ?? "", tipo_personal: p?.tipo_personal ?? "", jerarquia: p?.jerarquia ?? "",
    unidad: p?.unidad ?? "", funcion: p?.funcion ?? "", calle: p?.calle ?? true, guardia: p?.guardia ?? "", horario: p?.horario ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = <K extends keyof DatosPersona>(k: K, v: DatosPersona[K]) => setD({ ...d, [k]: v });

  // Repetidos: el DNI exacto bloquea (también contra bajas); nombre parecido o DNI casi igual solo avisan (hay homónimos)
  const nDni = dni.replace(/\D/g, "");
  const ya = !p && nDni ? personal.find((x) => x.dni === nDni) : undefined;
  const nq = compacto(d.apellido + d.nombre);
  const parecidos = !ya && nq.length >= 6 ? personal.filter((x) => x.dni !== p?.dni).map((x) => {
    const nx = compacto(x.apellido + x.nombre);
    const mot = nx === nq ? "mismo apellido y nombre" : casiIgual(nq, nx) ? "nombre casi igual"
      : !p && nDni.length >= 7 && casiIgual(nDni, x.dni) && compacto(x.apellido) === compacto(d.apellido) ? "mismo apellido y DNI casi igual" : "";
    return mot ? { x, mot } : null;
  }).filter(Boolean).slice(0, 3) as { x: FichaPersona; mot: string }[] : [];
  const pase = p && d.unidad && d.unidad !== p.unidad;
  const sale = pase && raizEdita !== "G" && !arbol.dentro(d.unidad, raizEdita);
  const opJer = jerarquiasDe(d.tipo_personal);

  return (
    <form className="grid gap-3 mt-3" onSubmit={(e) => {
      e.preventDefault();
      if (ya) return setError("Ese DNI ya está cargado.");
      iniciar(async () => { setError(null); const r = await guardarPersona(p?.dni ?? nDni, d, !p); if (r.error) setError(r.error); else onListo(r.ok!); });
    }}>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Campo texto="DNI" ayuda={p ? "El DNI no se edita: identifica a la persona." : "Sin puntos."}
          error={ya ? `Ya existe: ${nombrePersona(ya)} · ${arbol.corto(ya.unidad)}${ya.activo ? "" : " (dado de baja: buscalo y reincorporalo)"}` : nDni && !/^\d{7,8}$/.test(nDni) ? "Tiene que tener 7 u 8 números." : null}>
          <input className="entrada" inputMode="numeric" value={dni} disabled={!!p} onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))} required />
        </Campo>
        <Campo texto="Tipo de personal">
          <select className="entrada" value={d.tipo_personal} onChange={(e) => setD({ ...d, tipo_personal: e.target.value, jerarquia: "" })} required>
            <option value="">Elegí una opción</option>
            {Object.entries(TIPOS_PERSONAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo texto="Apellido"><input className="entrada" value={d.apellido} onChange={(e) => set("apellido", e.target.value)} required /></Campo>
        <Campo texto="Nombre"><input className="entrada" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} /></Campo>
        {llevaJerarquia(d.tipo_personal) ? (
          <Campo texto="Jerarquía" ayuda={d.tipo_personal === "tecnico" ? "El personal técnico usa las jerarquías de suboficial." : undefined}>
            <select className="entrada" value={d.jerarquia} onChange={(e) => set("jerarquia", e.target.value)} required>
              <option value="">Elegí una opción</option>
              {opJer.map((g) => <optgroup key={g.grupo} label={g.grupo}>{g.lista.map((j) => <option key={j}>{j}</option>)}</optgroup>)}
            </select>
          </Campo>
        ) : <Campo texto="Jerarquía"><div className="entrada text-tenue">{d.tipo_personal ? "No corresponde (personal civil)" : "Elegí primero el tipo"}</div></Campo>}
        <Campo texto="Función"><input className="entrada" value={d.funcion} onChange={(e) => set("funcion", e.target.value)} placeholder="Chofer, Jefe de servicio…" /></Campo>
        <Campo texto="Guardia"><input className="entrada" value={d.guardia} onChange={(e) => set("guardia", e.target.value)} placeholder="1º, 2º, 3º, Administrativa…" /></Campo>
        <Campo texto="Horario"><input className="entrada" value={d.horario} onChange={(e) => set("horario", e.target.value)} placeholder="07:00 A 23:00" /></Campo>
      </div>
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={d.calle} onChange={(e) => set("calle", e.target.checked)} /> Es personal de calle (puede ir en un móvil)</label>
      {parecidos.length > 0 && (
        <div className="aviso atento">¿Ya está cargada? Revisá que no sea la misma persona:<br />
          {parecidos.map(({ x, mot }) => <span key={x.dni} className="block">{nombrePersona(x)} · DNI {x.dni} · {arbol.corto(x.unidad)}{x.activo ? "" : " (dado de baja)"} ({mot})</span>)}
        </div>
      )}
      <Campo texto="División donde revista" ayuda={pase ? `Queda registrado como pase de ${arbol.corto(p!.unidad)} a ${arbol.corto(d.unidad)}.${sale ? " Va a dejar de aparecer en tu jurisdicción." : ""}` : undefined}>
        <SelectorUnidad arbol={arbol} unidades={unidades} raiz={raizEdita} valor={d.unidad} onChange={(v) => set("unidad", v)} />
      </Campo>
      {error && <div className="aviso mal">{error}</div>}
      <div className="flex gap-2 justify-end">
        {onVolver && <button type="button" className="boton" onClick={onVolver}>Volver</button>}
        <button type="submit" className="boton primario" disabled={pendiente || !!ya}>{pendiente ? "Guardando…" : p ? "Guardar cambios" : "Dar de alta"}</button>
      </div>
    </form>
  );
}

function FormPrestarPersona({ arbol, unidades, turnos, raiz, origen, pendiente, onEnviar, onVolver }: {
  arbol: Arbol; unidades: Unidad[]; turnos: Turno[]; raiz: string; origen: string; pendiente: boolean;
  onEnviar: (destino: string, fecha: string, turno: string, obs: string) => void; onVolver: () => void;
}) {
  const g = guardiaActual();
  const [destino, setDestino] = useState("");
  const [fecha, setFecha] = useState(g.fecha);
  const [turno, setTurno] = useState(g.turno);
  const [obs, setObs] = useState("");
  return (
    <form className="grid gap-3 mt-4" onSubmit={(e) => { e.preventDefault(); if (destino && destino !== origen) onEnviar(destino, fecha, turno, obs); }}>
      <p className="text-sm text-tenue">En esa guardia solo se la puede agendar en la Dirección que la recibe.</p>
      <Campo texto="Unidad que la recibe" ayuda={raiz === "G" ? undefined : "Dentro de tu Dirección. Hacia otra Dirección lo presta el General."} error={destino === origen ? "Es la misma unidad." : null}>
        <SelectorUnidad arbol={arbol} unidades={unidades} raiz={raiz} valor={destino} onChange={setDestino} />
      </Campo>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Campo texto="Fecha de la guardia"><input className="entrada" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required /></Campo>
        <Campo texto="Turno"><select className="entrada" value={turno} onChange={(e) => setTurno(e.target.value)}>{turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Campo>
      </div>
      <Campo texto="Observación (opcional)"><input className="entrada" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} /></Campo>
      <div className="flex gap-2 justify-end">
        <button type="button" className="boton" onClick={onVolver}>Volver</button>
        <button type="submit" className="boton primario" disabled={pendiente || !destino || destino === origen}>{pendiente ? "Guardando…" : "Prestar"}</button>
      </div>
    </form>
  );
}
