"use server";

import { redirect } from "next/navigation";
import { clienteSesion, supabaseConfigurado } from "@/lib/supabase/servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { bloqueado, limpiarIntentos, registrar, sumarIntento } from "@/lib/auditoria";
import { claveValida, esquemaSolicitud, leerIdentificador, ROLES, type EstadoFormulario } from "@/lib/reglas";

const SIN_SUPABASE: EstadoFormulario = { error: "El sistema todavía no está conectado a Supabase. Completá el archivo .env.local." };
const GENERICO = "Correo, DNI o contraseña incorrectos.";
const BLOQUEO = "Demasiados intentos. Esperá 15 minutos o recuperá tu contraseña.";

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const rutaSegura = (r: string) => (r.startsWith("/") && !r.startsWith("//") ? r : "/");

/** Busca el correo de una cuenta por DNI. El correo nunca vuelve a la pantalla. */
async function correoDe(id: { tipo: "dni" | "correo"; valor: string }): Promise<string | null> {
  if (id.tipo === "correo") return id.valor;
  const { data } = await clienteAdmin().from("perfil").select("correo").eq("dni", id.valor).maybeSingle();
  return data?.correo ?? null;
}

// ---------------------------------------------------------------- solicitar cuenta
export async function solicitarCuenta(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  if (!supabaseConfigurado()) return SIN_SUPABASE;
  const crudo = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const valores = Object.fromEntries(Object.entries(crudo).filter(([k]) => k !== "clave" && k !== "clave2"));
  const r = esquemaSolicitud.safeParse(crudo);
  if (!r.success) {
    const errores: Record<string, string> = {};
    for (const i of r.error.issues) errores[String(i.path[0])] ??= i.message;
    return { error: "Revisá los datos marcados.", errores, valores };
  }
  const d = r.data;
  const db = clienteAdmin();

  const { data: unidades } = await db.from("unidad").select("id").in("id", [d.dependencia, d.jurisdiccion_pedida]);
  if (new Set(unidades?.map((u) => u.id)).size !== new Set([d.dependencia, d.jurisdiccion_pedida]).size) {
    return { error: "La dependencia o la jurisdicción no son válidas.", valores };
  }
  const [porDni, porCorreo] = await Promise.all([
    db.from("perfil").select("id").eq("dni", d.dni).maybeSingle(),
    db.from("perfil").select("id").eq("correo", d.correo).maybeSingle(),
  ]);
  const errores: Record<string, string> = {};
  if (porDni.data) errores.dni = "Ese DNI ya tiene una cuenta. Si no recordás la contraseña, usá «Olvidé mi contraseña».";
  if (porCorreo.data) errores.correo = "Ese correo ya tiene una cuenta.";
  if (Object.keys(errores).length) return { error: "Ya hay una cuenta con esos datos.", errores, valores };

  const supabase = await clienteSesion();
  const { data, error } = await supabase.auth.signUp({
    email: d.correo,
    password: d.clave,
    options: {
      data: {
        dni: d.dni, apellido: d.apellido, nombre: d.nombre, jerarquia: d.jerarquia, telefono: d.telefono,
        dependencia: d.dependencia, rol_pedido: d.rol_pedido, jurisdiccion_pedida: d.jurisdiccion_pedida,
      },
    },
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("already")) return { error: "Ese correo ya tiene una cuenta.", errores: { correo: "Ese correo ya tiene una cuenta." }, valores };
    if (m.includes("rate")) return { error: "Se enviaron demasiados correos. Probá de nuevo en unos minutos.", valores };
    if (m.includes("password")) return { error: "La contraseña no es aceptada. Probá con otra más larga.", valores };
    console.error("[solicitarCuenta]", error);
    return { error: "No se pudo crear la solicitud. Intentá de nuevo.", valores };
  }
  await registrar("solicitud", { usuario: data.user?.id ?? null, identificador: d.correo, detalle: `Pide el rol ${ROLES[d.rol_pedido]}` });
  redirect(`/verificar?correo=${encodeURIComponent(d.correo)}`);
}

// ---------------------------------------------------------------- confirmar el correo
export async function verificarCorreo(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  if (!supabaseConfigurado()) return SIN_SUPABASE;
  const correo = texto(fd, "correo").trim().toLowerCase();
  const codigo = texto(fd, "codigo").replace(/\D/g, "");
  if (!/^[0-9]{6,10}$/.test(codigo)) return { error: "Escribí el código de números que te llegó." };
  const clave = "ver:" + correo;
  if (await bloqueado(clave)) return { error: BLOQUEO };
  const supabase = await clienteSesion();
  let { error } = await supabase.auth.verifyOtp({ email: correo, token: codigo, type: "email" });
  if (error) ({ error } = await supabase.auth.verifyOtp({ email: correo, token: codigo, type: "signup" }));
  if (error) {
    await sumarIntento(clave);
    return { error: "El código no es correcto o ya venció. Podés pedir uno nuevo." };
  }
  await limpiarIntentos(clave);
  redirect("/cuenta");
}

