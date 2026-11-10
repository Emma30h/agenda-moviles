import { z } from "zod";

export const ROLES = {
  superadmin: "Super Admin",
  general: "Administrador General",
  cargador: "Cargador",
  supervisor: "Supervisor",
  jefe_calle: "Jefe de calle",
  monitoreo: "Monitoreo",
} as const;
export type Rol = keyof typeof ROLES;
export const ROLES_PEDIBLES = ["cargador", "supervisor", "jefe_calle", "monitoreo", "general"] as const;

export const ESTADOS = {
  verificando: "Falta confirmar el correo",
  en_revision: "En revisión",
  activo: "Activa",
  rechazado: "Rechazada",
  suspendido: "Suspendida",
} as const;
export type Estado = keyof typeof ESTADOS;

/** Tipos de personal (mismos que la app de Personal de la D.M.C.A). */
export const TIPOS_PERSONAL = {
  seguridad: "Seguridad",
  tecnico: "Técnico",
  civil_policial: "Civil Policial",
  civil_becario: "Civil Becario",
} as const;
export type TipoPersonal = keyof typeof TIPOS_PERSONAL;
export const TIPOS_PERSONAL_IDS = Object.keys(TIPOS_PERSONAL) as [TipoPersonal, ...TipoPersonal[]];

export const JERARQUIAS_SUBOFICIAL = [
  "Agente", "Cabo", "Cabo Primero", "Sargento", "Sargento Primero", "Sargento Ayudante", "Suboficial Principal", "Suboficial Mayor",
];
export const JERARQUIAS_OFICIAL = [
  "Oficial Ayudante", "Oficial Subinspector", "Oficial Inspector", "Oficial Principal",
  "Subcomisario", "Comisario", "Comisario Inspector", "Comisario Mayor", "Comisario General",
];

/** Seguridad: suboficiales y oficiales · Técnico: solo las de suboficial · Civiles: sin jerarquía. */
export function jerarquiasDe(tipo: string): { grupo: string; lista: string[] }[] {
  if (tipo === "seguridad") return [{ grupo: "Suboficiales", lista: JERARQUIAS_SUBOFICIAL }, { grupo: "Oficiales", lista: JERARQUIAS_OFICIAL }];
  if (tipo === "tecnico") return [{ grupo: "Suboficiales", lista: JERARQUIAS_SUBOFICIAL }];
  return [];
}
export const llevaJerarquia = (tipo: string) => tipo === "seguridad" || tipo === "tecnico";

/** "Sargento Pérez, Juan" o, si es civil, "Pérez, Juan". */
export const nombreCompleto = (p: { jerarquia: string | null; apellido: string; nombre: string }) =>
  `${p.jerarquia ? p.jerarquia + " " : ""}${p.apellido}, ${p.nombre}`;

/** Requisitos de contraseña: se muestran en pantalla y se validan en el servidor. */
export const REQUISITOS_CLAVE = [
  { id: "largo", texto: "Al menos 10 caracteres", ok: (s: string) => s.length >= 10 },
  { id: "mayus", texto: "Una mayúscula", ok: (s: string) => /[A-ZÁÉÍÓÚÑ]/.test(s) },
  { id: "minus", texto: "Una minúscula", ok: (s: string) => /[a-záéíóúñ]/.test(s) },
  { id: "numero", texto: "Un número", ok: (s: string) => /[0-9]/.test(s) },
  // Coincide con "Lowercase, uppercase letters, digits and symbols" de Supabase
  { id: "simbolo", texto: "Un símbolo (! # @ $ …)", ok: (s: string) => /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(s) },
];
export const claveValida = (s: string) => REQUISITOS_CLAVE.every((r) => r.ok(s));

const soloDigitos = (s: string) => s.replace(/\D/g, "");

export const esquemaSolicitud = z
  .object({
    apellido: z.string().trim().min(2, "Escribí tu apellido").max(80),
    nombre: z.string().trim().min(2, "Escribí tu nombre").max(80),
    dni: z.string().transform(soloDigitos).refine((s) => /^[0-9]{7,8}$/.test(s), "El DNI tiene que tener 7 u 8 números"),
    tipo_personal: z.enum(TIPOS_PERSONAL_IDS, { errorMap: () => ({ message: "Elegí el tipo de personal" }) }),
    jerarquia: z.string().optional().default(""),
    telefono: z.string().trim().max(30).optional().default(""),
    correo: z.string().trim().toLowerCase().email("Revisá el correo"),
    dependencia: z.string().min(1, "Elegí tu dependencia"),
    rol_pedido: z.enum(ROLES_PEDIBLES, { errorMap: () => ({ message: "Elegí el rol que necesitás" }) }),
    jurisdiccion_pedida: z.string().min(1, "Elegí la jurisdicción"),
    clave: z.string().refine(claveValida, "La contraseña no cumple los requisitos"),
    clave2: z.string(),
  })
  .refine((d) => d.clave === d.clave2, { message: "Las contraseñas no coinciden", path: ["clave2"] })
  .refine((d) => !llevaJerarquia(d.tipo_personal) || jerarquiasDe(d.tipo_personal).some((g) => g.lista.includes(d.jerarquia)), {
    message: "Elegí tu jerarquía", path: ["jerarquia"],
  })
  // Los civiles no tienen jerarquía: se guarda vacía aunque llegue algo
  .transform((d) => ({ ...d, jerarquia: llevaJerarquia(d.tipo_personal) ? d.jerarquia : "" }));

/** Normaliza lo que se escribe para ingresar: un DNI (solo números) o un correo. */
export function leerIdentificador(texto: string): { tipo: "dni" | "correo"; valor: string } | null {
  const t = texto.trim();
  const d = soloDigitos(t);
  if (/^[0-9.\s-]+$/.test(t) && /^[0-9]{7,8}$/.test(d)) return { tipo: "dni", valor: d };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { tipo: "correo", valor: t.toLowerCase() };
  return null;
}

export type EstadoFormulario = {
  error?: string;
  errores?: Record<string, string>;
  ok?: string;
  valores?: Record<string, string>;
};
