"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  coincide, crearArbol, diaHora, ESTADOS, fechaCorta, guardiaSiguiente, hora, minutosVencido, MOTIVOS_RESERVA, motivoNoApto,
  nombrePersona, rangoTurno, ROLES_DOTACION, textoMovil, TOLERANCIA_RELEVO_MIN,
  type Estado, type FueraServicio, type Movil, type Prestamo, type Reserva, type Servicio,
} from "@/lib/agenda";
import * as acc from "./acciones";
import type { Datos } from "./tablero";

type Arbol = ReturnType<typeof crearArbol>;
type Fila = { dni: string; rol: "jefe" | "chofer" | "acompanante" };
type Props = {
  movil: Movil; estado: Estado; servicio?: Servicio; fuera?: FueraServicio; reserva?: Reserva; prestamo?: Prestamo;
  datos: Datos; guardia: { fecha: string; turno: string }; arbol: Arbol; edita: boolean;
  abiertos: Map<string, Servicio>; ahora: number; onCerrar: (mensaje?: string) => void;
};
type Accion = "agendar" | "relevar" | "cerrar" | "ocupado" | "fin" | "fuera" | "reservar" | "designacion" | null;

/** Hora de Córdoba escrita en un campo datetime-local → ISO */
const desdeLocal = (v: string) => (v ? new Date(v + ":00-03:00").toISOString() : "");
const aLocal = (iso: string) => new Date(Date.parse(iso) - 3 * 3600e3).toISOString().slice(0, 16);

