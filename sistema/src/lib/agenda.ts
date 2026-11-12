/** Tipos y cálculos de la agenda. Sirve tanto en el servidor como en el navegador. */

export type Unidad = { id: string; nombre: string; tipo: string; padre: string | null; orden: number };
export type Turno = { id: string; nombre: string; hora_inicio: string; hora_fin: string; unidad: string | null; orden: number };
export type Motivo = { id: string; nombre: string; categoria: "fuera_servicio" | "tarea"; gravedad: string | null };
export type Movil = {
  id: string; interno: number | null; dominio: string; programa: "ojos_en_alerta" | "policial";
  tipo: string | null; marca: string | null; modelo: string | null; unidad: string; revisar: string | null;
};
export type Persona = {
  dni: string; apellido: string; nombre: string; jerarquia: string | null; tipo_personal: string;
  unidad: string; calle: boolean; activo: boolean;
};
export type Situacion = { dni: string; tipo: string; desde: string; hasta: string | null };
export type Integrante = { dni: string; rol: "jefe" | "chofer" | "acompanante"; desde: string };
export type Servicio = {
  id: string; movil: string; unidad: string; fecha: string; turno: string; designacion: string | null;
  inicio: string; fin_previsto: string; ocupado_motivo: string | null; ocupado_obs: string | null; ocupado_desde: string | null;
  relevo_de: string | null; designaciones_previas: string[]; dotacion: Integrante[];
};
export type FueraServicio = { id: number; movil: string; motivo: string; obs: string | null; desde: string };
export type Reserva = { id: number; movil: string; fecha: string; turno: string; motivo: string; obs: string | null; creado_en: string };
export type Designacion = { nombre: string; zona: string | null; unidad: string | null; alias: string[] };

export const ROLES_DOTACION = { chofer: "Chofer", jefe: "Jefe de coche", acompanante: "Acompañante" } as const;
export const MOTIVOS_RESERVA = ["Sin novedad", "Falta de personal", "Rotación del vehículo", "A disposición de la superioridad", "Otro"];

/** Minutos de tolerancia antes del reclamo automático (decidido 2026-11-12). */
export const TOLERANCIA_RELEVO_MIN = 30;

export type Estado = "fuera" | "pendiente" | "ocupado" | "programado" | "servicio" | "reservado" | "sin_agendar" | "prestado";
export const ESTADOS: Record<Estado, { texto: string; clase: string; orden: number }> = {
  pendiente: { texto: "Pendiente de relevo", clase: "atento", orden: 1 },
  sin_agendar: { texto: "Sin agendar", clase: "", orden: 2 },
  ocupado: { texto: "Sigue ocupado", clase: "violeta", orden: 3 },
  servicio: { texto: "En servicio", clase: "ok", orden: 4 },
  programado: { texto: "Agendado (empieza más tarde)", clase: "info", orden: 5 },
  reservado: { texto: "Reservado", clase: "reservado", orden: 6 },
  fuera: { texto: "Fuera de servicio", clase: "mal", orden: 7 },
  prestado: { texto: "Prestado a otra unidad", clase: "", orden: 8 },
};

export function estadoMovil(
  m: Movil, ahora: number,
  abiertos: Map<string, Servicio>, fuera: Map<string, FueraServicio>, reservas: Map<string, Reserva>,
): Estado {
  if (fuera.has(m.id)) return "fuera";
  const s = abiertos.get(m.id);
  if (s) {
    if (s.ocupado_motivo) return "ocupado";
    if (ahora > Date.parse(s.fin_previsto)) return "pendiente";
    if (ahora < Date.parse(s.inicio)) return "programado";
    return "servicio";
  }
  if (reservas.has(m.id)) return "reservado";
  return "sin_agendar";
}

/** Minutos que lleva vencido un servicio (0 si no venció). */
export const minutosVencido = (s: Servicio, ahora: number) => Math.max(0, Math.floor((ahora - Date.parse(s.fin_previsto)) / 60000));

// ---------------------------------------------------------------- organigrama
export function crearArbol(unidades: Unidad[]) {
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const dentro = (u: string | null | undefined, raiz: string) => {
    for (let x = u ? porId.get(u) : undefined; x; x = x.padre ? porId.get(x.padre) : undefined) if (x.id === raiz) return true;
    return false;
  };
  const direccion = (u: string) => {
    for (let x = porId.get(u); x; x = x.padre ? porId.get(x.padre) : undefined) if (x.tipo === "direccion") return x.id;
    return "G";
  };
  const corto = (u: string) => (porId.get(u)?.nombre ?? u).replace("División Territorial", "Div.").replace("Departamento Territorial", "Depto.");
  return { porId, dentro, direccion, corto };
}

// ---------------------------------------------------------------- horarios (Córdoba, UTC-3 todo el año)
const ZONA = "America/Argentina/Cordoba";
const partes = (d: Date) =>
  Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((p) => [p.type, p.value]));
