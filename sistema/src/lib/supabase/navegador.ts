"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente del navegador: solo se usa para escuchar los cambios en tiempo real. */
let cliente: ReturnType<typeof createBrowserClient> | null = null;
export function clienteNavegador() {
  cliente ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return cliente;
}
