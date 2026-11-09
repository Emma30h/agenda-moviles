import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { clienteSesion, supabaseConfigurado } from "@/lib/supabase/servidor";
import type { Estado, Rol } from "@/lib/reglas";

export type Perfil = {
  id: string;
  dni: string;
  apellido: string;
  nombre: string;
  jerarquia: string;
  correo: string;
  dependencia: string;
  rol: Rol | null;
  rol_pedido: Rol;
  jurisdiccion: string | null;
  estado: Estado;
  motivo: string | null;
};

/**
 * Lee la sesión desde Supabase en cada pedido (verifica el token, no solo la cookie)
 * y trae el perfil. Se memoriza durante un mismo render.
 */
export const leerSesion = cache(async (): Promise<{ perfil: Perfil | null }> => {
  // Leer las cookies obliga a que toda página protegida se arme en cada pedido y nunca quede guardada como estática
  await cookies();
  if (!supabaseConfigurado()) return { perfil: null };
  const supabase = await clienteSesion();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { perfil: null };
  const { data: perfil } = await supabase
    .from("perfil")
    .select("id,dni,apellido,nombre,jerarquia,correo,dependencia,rol,rol_pedido,jurisdiccion,estado,motivo")
    .eq("id", data.user.id)
    .maybeSingle();
  return { perfil: (perfil as Perfil) ?? null };
});

/** Exige una cuenta aprobada. Si no la hay, manda al ingreso o al aviso de cuenta pendiente. */
export async function exigirActivo(): Promise<Perfil> {
  const { perfil } = await leerSesion();
  if (!perfil) redirect("/ingresar");
  if (perfil.estado !== "activo") redirect("/cuenta");
  return perfil;
}

export async function exigirSuperadmin(): Promise<Perfil> {
  const perfil = await exigirActivo();
  if (perfil.rol !== "superadmin") redirect("/");
  return perfil;
}