export function Gestion(p: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [accion, setAccion] = useState<Accion>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Se abre una sola vez; al cerrarlo (Esc o ✕) avisa al tablero
  const alCerrar = useRef(p.onCerrar);
  useEffect(() => { alCerrar.current = p.onCerrar; });
  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
    const cerrar = () => alCerrar.current();
    d?.addEventListener("close", cerrar);
    return () => d?.removeEventListener("close", cerrar);
  }, []);

  const ejecutar = (fn: () => Promise<acc.Resultado>) =>
    iniciar(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else p.onCerrar(r.ok);
    });

  const { movil: m, servicio: s, estado } = p;
  const motivos = p.datos.motivos;
  const turnoNombre = (id: string) => p.datos.turnos.find((t) => t.id === id)?.nombre ?? id;
  const entrante = s ? guardiaSiguiente(s.fecha, s.turno) : p.guardia;

  return (
    <dialog ref={dlg} className="dialogo" aria-labelledby="gestion-titulo">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h2 id="gestion-titulo" className="text-lg font-semibold">{textoMovil(m)}</h2>
          <p className="text-sm text-tenue">
            {[m.marca, m.modelo].filter(Boolean).join(" ")} · {m.programa === "policial" ? "Policial" : "Ojos en Alerta"} · {p.arbol.porId.get(m.unidad)?.nombre}
          </p>
        </div>
        <button className="boton" onClick={() => dlg.current?.close()} aria-label="Cerrar">✕</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <span className={`etiqueta ${ESTADOS[estado].clase}`}>{ESTADOS[estado].texto}</span>
        {m.revisar && <span className="etiqueta atento">{m.revisar}</span>}
      </div>

      {/* Detalle del estado */}
      {s && (
        <div className="paso">
          {s.designaciones_previas.length > 0 && <div className="text-tenue">Antes: {s.designaciones_previas.join(" → ")}</div>}
          <div><b>{s.designacion ?? "Sin designación"}</b> · {turnoNombre(s.turno)} del {fechaCorta(s.fecha)} · {diaHora(s.inicio)} a {diaHora(s.fin_previsto)}</div>
          {estado === "pendiente" && (
            <div className={minutosVencido(s, p.ahora) >= TOLERANCIA_RELEVO_MIN ? "text-[var(--warn)]" : "text-tenue"}>
              El turno venció hace {minutosVencido(s, p.ahora)} minutos. Elegí qué pasa con el móvil: relevar, cerrar, reservar o marcar que sigue ocupado.
            </div>
          )}
          {s.ocupado_motivo && <div>Sigue ocupado: {motivos.find((x) => x.id === s.ocupado_motivo)?.nombre}{s.ocupado_obs ? ` · ${s.ocupado_obs}` : ""} (desde {s.ocupado_desde ? hora(s.ocupado_desde) : "—"} Hs)</div>}
          <ul className="mt-1 text-sm">
            {s.dotacion.map((d) => {
              const per = p.datos.personal.find((x) => x.dni === d.dni);
              return <li key={d.dni}>{ROLES_DOTACION[d.rol]}: {per ? nombrePersona(per) : d.dni} <span className="text-tenue">· DNI {d.dni}</span></li>;
            })}
          </ul>
        </div>
      )}
      {p.prestamo && <div className="paso">Prestado de <b>{p.arbol.porId.get(p.prestamo.origen)?.nombre}</b> a <b>{p.arbol.porId.get(p.prestamo.destino)?.nombre}</b> desde {diaHora(p.prestamo.desde)}{p.prestamo.con_dotacion ? " · con dotación" : ""}{p.prestamo.obs ? ` · ${p.prestamo.obs}` : ""}. Lo agenda la unidad que lo recibe; se devuelve desde Móviles.</div>}
      {p.fuera && <div className="paso">Fuera de servicio por <b>{motivos.find((x) => x.id === p.fuera!.motivo)?.nombre}</b> desde {diaHora(p.fuera.desde)}{p.fuera.obs ? ` · ${p.fuera.obs}` : ""}</div>}
      {p.reserva && !s && <div className="paso">Reservado en el {turnoNombre(p.reserva.turno)} del {fechaCorta(p.reserva.fecha)}: {p.reserva.motivo}{p.reserva.obs ? ` · ${p.reserva.obs}` : ""}. No cuenta como sin agendar.</div>}

      {error && <div className="aviso mal mt-3">{error}</div>}

      {!p.edita && <p className="text-sm text-tenue mt-4">Tu cuenta puede ver este móvil, pero no cargar cambios.</p>}

      {/* Botones según el estado */}
      {p.edita && accion === null && (
        <div className="flex flex-wrap gap-2 mt-4">
          {(estado === "sin_agendar" || estado === "reservado") && <button className="boton primario" onClick={() => setAccion("agendar")}>Agendar</button>}
          {estado === "sin_agendar" && <button className="boton" onClick={() => setAccion("reservar")}>Reservar (no sale en esta guardia)</button>}
          {estado === "reservado" && p.reserva && <button className="boton" disabled={pendiente} onClick={() => ejecutar(() => acc.quitarReserva({ reserva: p.reserva!.id }))}>Quitar reserva</button>}
          {s && <>
            <button className="boton primario" onClick={() => setAccion("relevar")}>Relevar</button>
            <button className="boton" onClick={() => setAccion("cerrar")}>Cerrar servicio</button>
            {!s.ocupado_motivo && <button className="boton" onClick={() => setAccion("ocupado")}>Sigue ocupado</button>}
            <button className="boton" onClick={() => setAccion("fin")}>Cambiar horario</button>
            <button className="boton" onClick={() => setAccion("designacion")}>Cambiar designación</button>
          </>}
          {estado !== "fuera" && <button className="boton peligro" onClick={() => setAccion("fuera")}>Fuera de servicio</button>}
          {estado === "fuera" && <button className="boton primario" disabled={pendiente} onClick={() => ejecutar(() => acc.volverAServicio({ movil: m.id }))}>Vuelve a servicio</button>}
        </div>
      )}

      {accion && (
        <div className="mt-4 grid gap-3">
          {accion === "agendar" && (
            <FormServicio
              {...p}
              titulo={`Agendar para el ${turnoNombre(p.guardia.turno)} del ${fechaCorta(p.guardia.fecha)}`}
              guardia={p.guardia} designacionInicial="" relevando={undefined}
              enviar={(d) => ejecutar(() => acc.agendar({ movil: m.id, ...d }))} pendiente={pendiente} volver={() => setAccion(null)}
            />
          )}
          {accion === "relevar" && s && (
            <FormServicio
              {...p}
              titulo="Relevo: entra la dotación del turno siguiente"
              guardia={entrante} designacionInicial={s.designacion ?? ""} relevando={s}
              enviar={(d) => ejecutar(() => acc.relevar({ servicio: s.id, fecha: d.fecha, turno: d.turno, designacion: d.designacion, dotacion: d.dotacion }))}
              pendiente={pendiente} volver={() => setAccion(null)}
            />
          )}
          {accion === "cerrar" && s && (
            <form className="grid gap-3" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const reservar = f.get("destino") === "reservar";
              ejecutar(() => acc.cerrar({ servicio: s.id, obs: String(f.get("obs") ?? ""), reserva: reservar ? { fecha: entrante.fecha, turno: entrante.turno, motivo: String(f.get("motivo")) } : undefined }));
            }}>
              <fieldset className="grid gap-2">
                <label className="flex gap-2"><input type="radio" name="destino" value="disponible" defaultChecked /> Cerrar y dejar el móvil disponible</label>
                <label className="flex gap-2"><input type="radio" name="destino" value="reservar" /> Cerrar y reservarlo: no sale en el {turnoNombre(entrante.turno)} del {fechaCorta(entrante.fecha)}</label>
              </fieldset>
              <label className="campo"><span>Motivo de la reserva (si se reserva)</span>
                <select className="entrada" name="motivo">{MOTIVOS_RESERVA.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
              <label className="campo"><span>Observación (opcional)</span><input className="entrada" name="obs" maxLength={200} /></label>
              <Botones pendiente={pendiente} volver={() => setAccion(null)} texto="Cerrar servicio" />
            </form>
          )}
          {accion === "ocupado" && s && (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); ejecutar(() => acc.marcarOcupado({ servicio: s.id, motivo: String(f.get("motivo")), obs: String(f.get("obs") ?? "") })); }}>
              <p className="text-sm text-tenue">Justifica que pase el horario. No cuenta como olvido ni genera reclamo.</p>
              <label className="campo"><span>Motivo</span>
                <select className="entrada" name="motivo" required>{motivos.filter((x) => x.categoria === "tarea").map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select>
              </label>
              <label className="campo"><span>Observación (opcional)</span><input className="entrada" name="obs" maxLength={200} placeholder="Aprehendido: entrega en Unidad Judicial" /></label>
              <Botones pendiente={pendiente} volver={() => setAccion(null)} texto="Guardar" />
            </form>
          )}
          {accion === "designacion" && s && (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); ejecutar(() => acc.cambiarDesignacion({ servicio: s.id, designacion: `${String(f.get("nombre")).trim()} ${String(f.get("numero")).trim()}`.trim() })); }}>
              <p className="text-sm text-tenue">Por ejemplo, cuando cambia de frecuencia. La designación anterior queda guardada y Monitoreo lo puede ubicar por cualquiera de las dos.</p>
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <label className="campo"><span>Nueva designación</span><input className="entrada" name="nombre" list="designaciones-cambio" required autoComplete="off" />
                  <datalist id="designaciones-cambio">{p.datos.designaciones.map((d) => <option key={d.nombre} value={d.nombre} />)}</datalist></label>
                <label className="campo"><span>Número</span><input className="entrada" name="numero" inputMode="numeric" maxLength={3} /></label>
              </div>
              <Botones pendiente={pendiente} volver={() => setAccion(null)} texto="Cambiar designación" />
            </form>
          )}
          {accion === "fin" && s && (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); ejecutar(() => acc.cambiarFin({ servicio: s.id, fin: desdeLocal(String(f.get("fin"))) })); }}>
              <label className="campo"><span>Nuevo fin previsto</span><input className="entrada" type="datetime-local" name="fin" defaultValue={aLocal(s.fin_previsto)} required /></label>
              <Botones pendiente={pendiente} volver={() => setAccion(null)} texto="Cambiar horario" />
            </form>
          )}
          {accion === "fuera" && (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); ejecutar(() => acc.fueraDeServicio({ movil: m.id, motivo: String(f.get("motivo")), obs: String(f.get("obs") ?? "") })); }}>
              {s && <p className="aviso atento">El servicio abierto se cierra y la dotación queda libre.</p>}
              <label className="campo"><span>Motivo</span>
                <select className="entrada" name="motivo" required>{motivos.filter((x) => x.categoria === "fuera_servicio").map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.gravedad})</option>)}</select>
              </label>
              <label className="campo"><span>Observación (opcional)</span><input className="entrada" name="obs" maxLength={200} /></label>
              <Botones pendiente={pendiente} volver={() => setAccion(null)} texto="Poner fuera de servicio" />
            </form>
          )}
          {accion === "reservar" && (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); ejecutar(() => acc.reservar({ movil: m.id, fecha: p.guardia.fecha, turno: p.guardia.turno, motivo: String(f.get("motivo")), obs: String(f.get("obs") ?? "") })); }}>
              <p className="text-sm text-tenue">No sale en el {turnoNombre(p.guardia.turno)} del {fechaCorta(p.guardia.fecha)} y no tiene novedad. No cuenta como sin agendar; en la guardia siguiente vuelve solo a disponible.</p>
              <label className="campo"><span>Motivo</span><select className="entrada" name="motivo">{MOTIVOS_RESERVA.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="campo"><span>Observación (opcional)</span><input className="entrada" name="obs" maxLength={200} /></label>
              <Botones pendiente={pendiente} volver={() => setAccion(null)} texto="Reservar" />
            </form>
          )}
        </div>
      )}
    </dialog>
  );
}

