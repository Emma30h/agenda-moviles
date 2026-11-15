"use client";

import { useMemo, useState, useTransition } from "react";
import { Dialogo } from "@/components/dialogo";
import { coincide, compacto, crearArbol, diaHora, hace, type Unidad } from "@/lib/agenda";
import { Campo, Chips, FiltroMultiple, SelectorUnidad } from "../datos/campos";
import { agregarExcepcion, aliasExcepcion, descartarExcepcion, guardarDesignacion, type DatosDesignacion } from "./acciones";

export type DesignacionFila = {
  nombre: string; tipo: string | null; zona: string | null; unidad: string | null; distritos: string | null;
  alias: string[]; usos: number; activa: boolean; origen: "sae" | "app";
};
export type Excepcion = {
  id: number; nombre: string; ejemplo: string; usos: number; ultima_vez: string; movil: string | null; unidad: string | null;
  creado_en: string; estado: "pendiente" | "agregada" | "alias" | "descartada"; resuelta_como: string | null; resuelto_en: string | null;
  movil_ref: { interno: number | null; dominio: string } | null;
};
type Arbol = ReturnType<typeof crearArbol>;

/** Cuántos cambios de letra separan dos nombres (para sugerir la más parecida) */
function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const sinNumero = (s: string) => s.replace(/\s*\d+\s*$/, "").trim();
const ESTADO_EXC = { agregada: ["ok", "Agregada"], alias: ["info", "Otra forma de escribir"], descartada: ["", "Descartada"], pendiente: ["atento", "Pendiente"] } as const;

export function Catalogo({ unidades, designaciones, excepciones, edita }: {
  unidades: Unidad[]; designaciones: DesignacionFila[]; excepciones: Excepcion[]; edita: boolean;
}) {
  const arbol = useMemo(() => crearArbol(unidades), [unidades]);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [q, setQ] = useState("");
  const [fZona, setFZona] = useState<string[]>([]);
  const [fDiv, setFDiv] = useState<string[]>([]);
  const [fEstado, setFEstado] = useState<("activa" | "inactiva" | "app")[]>(["activa"]);
  const [editando, setEditando] = useState<DesignacionFila | "nueva" | null>(null);

  const pendientes = excepciones.filter((e) => e.estado === "pendiente");
  const resueltas = excepciones.filter((e) => e.estado !== "pendiente");
  const zonas = [...new Set(designaciones.map((d) => d.zona ?? "Sin zona"))].sort();
  const divisiones = [...new Set(designaciones.map((d) => d.unidad).filter(Boolean) as string[])].sort((a, b) => arbol.corto(a).localeCompare(arbol.corto(b), "es", { numeric: true }));
  const cuenta = (f: (d: DesignacionFila) => boolean) => designaciones.filter(f).length;
  const lista = designaciones
    .filter((d) => !fEstado.length || (fEstado.includes("activa") && d.activa) || (fEstado.includes("inactiva") && !d.activa) || (fEstado.includes("app") && d.origen === "app"))
    .filter((d) => !fZona.length || fZona.includes(d.zona ?? "Sin zona"))
    .filter((d) => !fDiv.length || (d.unidad && fDiv.includes(d.unidad)))
    .filter((d) => !q.trim() || coincide(`${d.nombre} ${d.alias.join(" ")} ${d.zona ?? ""}`, q));
  const listo = (r: { ok?: string; error?: string }) => setAviso(r.error ? { ok: false, texto: r.error } : { ok: true, texto: r.ok! });

  return (
    <div className="grid gap-5">
      <section className="tarjeta p-4 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Designaciones radiales</h1>
          <p className="text-sm text-tenue">Catálogo relevado del SAE. Las que se usan fuera de la lista quedan pendientes para que el General decida.</p>
        </div>
        {edita && <button className="boton primario" onClick={() => setEditando("nueva")}>Agregar designación</button>}
      </section>

      {aviso && <div className={`aviso ${aviso.ok ? "ok" : "mal"} flex justify-between gap-3`}><span>{aviso.texto}</span><button className="text-sm underline" onClick={() => setAviso(null)}>Cerrar</button></div>}

      <section className="tarjeta p-4 grid gap-3">
        <h2 className="font-semibold">Usadas fuera del catálogo ({pendientes.length})</h2>
        {!pendientes.length && <p className="text-sm text-tenue">No hay designaciones pendientes de revisar.</p>}
        {pendientes.map((e) => <Pendiente key={e.id} e={e} arbol={arbol} unidades={unidades} designaciones={designaciones} edita={edita} onResultado={listo} />)}
        {resueltas.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">Resueltas en los últimos 30 días ({resueltas.length})</summary>
            <ul className="mt-2 grid gap-1 text-sm">{resueltas.map((e) => (
              <li key={e.id}>{e.resuelto_en ? diaHora(e.resuelto_en) : ""} · «{e.ejemplo}» · <span className={`etiqueta ${ESTADO_EXC[e.estado][0]}`}>{ESTADO_EXC[e.estado][1]}</span>{e.resuelta_como ? ` · ${e.resuelta_como}` : ""}</li>
            ))}</ul>
          </details>
        )}
      </section>

      <section className="tarjeta p-4 grid gap-3">
        <h2 className="font-semibold">Catálogo</h2>
        <Chips valor={fEstado} onChange={setFEstado} opciones={[
          { valor: "activa", texto: "Activas", cantidad: cuenta((d) => d.activa) },
          { valor: "inactiva", texto: "Desactivadas", cantidad: cuenta((d) => !d.activa) },
          { valor: "app", texto: "Agregadas por el General", cantidad: cuenta((d) => d.origen === "app") },
        ]} />
        <div className="flex flex-wrap gap-2 items-center">
          <input className="entrada max-w-sm" type="search" placeholder="Buscar por nombre o forma de escribirla" value={q} onChange={(e) => setQ(e.target.value)} />
          <FiltroMultiple texto="Zona" valor={fZona} onChange={setFZona} opciones={zonas.map((z) => ({ valor: z, texto: z, cantidad: cuenta((d) => (d.zona ?? "Sin zona") === z) }))} />
          <FiltroMultiple texto="División" valor={fDiv} onChange={setFDiv} opciones={divisiones.map((u) => ({ valor: u, texto: arbol.corto(u), cantidad: cuenta((d) => d.unidad === u) }))} />
          <span className="text-sm text-tenue ml-auto">{lista.length} designaciones</span>
        </div>
      </section>

      <section className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Otras formas de escribirla</th><th>Zona</th><th>División</th><th className="text-right">Usos en el SAE</th><th></th></tr></thead>
          <tbody>{lista.map((d) => (
            <tr key={d.nombre} className={edita ? "cursor-pointer hover:bg-[var(--panel-2)]" : ""} onClick={() => edita && setEditando(d)}>
              <td><b>{d.nombre}</b>{!d.activa && <span className="etiqueta ml-2">Desactivada</span>}{d.origen === "app" && <span className="etiqueta info ml-2">Agregada</span>}</td>
              <td className="text-sm text-tenue">{d.alias.join(" · ") || "—"}</td>
              <td>{d.zona ?? "—"}</td>
              <td>{d.unidad ? arbol.corto(d.unidad) : "—"}</td>
              <td className="text-right">{d.usos || ""}</td>
              <td className="text-sm text-acento">{edita ? "Editar ›" : ""}</td>
            </tr>
          ))}</tbody>
        </table>
        {!lista.length && <p className="p-4 text-tenue">No hay designaciones con esos filtros.</p>}
      </section>

      {editando && (
        <Dialogo titulo={editando === "nueva" ? "Agregar designación" : `Editar ${editando.nombre}`} onCerrar={() => setEditando(null)}>
          <FormDesignacion d={editando === "nueva" ? undefined : editando} arbol={arbol} unidades={unidades} zonas={zonas.filter((z) => z !== "Sin zona")}
            onListo={(r) => { listo(r); if (!r.error) setEditando(null); }} />
        </Dialogo>
      )}
    </div>
  );
}

