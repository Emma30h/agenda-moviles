import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave service_role: salta las reglas de seguridad.
 * Solo se usa en el servidor y SIEMPRE después de verificar quién pide la acción.
 */
export function clienteAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
