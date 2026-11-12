"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { Dialogo } from "@/components/dialogo";
import {
  casiIgual, coincide, compacto, crearArbol, diaHora, MOTIVOS_BAJA_MOVIL, PROGRAMAS, textoMovil, VEHICULOS,
  type Movil, type Unidad,
} from "@/lib/agenda";
import { bajaMovil, guardarMovil, reincorporarMovil, type DatosMovil } from "../datos/acciones";
import { Campo, Chips, FiltroMultiple, SelectorUnidad } from "../datos/campos";
import { Historial } from "../datos/historial";

export type MovilFicha = Movil & { activo: boolean; baja_motivo: string | null; baja_fecha: string | null; baja_obs: string | null };
const LOGO = { ojos_en_alerta: "/img/ojos-en-alerta.png", policial: "/img/policia-cordoba.png" } as const;
type Arbol = ReturnType<typeof crearArbol>;

export function VistaMoviles({ unidades, moviles, raiz, raizEdita, enServicio, fuera }: {
  unidades: Unidad[]; moviles: MovilFicha[]; raiz: string; raizEdita: string | null; enServicio: Record<string, string>; fuera: string[];
}) {
  const arbol = useMemo(() => crearArbol(unidades), [unidades]);
  const [fEstado, setFEstado] = useState<("activo" | "baja" | "revisar")[]>(["activo"]);
  const [fProg, setFProg] = useState<("ojos_en_alerta" | "policial")[]>([]);
  const [fDiv, setFDiv] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState<string | "nuevo" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const puedeEditar = (u: string) => !!raizEdita && (raizEdita === "G" || arbol.dentro(u, raizEdita));
  const visibles = moviles.filter((m) => raiz === "G" || arbol.dentro(m.unidad, raiz));
  const cuenta = (f: (m: MovilFicha) => boolean) => visibles.filter(f).length;
  const lista = visibles
    .filter((m) => !fEstado.length || (fEstado.includes("activo") && m.activo) || (fEstado.includes("baja") && !m.activo) || (fEstado.includes("revisar") && !!m.revisar))
    .filter((m) => !fProg.length || fProg.includes(m.programa))
    .filter((m) => !fDiv.length || fDiv.includes(m.unidad))
    .filter((m) => !q.trim() || coincide(`${m.interno ?? ""} ${m.dominio} ${m.marca ?? ""} ${m.modelo ?? ""} ${arbol.corto(m.unidad)}`, q));
  const divisiones = [...new Set(visibles.map((m) => m.unidad))].sort((a, b) => arbol.corto(a).localeCompare(arbol.corto(b), "es", { numeric: true }));
  const elegido = abierto && abierto !== "nuevo" ? moviles.find((m) => m.id === abierto) : undefined;

  return (
    <div className="grid gap-4">
      <section className="tarjeta p-4 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Móviles</h1>
          <p className="text-sm text-tenue">Altas, datos, cambios de división y bajas. Todo cambio queda en el historial y se puede deshacer.</p>
        </div>
        {raizEdita && <button className="boton primario" onClick={() => setAbierto("nuevo")}>Agregar móvil</button>}
      </section>

      {aviso && <div className="aviso ok flex justify-between gap-3"><span>{aviso}</span><button className="text-sm underline" onClick={() => setAviso(null)}>Cerrar</button></div>}

      <section className="tarjeta p-4 grid gap-3">
        <Chips
          opciones={[
            { valor: "activo", texto: "Activos", cantidad: cuenta((m) => m.activo) },
            { valor: "baja", texto: "Dados de baja", cantidad: cuenta((m) => !m.activo) },
            { valor: "revisar", texto: "Datos a corregir", cantidad: cuenta((m) => !!m.revisar) },
          ]}
          valor={fEstado} onChange={setFEstado}
        />
        <div className="flex flex-wrap gap-2 items-center">
          <input className="entrada max-w-sm" type="search" placeholder="Búsqueda rápida: interno, patente, marca o división" value={q} onChange={(e) => setQ(e.target.value)} />
          <FiltroMultiple texto="Tipo" valor={fProg} onChange={(v) => setFProg(v as typeof fProg)}
            opciones={(Object.keys(PROGRAMAS) as (keyof typeof PROGRAMAS)[]).map((p) => ({ valor: p, texto: PROGRAMAS[p], cantidad: cuenta((m) => m.programa === p) }))} />
          <FiltroMultiple texto="División" valor={fDiv} onChange={setFDiv}
            opciones={divisiones.map((u) => ({ valor: u, texto: arbol.corto(u), cantidad: cuenta((m) => m.unidad === u) }))} />
          {(fProg.length || fDiv.length || q || fEstado.join() !== "activo") ? (
            <button className="text-sm underline text-tenue" onClick={() => { setFEstado(["activo"]); setFProg([]); setFDiv([]); setQ(""); }}>Limpiar filtros</button>
          ) : null}
          <span className="text-sm text-tenue ml-auto">{lista.length} móviles</span>
        </div>
      </section>

      <section className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead><tr><th></th><th>Móvil</th><th>Vehículo</th><th>División</th><th>Estado</th></tr></thead>
          <tbody>
            {lista.slice(0, 400).map((m) => (
              <tr key={m.id} className="cursor-pointer hover:bg-[var(--panel-2)]" onClick={() => setAbierto(m.id)}>
                <td className="w-10"><Image src={LOGO[m.programa]} alt={PROGRAMAS[m.programa]} width={24} height={24} /></td>
                <td><b>{textoMovil(m)}</b></td>
                <td>{[m.tipo, m.marca, m.modelo].filter(Boolean).join(" · ")}</td>
                <td>{arbol.corto(m.unidad)}</td>
                <td className="flex flex-wrap gap-1">
                  {!m.activo ? <span className="etiqueta">Baja: {m.baja_motivo}</span>
                    : enServicio[m.id] ? <span className="etiqueta ok">{enServicio[m.id]}</span>
                    : fuera.includes(m.id) ? <span className="etiqueta mal">Fuera de servicio</span>
                    : <span className="etiqueta">Disponible</span>}
                  {m.revisar && <span className="etiqueta atento" title={m.revisar}>Dato a corregir</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length > 400 && <p className="p-3 text-sm text-tenue">Se muestran los primeros 400. Usá la búsqueda o los filtros.</p>}
        {!lista.length && <p className="p-4 text-tenue">No hay móviles con esos filtros.</p>}
      </section>

      {abierto === "nuevo" && raizEdita && (
        <Dialogo titulo="Agregar móvil" onCerrar={() => setAbierto(null)}>
          <FormMovil arbol={arbol} unidades={unidades} raizEdita={raizEdita} moviles={moviles}
            onListo={(msg) => { setAbierto(null); setAviso(msg); }} />
        </Dialogo>
      )}
      {elegido && (
        <Ficha key={elegido.id} m={elegido} arbol={arbol} unidades={unidades} moviles={moviles} raizEdita={raizEdita}
          editable={puedeEditar(elegido.unidad)} enServicio={enServicio[elegido.id]} fuera={fuera.includes(elegido.id)}
          onCerrar={() => setAbierto(null)} onAviso={setAviso} />
      )}
    </div>
  );
}

function Ficha({ m, arbol, unidades, moviles, raizEdita, editable, enServicio, fuera, onCerrar, onAviso }: {
  m: MovilFicha; arbol: Arbol; unidades: Unidad[]; moviles: MovilFicha[]; raizEdita: string | null; editable: boolean;
  enServicio?: string; fuera: boolean; onCerrar: () => void; onAviso: (s: string) => void;
}) {
  const [modo, setModo] = useState<"ver" | "editar" | "baja">("ver");
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const listo = (msg: string) => { onAviso(msg); setVersion((v) => v + 1); setModo("ver"); };

  return (
    <Dialogo titulo={textoMovil(m)} subtitulo={`${[m.tipo, m.marca, m.modelo].filter(Boolean).join(" · ")} · ${PROGRAMAS[m.programa]} · ${arbol.porId.get(m.unidad)?.nombre}`} onCerrar={onCerrar}>
      <div className="mt-3 flex flex-wrap gap-2">
        {!m.activo ? <span className="etiqueta">Dado de baja</span> : enServicio ? <span className="etiqueta ok">En servicio · {enServicio}</span> : fuera ? <span className="etiqueta mal">Fuera de servicio</span> : <span className="etiqueta">Disponible</span>}
        {m.revisar && <span className="etiqueta atento">{m.revisar}</span>}
      </div>
      {!m.activo && <div className="paso">Baja: <b>{m.baja_motivo}</b>{m.baja_fecha ? ` · ${diaHora(m.baja_fecha)}` : ""}{m.baja_obs ? ` · ${m.baja_obs}` : ""}. No se borró: se puede reincorporar.</div>}
      {error && <div className="aviso mal mt-3">{error}</div>}

      {editable && modo === "ver" && (
        <div className="flex flex-wrap gap-2 mt-4">
          {m.activo && <button className="boton primario" onClick={() => setModo("editar")}>Editar datos o cambiar de división</button>}
          {m.activo && <button className="boton peligro" onClick={() => setModo("baja")}>Dar de baja</button>}
          {!m.activo && <button className="boton primario" disabled={pendiente} onClick={() => iniciar(async () => { setError(null); const r = await reincorporarMovil(m.id); if (r.error) setError(r.error); else listo(r.ok!); })}>Reincorporar</button>}
        </div>
      )}
      {modo === "editar" && raizEdita && (
        <div className="mt-4"><FormMovil m={m} arbol={arbol} unidades={unidades} raizEdita={raizEdita} moviles={moviles} enServicio={!!enServicio} onListo={listo} onVolver={() => setModo("ver")} /></div>
      )}
      {modo === "baja" && (
        <FormBaja motivos={m.activo && enServicio ? [] : MOTIVOS_BAJA_MOVIL} aviso={enServicio ? "Está en servicio: cerralo desde la Agenda antes de darlo de baja." : fuera ? "Está fuera de servicio: al darlo de baja, eso se cierra." : undefined}
          onVolver={() => setModo("ver")}
          onEnviar={(motivo, obs) => iniciar(async () => { setError(null); const r = await bajaMovil(m.id, motivo, obs); if (r.error) setError(r.error); else listo(r.ok!); })}
          pendiente={pendiente} />
      )}
      {!editable && <p className="text-sm text-tenue mt-4">Podés ver este móvil, pero no editarlo.</p>}
      <Historial tabla="movil" registro={m.id} puedeEditar={editable} nombreUnidad={(u) => arbol.corto(u)} version={version} onCambio={listo} />
    </Dialogo>
  );
}

export function FormBaja({ motivos, aviso, onEnviar, onVolver, pendiente }: {
  motivos: string[]; aviso?: string; onEnviar: (motivo: string, obs: string) => void; onVolver: () => void; pendiente: boolean;
}) {
  return (
    <form className="grid gap-3 mt-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onEnviar(String(f.get("motivo")), String(f.get("obs") ?? "")); }}>
      {aviso && <div className="aviso atento">{aviso}</div>}
      {motivos.length > 0 && <>
        <Campo texto="Motivo de la baja" ayuda="Si se cargó por error, elegí «Cargado por error».">
          <select className="entrada" name="motivo">{motivos.map((x) => <option key={x}>{x}</option>)}</select>
        </Campo>
        <Campo texto="Observación (opcional)"><input className="entrada" name="obs" maxLength={200} /></Campo>
        <p className="text-sm text-tenue">No se borra: queda en el historial y se puede reincorporar.</p>
      </>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="boton" onClick={onVolver}>Volver</button>
        {motivos.length > 0 && <button type="submit" className="boton peligro" disabled={pendiente}>{pendiente ? "Guardando…" : "Confirmar baja"}</button>}
      </div>
    </form>
  );
}

function FormMovil({ m, arbol, unidades, raizEdita, moviles, enServicio, onListo, onVolver }: {
  m?: MovilFicha; arbol: Arbol; unidades: Unidad[]; raizEdita: string; moviles: MovilFicha[]; enServicio?: boolean;
  onListo: (msg: string) => void; onVolver?: () => void;
}) {
  const [d, setD] = useState<DatosMovil>({
    interno: m?.interno != null ? String(m.interno) : "", dominio: m?.dominio ?? "", programa: m?.programa ?? "ojos_en_alerta",
    tipo: m?.tipo ?? "Sedan", marca: m?.marca ?? "", modelo: m?.modelo ?? "", unidad: m?.unidad ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof DatosMovil, v: string) => setD({ ...d, [k]: v });

  // Repetidos: exactos bloquean (también contra bajas); patente casi igual solo avisa
  const dom = compacto(d.dominio).toUpperCase(), interno = d.interno.replace(/\D/g, "");
  const otros = moviles.filter((x) => x.id !== m?.id);
  const domRep = dom && otros.find((x) => x.dominio === dom);
  const intRep = interno && otros.find((x) => String(x.interno) === interno);
  const parecidos = dom.length >= 6 && !domRep ? otros.filter((x) => casiIgual(dom, x.dominio)).slice(0, 3) : [];
  const formatoRaro = dom && !/^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(dom);
  const cambiaDiv = m && d.unidad && d.unidad !== m.unidad;
  const bloqueo = domRep ? "Esa patente ya está cargada" : intRep ? "Ese interno ya está cargado" : cambiaDiv && enServicio ? "No se puede cambiar de división mientras está en servicio" : null;

  return (
    <form className="grid gap-3 mt-3" onSubmit={(e) => {
      e.preventDefault();
      if (bloqueo) return setError(bloqueo);
      iniciar(async () => { setError(null); const r = await guardarMovil(m?.id ?? null, { ...d, dominio: dom, interno }); if (r.error) setError(r.error); else onListo(r.ok!); });
    }}>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Campo texto="Interno" error={intRep ? `Ya es ${textoMovil(intRep)}${intRep.activo ? "" : " (dado de baja)"}` : null} ayuda={m?.revisar?.startsWith("El interno") ? "Cargá el interno correcto." : undefined}>
          <input className="entrada" inputMode="numeric" value={d.interno} onChange={(e) => set("interno", e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Campo>
        <Campo texto="Patente" error={domRep ? `Ya es ${textoMovil(domRep)}${domRep.activo ? "" : " (dado de baja: reincorporalo)"}` : null} ayuda={formatoRaro ? "Revisá el formato: AB123CD o ABC123." : undefined}>
          <input className="entrada uppercase" value={d.dominio} onChange={(e) => set("dominio", e.target.value)} maxLength={10} required />
        </Campo>
      </div>
      {parecidos.length > 0 && (
        <div className="aviso atento">¿Ya está cargado? Revisá que no sea el mismo móvil:<br />
          {parecidos.map((x) => <span key={x.id} className="block">{textoMovil(x)} · {x.marca} {x.modelo} · {arbol.corto(x.unidad)}{x.activo ? "" : " (dado de baja)"} (patente casi igual)</span>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Campo texto="Tipo de móvil">
          <select className="entrada" value={d.programa} onChange={(e) => set("programa", e.target.value)}>
            {Object.entries(PROGRAMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo texto="Vehículo">
          <select className="entrada" value={d.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {[...new Set([...(m?.tipo ? [m.tipo] : []), ...VEHICULOS])].map((v) => <option key={v}>{v}</option>)}
          </select>
        </Campo>
        <Campo texto="Marca"><input className="entrada" value={d.marca} onChange={(e) => set("marca", e.target.value)} required /></Campo>
        <Campo texto="Modelo"><input className="entrada" value={d.modelo} onChange={(e) => set("modelo", e.target.value)} /></Campo>
      </div>
      <Campo texto="División" error={cambiaDiv && enServicio ? "Está en servicio: cerralo antes de cambiarlo de división." : null}
        ayuda={cambiaDiv ? "Queda registrado como cambio de división." : undefined}>
        <SelectorUnidad arbol={arbol} unidades={unidades} raiz={raizEdita} valor={d.unidad} onChange={(v) => set("unidad", v)} />
      </Campo>
      {error && <div className="aviso mal">{error}</div>}
      <div className="flex gap-2 justify-end">
        {onVolver && <button type="button" className="boton" onClick={onVolver}>Volver</button>}
        <button type="submit" className="boton primario" disabled={pendiente || !!bloqueo}>{pendiente ? "Guardando…" : m ? "Guardar cambios" : "Dar de alta"}</button>
      </div>
    </form>
  );
}
