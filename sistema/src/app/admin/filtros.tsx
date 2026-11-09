import Link from "next/link";

/** Lee un filtro de varias opciones desde la URL (?estado=activo,suspendido). */
export const leerLista = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v.join(",") : v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Botones de filtro de selección múltiple: dentro del filtro se suman, entre filtros se combinan.
 * Cada botón es un enlace, así el filtro queda en la dirección y se puede compartir o recargar.
 */
export function FiltroChips({
  ruta,
  clave,
  opciones,
  params,
}: {
  ruta: string;
  clave: string;
  opciones: { valor: string; texto: string; cantidad?: number }[];
  params: Record<string, string | string[] | undefined>;
}) {
  const sel = leerLista(params[clave]);
  const url = (lista: string[]) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (k !== clave && v) p.set(k, Array.isArray(v) ? v.join(",") : v);
    if (lista.length) p.set(clave, lista.join(","));
    const q = p.toString();
    return q ? `${ruta}?${q}` : ruta;
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={url([])} className={`chip ${!sel.length ? "on" : ""}`}>Todos</Link>
      {opciones.map((o) => {
        const on = sel.includes(o.valor);
        return (
          <Link key={o.valor} href={url(on ? sel.filter((s) => s !== o.valor) : [...sel, o.valor])} className={`chip ${on ? "on" : ""}`} aria-pressed={on}>
            {o.texto}
            {o.cantidad != null && <b className="ml-1.5">{o.cantidad}</b>}
          </Link>
        );
      })}
    </div>
  );
}