export async function reenviarCodigo(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  if (!supabaseConfigurado()) return SIN_SUPABASE;
  const correo = texto(fd, "correo").trim().toLowerCase();
  const clave = "env:" + correo;
  if (await bloqueado(clave)) return { error: "Ya pediste varios códigos. Esperá 15 minutos." };
  await sumarIntento(clave);
  const supabase = await clienteSesion();
  await supabase.auth.resend({ type: "signup", email: correo });
  return { ok: "Si el correo está pendiente de confirmar, te enviamos un código nuevo." };
}

// ---------------------------------------------------------------- ingresar
export async function ingresar(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  if (!supabaseConfigurado()) return SIN_SUPABASE;
  const escrito = texto(fd, "identificador");
  const valores = { identificador: escrito };
  const id = leerIdentificador(escrito);
  if (!id) return { error: "Escribí tu correo o tu DNI (solo números).", valores };
  const clave = "ing:" + id.valor;
  if (await bloqueado(clave)) {
    await registrar("bloqueo", { identificador: id.valor });
    return { error: BLOQUEO, valores };
  }
  const correo = await correoDe(id);
  if (!correo) {
    await sumarIntento(clave);
    await registrar("ingreso_fallido", { identificador: id.valor, detalle: "Sin cuenta" });
    return { error: GENERICO, valores };
  }
  const supabase = await clienteSesion();
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: texto(fd, "clave") });
  if (error) {
    // Contraseña correcta pero correo sin confirmar: es el dueño de la cuenta, se lo manda a confirmar
    if (error.code === "email_not_confirmed") redirect(`/verificar?correo=${encodeURIComponent(correo)}`);
    await sumarIntento(clave);
    await registrar("ingreso_fallido", { identificador: id.valor, detalle: error.code ?? "credenciales" });
    return { error: GENERICO, valores };
  }
  await limpiarIntentos(clave);
  await registrar("ingreso", { usuario: data.user.id, identificador: id.valor });
  redirect(rutaSegura(texto(fd, "volver")));
}

export async function salir() {
  const supabase = await clienteSesion();
  const { data } = await supabase.auth.getUser();
  if (data.user) await registrar("salida", { usuario: data.user.id });
  await supabase.auth.signOut();
  redirect("/ingresar");
}

// ---------------------------------------------------------------- recuperar la contraseña
export async function pedirRecuperacion(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  if (!supabaseConfigurado()) return SIN_SUPABASE;
  const escrito = texto(fd, "identificador");
  const id = leerIdentificador(escrito);
  if (!id) return { error: "Escribí tu correo o tu DNI (solo números).", valores: { identificador: escrito } };
  const clave = "rec:" + id.valor;
  if (await bloqueado(clave)) return { error: "Ya pediste varios códigos. Esperá 15 minutos." };
  await sumarIntento(clave);
  const correo = await correoDe(id);
  if (correo) {
    const supabase = await clienteSesion();
    const { error } = await supabase.auth.resetPasswordForEmail(correo);
    if (error) console.error("[pedirRecuperacion]", error.message);
    await registrar("recuperacion", { identificador: id.valor });
  }
  // La respuesta es la misma exista o no la cuenta
  redirect(`/recuperar/codigo?id=${encodeURIComponent(id.valor)}`);
}

export async function restablecerClave(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  if (!supabaseConfigurado()) return SIN_SUPABASE;
  const id = leerIdentificador(texto(fd, "identificador"));
  const codigo = texto(fd, "codigo").replace(/\D/g, "");
  const nueva = texto(fd, "clave");
  if (!id) return { error: "Volvé a empezar desde «Olvidé mi contraseña»." };
  if (!/^[0-9]{6,10}$/.test(codigo)) return { error: "Escribí el código de números que te llegó.", errores: { codigo: "Falta el código" } };
  if (!claveValida(nueva)) return { error: "La contraseña nueva no cumple los requisitos.", errores: { clave: "No cumple los requisitos" } };
  if (nueva !== texto(fd, "clave2")) return { error: "Las contraseñas no coinciden.", errores: { clave2: "No coincide" } };
  const clave = "cod:" + id.valor;
  if (await bloqueado(clave)) return { error: "Demasiados intentos con códigos. Pedí uno nuevo dentro de 15 minutos." };

  const correo = await correoDe(id);
  const supabase = await clienteSesion();
  const { error } = correo
    ? await supabase.auth.verifyOtp({ email: correo, token: codigo, type: "recovery" })
    : { error: new Error("sin cuenta") };
  if (error) {
    await sumarIntento(clave);
    return { error: "El código no es correcto o ya venció.", errores: { codigo: "Código incorrecto o vencido" } };
  }
  const cambio = await supabase.auth.updateUser({ password: nueva });
  if (cambio.error) {
    const igual = cambio.error.message.toLowerCase().includes("different");
    return { error: igual ? "La contraseña nueva tiene que ser distinta de la anterior." : "No se pudo cambiar la contraseña. Intentá de nuevo." };
  }
  // Se cierran las sesiones abiertas en otras computadoras
  await supabase.auth.signOut({ scope: "others" });
  await limpiarIntentos(clave);
  await limpiarIntentos("ing:" + id.valor);
  await registrar("cambio_contrasena", { usuario: cambio.data.user?.id ?? null, identificador: id.valor });
  redirect("/?clave=ok");
}
