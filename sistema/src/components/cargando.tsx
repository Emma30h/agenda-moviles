"use client";

/** Círculo que gira: indica que algo se está cargando o guardando. */
export function Spinner({ grande = false }: { grande?: boolean }) {
  return <span className={`spinner ${grande ? "grande" : ""}`} aria-hidden />;
}

/** Aviso flotante arriba de la pantalla mientras se procesa una acción. */
export function Procesando({ activo, texto = "Procesando…" }: { activo: boolean; texto?: string }) {
  if (!activo) return null;
  return (
    <div className="procesando" role="status" aria-live="polite">
      <Spinner /> {texto}
    </div>
  );
}
