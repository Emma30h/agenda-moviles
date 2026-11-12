"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Tiempo real: cuando alguien carga algo en esas tablas, la pantalla se vuelve a pedir sola.
 * Devuelve si la conexión está activa. Hay un refresco de respaldo cada 2 minutos.
 */
export function useEnVivo(tablas: string[], canal: string) {
  const router = useRouter();
  const [conectado, setConectado] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clave = tablas.join(",");
  useEffect(() => {
    const sb = clienteNavegador();
    const refrescar = () => {
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => router.refresh(), 400);
    };
    let ch: ReturnType<typeof sb.channel> | null = null;
    let vivo = true;
    // Primero la sesión: sin el token, la base trata la conexión como anónima y no manda cambios (RLS)
    sb.auth.getSession().then(async ({ data }: { data: { session: { access_token: string } | null } }) => {
      if (!vivo) return;
      if (data.session) await sb.realtime.setAuth(data.session.access_token);
      ch = sb.channel(canal);
      for (const tabla of clave.split(",")) ch = ch.on("postgres_changes", { event: "*", schema: "public", table: tabla }, refrescar);
      ch.subscribe((estado: string, err?: Error) => {
        setConectado(estado === "SUBSCRIBED" && !!data.session);
        if (estado !== "SUBSCRIBED") console.warn("[en vivo]", estado, err?.message ?? "", data.session ? "con sesión" : "sin sesión");
      });
    });
    const t = setInterval(() => router.refresh(), 120_000);
    return () => { vivo = false; clearInterval(t); if (ch) sb.removeChannel(ch); };
  }, [router, clave, canal]);
  return conectado;
}

/** Hora actual que se actualiza cada 30 segundos (para recalcular vencidos sin recargar). */
export function useAhora() {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}