function Pendiente({ e, arbol, unidades, designaciones, edita, onResultado }: {
  e: Excepcion; arbol: Arbol; unidades: Unidad[]; designaciones: DesignacionFila[]; edita: boolean; onResultado: (r: { ok?: string; error?: string }) => void;
}) {
  const [modo, setModo] = useState<"ver" | "agregar" | "alias">("ver");
  const [pendiente, iniciar] = useTransition();
  const correr = (fn: () => Promise<{ ok?: string; error?: string }>) => iniciar(async () => onResultado(await fn()));
  // Las tres del catálogo más parecidas, para ofrecerlas como «otra forma de escribir»
  const parecidas = designaciones
    .map((d) => ({ d, dist: Math.min(distancia(compacto(d.nombre).toUpperCase(), e.nombre), ...d.alias.map((a) => distancia(compacto(a).toUpperCase(), e.nombre))) }))
    .sort((a, b) => a.dist - b.dist).slice(0, 3).filter((x) => x.dist <= Math.max(2, Math.floor(e.nombre.length / 3)));
  const [nombre, setNombre] = useState(sinNumero(e.ejemplo));
  const [zona, setZona] = useState("");
  const [unidad, setUnidad] = useState(e.unidad && arbol.porId.get(e.unidad)?.tipo === "division" ? e.unidad : "");
  const [destino, setDestino] = useState(parecidas[0]?.d.nombre ?? "");

  return (
    <div className="paso m-0 grid gap-2">
      <div className="flex flex-wrap gap-2 justify-between">
        <span><b>«{e.ejemplo}»</b> <span className="text-tenue text-sm">· usada {e.usos} {e.usos === 1 ? "vez" : "veces"} · última hace {hace(e.ultima_vez)}{e.movil_ref ? ` en ${e.movil_ref.interno != null ? "Int. " + e.movil_ref.interno + " · " : ""}${e.movil_ref.dominio}` : ""}{e.unidad ? ` · ${arbol.corto(e.unidad)}` : ""}</span></span>
        {parecidas.length > 0 && <span className="text-sm text-tenue">Parecidas: {parecidas.map((x) => x.d.nombre).join(", ")}</span>}
      </div>
      {edita && modo === "ver" && (
        <div className="flex flex-wrap gap-2">
          <button className="boton primario" onClick={() => setModo("agregar")}>Agregar al catálogo</button>
          <button className="boton" onClick={() => setModo("alias")}>Es otra forma de escribir…</button>
          <button className="boton" disabled={pendiente} onClick={() => correr(() => descartarExcepcion(e.id))}>Descartar</button>
        </div>
      )}
      {modo === "agregar" && (
        <form className="grid gap-2" onSubmit={(ev) => { ev.preventDefault(); correr(() => agregarExcepcion(e.id, nombre, zona, unidad)); }}>
          <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            <Campo texto="Nombre (sin número)"><input className="entrada uppercase" value={nombre} onChange={(x) => setNombre(x.target.value)} required /></Campo>
            <Campo texto="Zona"><input className="entrada" value={zona} onChange={(x) => setZona(x.target.value)} placeholder="Norte, Este…" /></Campo>
            <Campo texto="División principal"><SelectorUnidad arbol={arbol} unidades={unidades.filter((u) => u.tipo === "division" || u.tipo === "departamento")} raiz="G" valor={unidad} onChange={setUnidad} /></Campo>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="boton" onClick={() => setModo("ver")}>Volver</button>
            <button className="boton primario" disabled={pendiente}>{pendiente ? "Guardando…" : "Agregar"}</button>
          </div>
        </form>
      )}
      {modo === "alias" && (
        <form className="grid gap-2" onSubmit={(ev) => { ev.preventDefault(); correr(() => aliasExcepcion(e.id, destino)); }}>
          <Campo texto="Designación del catálogo" ayuda={`«${e.nombre}» va a quedar como otra forma de escribirla: la búsqueda y la Agenda la van a reconocer.`}>
            <select className="entrada" value={destino} onChange={(x) => setDestino(x.target.value)} required>
              <option value="">Elegí una opción</option>
              {parecidas.length > 0 && <optgroup label="Más parecidas">{parecidas.map((x) => <option key={"p" + x.d.nombre} value={x.d.nombre}>{x.d.nombre}</option>)}</optgroup>}
              <optgroup label="Todas">{designaciones.map((d) => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}</optgroup>
            </select>
          </Campo>
          <div className="flex gap-2 justify-end">
            <button type="button" className="boton" onClick={() => setModo("ver")}>Volver</button>
            <button className="boton primario" disabled={pendiente || !destino}>{pendiente ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function FormDesignacion({ d, arbol, unidades, zonas, onListo }: {
  d?: DesignacionFila; arbol: Arbol; unidades: Unidad[]; zonas: string[]; onListo: (r: { ok?: string; error?: string }) => void;
}) {
  const [f, setF] = useState<DatosDesignacion>({ nombre: d?.nombre ?? "", zona: d?.zona ?? "", unidad: d?.unidad ?? "", alias: d?.alias ?? [], activa: d?.activa ?? true });
  const [alias, setAlias] = useState((d?.alias ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form className="grid gap-3 mt-3" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => {
        setError(null);
        const r = await guardarDesignacion({ ...f, alias: alias.split(",").map((a) => a.trim()).filter(Boolean) }, d?.nombre ?? null);
        if (r.error) setError(r.error); else onListo(r);
      });
    }}>
      <Campo texto="Nombre (sin número)" ayuda="El número se carga en cada servicio (ej. ALBERDI 20).">
        <input className="entrada uppercase" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
      </Campo>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Campo texto="Zona">
          <input className="entrada" list="zonas" value={f.zona} onChange={(e) => setF({ ...f, zona: e.target.value })} />
          <datalist id="zonas">{zonas.map((z) => <option key={z} value={z} />)}</datalist>
        </Campo>
        <Campo texto="División principal">
          <SelectorUnidad arbol={arbol} unidades={unidades} raiz="G" valor={f.unidad} onChange={(v) => setF({ ...f, unidad: v })} />
        </Campo>
      </div>
      <Campo texto="Otras formas de escribirla" ayuda="Separadas por coma. Ej.: GRALPAZ, PAZ. La búsqueda de Frecuencia y la Agenda las reconocen.">
        <input className="entrada uppercase" value={alias} onChange={(e) => setAlias(e.target.value)} />
      </Campo>
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} /> Activa (aparece como sugerencia al agendar)</label>
      {error && <div className="aviso mal">{error}</div>}
      <div className="flex justify-end"><button className="boton primario" disabled={pendiente}>{pendiente ? "Guardando…" : d ? "Guardar cambios" : "Agregar"}</button></div>
    </form>
  );
}
