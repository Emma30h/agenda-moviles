import "server-only";
import type { Perfil } from "@/lib/dal";

/** Supabase devuelve como máximo 1000 filas por pedido: se piden por tandas. */
export async function todo<T>(pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const salida: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await pedir(i, i + 999);
    if (error) throw error;
    salida.push(...(data ?? []));
    if (!data || data.length < 1000) return salida;
  }
}

/** Qué parte del organigrama ve y cuál puede editar cada rol. */
export function alcance(perfil: Perfil) {
  const todoVe = !!perfil.rol && ["superadmin", "general", "monitoreo"].includes(perfil.rol);
  const raiz = todoVe ? "G" : (perfil.jurisdiccion ?? "G");
  const raizEdita = perfil.rol === "superadmin" || perfil.rol === "general" ? "G" : perfil.rol === "cargador" ? (perfil.jurisdiccion ?? null) : null;
  return { raiz, raizEdita };
}