function Botones({ pendiente, volver, texto }: { pendiente: boolean; volver: () => void; texto: string }) {
  return (
    <div className="flex gap-2 justify-end">
      <button type="button" className="boton" onClick={volver}>Volver</button>
      <button type="submit" className="boton primario" disabled={pendiente}>{pendiente ? "Guardando…" : texto}</button>
    </div>
  );
}

// ---------------------------------------------------------------- agendar / relevar
function FormServicio(p: Props & {
  titulo: string; guardia: { fecha: string; turno: string }; designacionInicial: string; relevando?: Servicio;
  enviar: (d: { fecha: string; turno: string; designacion: string; dotacion: Fila[]; inicio?: string; fin?: string }) => void;
  pendiente: boolean; volver: () => void;
}) {
  const [fecha, setFecha] = useState(p.guardia.fecha);
  const [turno, setTurno] = useState(p.guardia.turno);
  const ini = p.designacionInicial.match(/^(.*?)\s*(\d+)$/);
  const [desNombre, setDesNombre] = useState(ini ? ini[1] : p.designacionInicial);
  const [desNumero, setDesNumero] = useState(ini ? ini[2] : "");
  const [dotacion, setDotacion] = useState<Fila[]>([]);
  const [otroHorario, setOtroHorario] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [faltan, setFaltan] = useState<string | null>(null);

  const t = p.datos.turnos.find((x) => x.id === turno);
  const [rIni, rFin] = t ? rangoTurno(fecha, t) : ["", ""];
  const designacion = `${desNombre.trim().toUpperCase()} ${desNumero.trim()}`.trim();
  const enUso = designacion && [...p.abiertos.values()].find((x) => x.designacion === designacion && x.movil !== p.movil.id);
  const conocida = !desNombre.trim() || p.datos.designaciones.some((d) => d.nombre === desNombre.trim().toUpperCase() || d.alias.includes(desNombre.trim().toUpperCase()));
  const dirMovil = p.arbol.direccion(p.prestamo?.destino ?? p.movil.unidad);

  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      if (!dotacion.length) return setFaltan("Agregá al menos un integrante.");
      p.enviar({ fecha, turno, designacion, dotacion, inicio: otroHorario ? desdeLocal(inicio) : undefined, fin: otroHorario ? desdeLocal(fin) : undefined });
    }}>
      <h3 className="font-semibold">{p.titulo}</h3>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <label className="campo"><span>Fecha de la guardia</span><input className="entrada" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required /></label>
        <label className="campo"><span>Turno</span>
          <select className="entrada" value={turno} onChange={(e) => setTurno(e.target.value)}>
            {p.datos.turnos.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.hora_inicio.slice(0, 5)} a {x.hora_fin.slice(0, 5)})</option>)}
          </select>
        </label>
      </div>
      {!p.relevando && (
        <div className="text-sm">
          Horario: {rIni && `${diaHora(rIni)} a ${diaHora(rFin)}`}{" "}
          <button type="button" className="underline text-tenue" onClick={() => { setOtroHorario(!otroHorario); setInicio(aLocal(rIni)); setFin(aLocal(rFin)); }}>{otroHorario ? "Usar el del turno" : "Otro horario"}</button>
          {otroHorario && (
            <div className="grid grid-cols-2 gap-3 mt-2 max-sm:grid-cols-1">
              <label className="campo"><span>Inicio</span><input className="entrada" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></label>
              <label className="campo"><span>Fin previsto</span><input className="entrada" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} required /></label>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className="campo"><span>Designación radial</span>
          <input className="entrada" list="designaciones" value={desNombre} onChange={(e) => setDesNombre(e.target.value)} placeholder="ALBERDI" autoComplete="off" />
          <datalist id="designaciones">{p.datos.designaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.zona ?? ""}</option>)}</datalist>
        </label>
        <label className="campo"><span>Número</span><input className="entrada" inputMode="numeric" value={desNumero} onChange={(e) => setDesNumero(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="20" /></label>
      </div>
      {enUso && <div className="aviso atento">{designacion} ya está en uso por {textoMovil(p.datos.moviles.find((x) => x.id === enUso.movil)!)}. Revisá el número.</div>}
      {!conocida && <div className="aviso atento">«{desNombre.trim().toUpperCase()}» no está en el catálogo del SAE. Se puede usar igual; revisá que esté bien escrita.</div>}

      <Dotacion {...p} relevando={p.relevando} fecha={fecha} turno={turno} filas={dotacion} setFilas={(f) => { setDotacion(f); setFaltan(null); }} dirMovil={dirMovil} />
      {faltan && <div className="aviso mal">{faltan}</div>}
      <Botones pendiente={p.pendiente} volver={p.volver} texto={p.relevando ? "Registrar relevo" : "Agendar"} />
    </form>
  );
}

function Dotacion(p: Props & { fecha: string; turno: string; filas: Fila[]; setFilas: (f: Fila[]) => void; dirMovil: string; relevando?: Servicio }) {
  const [q, setQ] = useState("");
  // Quién está hoy en algún móvil (el que se releva no cuenta: sale en este mismo paso)
  const ocupados = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const s of p.abiertos.values()) {
      if (p.relevando && s.id === p.relevando.id) continue;
      const mv = p.datos.moviles.find((x) => x.id === s.movil);
      for (const d of s.dotacion) mapa.set(d.dni, mv ? textoMovil(mv) : "otro móvil");
    }
    return mapa;
  }, [p.abiertos, p.relevando, p.datos.moviles]);

  const resultados = q.trim().length < 2 ? [] : p.datos.personal
    .filter((x) => coincide(`${x.apellido} ${x.nombre} ${x.dni} ${x.jerarquia ?? ""}`, q))
    .slice(0, 8);
  const per = (dni: string) => p.datos.personal.find((x) => x.dni === dni);
  const agregar = (dni: string) => {
    if (p.filas.some((f) => f.dni === dni)) return;
    const rol = p.filas.length === 0 ? "chofer" : "acompanante";
    p.setFilas([...p.filas, { dni, rol }]);
    setQ("");
  };

  return (
    <div className="grid gap-2">
      <span className="text-[13px] text-tenue">Dotación</span>
      {p.filas.map((f, i) => {
        const x = per(f.dni);
        const otraDir = x && p.arbol.direccion(x.unidad) !== p.dirMovil;
        return (
          <div key={f.dni} className="flex flex-wrap gap-2 items-center paso m-0">
            <span className="grow">{x ? nombrePersona(x) : f.dni} <span className="text-tenue text-sm">· DNI {f.dni} · {x ? p.arbol.corto(x.unidad) : ""}</span>
              {otraDir && <span className="block text-[12.5px] text-[var(--warn)]">Es de otra Dirección: se puede agendar y queda registrado.</span>}
            </span>
            <select className="entrada w-40" value={f.rol} onChange={(e) => p.setFilas(p.filas.map((y, j) => j === i ? { ...y, rol: e.target.value as Fila["rol"] } : y))}>
              {Object.entries(ROLES_DOTACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" className="boton" onClick={() => p.setFilas(p.filas.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        );
      })}
      {p.filas.length === 1 && <div className="text-[12.5px] text-[var(--warn)]">Va un solo integrante. Se puede, pero queda a la vista.</div>}
      {p.relevando && p.filas.length === 0 && p.relevando.dotacion.length > 0 && (
        <button type="button" className="boton justify-self-start" onClick={() => p.setFilas(p.relevando!.dotacion.map((d) => ({ dni: d.dni, rol: d.rol })))}>
          Repetir la dotación saliente
        </button>
      )}
      <input className="entrada" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por apellido, nombre o DNI para agregar" />
      {resultados.length > 0 && (
        <ul className="tarjeta divide-y divide-[var(--line)]">
          {resultados.map((x) => {
            const noApto = motivoNoApto(x, p.fecha, p.datos.situaciones);
            const enOtro = ocupados.get(x.dni);
            const pp = p.datos.prestamosPersonal.find((q) => q.dni === x.dni && q.fecha === p.fecha && q.turno === p.turno);
            const prestadoAfuera = pp && p.arbol.direccion(pp.destino) !== p.dirMovil ? `Prestado a ${p.arbol.corto(pp.destino)} en esa guardia` : null;
            const motivo = noApto ?? (enOtro ? `Ya está en ${enOtro}` : prestadoAfuera);
            return (
              <li key={x.dni}>
                <button type="button" disabled={!!motivo} onClick={() => agregar(x.dni)} className="w-full text-left px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[var(--panel-2)]">
                  {nombrePersona(x)} <span className="text-tenue text-sm">· DNI {x.dni} · {p.arbol.corto(x.unidad)}</span>
                  {motivo ? <span className="block text-[12.5px] text-[var(--bad)]">No apto: {motivo}</span> : <span className="block text-[12.5px] text-[var(--ok)]">Apto</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