export const hora = (iso: string) => { const p = partes(new Date(iso)); return `${p.hour}:${p.minute}`; };
export const diaHora = (iso: string) => { const p = partes(new Date(iso)); return `${p.day}/${p.month} ${p.hour}:${p.minute} Hs`; };
export const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
export const hoyCordoba = (d = new Date()) => { const p = partes(d); return `${p.year}-${p.month}-${p.day}`; };
const sumarDias = (f: string, n: number) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Guardia que corresponde ahora: 07 a 14 Hs el 1º turno; después, el 2º (que termina a las 07 del día siguiente). */
export function guardiaActual(d = new Date()): { fecha: string; turno: string } {
  const h = Number(partes(d).hour);
  if (h < 7) return { fecha: sumarDias(hoyCordoba(d), -1), turno: "T2" };
  return { fecha: hoyCordoba(d), turno: h < 14 ? "T1" : "T2" };
}
/** Guardia entrante después de un servicio (para proponer en el relevo). */
export function guardiaSiguiente(fecha: string, turno: string): { fecha: string; turno: string } {
  if (turno === "T2") return { fecha: sumarDias(fecha, 1), turno: "T1" };
  return { fecha, turno: "T2" };
}
/** Inicio y fin de una guardia, en ISO. */
export function rangoTurno(fecha: string, t: Turno): [string, string] {
  const ini = new Date(`${fecha}T${t.hora_inicio.slice(0, 5)}:00-03:00`);
  let fin = new Date(`${fecha}T${t.hora_fin.slice(0, 5)}:00-03:00`);
  if (fin <= ini) fin = new Date(fin.getTime() + 864e5);
  return [ini.toISOString(), fin.toISOString()];
}

// ---------------------------------------------------------------- búsqueda tolerante
/** Sin tildes, sin mayúsculas, sin signos: «Pérez, José» y «perez jose» coinciden. */
export const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
export const coincide = (texto: string, q: string) => {
  const t = plano(texto);
  return plano(q).split(" ").every((w) => !w || t.includes(w));
};

// ---------------------------------------------------------------- aptitud (la base vuelve a controlarla al guardar)
export function motivoNoApto(p: Persona | undefined, fecha: string, situaciones: Situacion[]): string | null {
  if (!p) return "No figura en el personal";
  if (!p.activo) return "Dado de baja";
  const s = situaciones.find((x) => x.dni === p.dni && x.desde <= fecha && (!x.hasta || x.hasta >= fecha));
  if (s) return s.tipo + (s.hasta ? ` hasta el ${fechaCorta(s.hasta)}` : "");
  if (!p.calle) return "No es personal de calle";
  return null;
}
export const nombrePersona = (p: Persona) => `${p.jerarquia ? p.jerarquia + " " : ""}${p.apellido}${p.nombre ? ", " + p.nombre : ""}`;
export const textoMovil = (m: Movil) => `${m.interno != null ? "Int. " + m.interno + " · " : ""}${m.dominio}`;

/** ¿Difieren en a lo sumo un carácter (cambiado, de más, de menos o dos vecinos invertidos)? */
export function casiIgual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ra = a.slice(i), rb = b.slice(i);
  return ra.slice(1) === rb.slice(1) || ra.slice(1) === rb || ra === rb.slice(1) || (ra[0] === rb[1] && ra[1] === rb[0] && ra.slice(2) === rb.slice(2));
}
export const compacto = (s: string) => plano(s).replace(/ /g, "");

export const MOTIVOS_BAJA_MOVIL = ["Cargado por error", "Desafectado", "Siniestro total", "Transferido a otra dependencia", "Devuelto", "Otro"];
export const MOTIVOS_BAJA_PERSONA = ["Cargado por error", "Pase a otra dependencia", "Exoneración", "Cesantía", "Retiro", "Renuncia", "Fallecimiento", "Otro"];
export const TIPOS_SITUACION = ["TNO", "Licencia médica", "Licencia anual", "Licencia especial", "Suspensión preventiva", "Otra"];
export const VEHICULOS = ["Sedan", "Pick Up", "Camioneta", "Utilitario", "Moto"];
export const PROGRAMAS = { ojos_en_alerta: "Ojos en Alerta", policial: "Policial" } as const;

export type Cambio = { id: number; accion: string; antes: Record<string, unknown>; despues: Record<string, unknown>; creado_en: string; deshecho: boolean; revierte: number | null; usuario: string | null };

export type Reclamo = {
  id: number; direccion: string; movil: string | null; fecha: string; turno: string; total: number | null; texto: string;
  creado_en: string; resuelto_en: string | null; automatico: boolean;
};
export const NOMBRE_DIRECCION: Record<string, string> = { N: "Norte", S: "Sur", M: "Monitoreo", SUB: "Subdirección", G: "Dirección General" };
/** «hace 1 h 20 min» */
export const hace = (iso: string, ahora = Date.now()) => {
  const m = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export type Prestamo = { id: number; movil: string; origen: string; destino: string; con_dotacion: boolean; obs: string | null; desde: string };
export type PrestamoPersona = { id: number; dni: string; origen: string; destino: string; fecha: string; turno: string; obs: string | null };

export type ReporteFrecuencia = { id: number; texto: string; movil: string | null; direccion: string | null; creado_en: string; resuelto_en: string | null; automatico: boolean };
