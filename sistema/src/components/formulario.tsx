"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { REQUISITOS_CLAVE, type EstadoFormulario } from "@/lib/reglas";

type Accion = (prev: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;

/** Formulario que llama a una Server Action y muestra el error o el aviso que devuelve. */
export function Formulario({
  accion,
  children,
  className,
  confirmar,
}: {
  accion: Accion;
  children: (estado: EstadoFormulario) => ReactNode;
  className?: string;
  confirmar?: string;
}) {
  const [estado, formAction] = useActionState(accion, {});
  return (
    <form
      action={formAction}
      className={className}
      noValidate
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {estado.error && (
        <div className="aviso mal mb-4" role="alert">
          {estado.error}
        </div>
      )}
      {estado.ok && (
        <div className="aviso ok mb-4" role="status">
          {estado.ok}
        </div>
      )}
      {children(estado)}
    </form>
  );
}

export function Enviar({ children, className = "boton primario ancho", pendiente = "Procesando…" }: { children: ReactNode; className?: string; pendiente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendiente : children}
    </button>
  );
}

export function Campo({
  etiqueta,
  nombre,
  estado,
  ayuda,
  ...props
}: { etiqueta: string; nombre: string; estado?: EstadoFormulario; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const error = estado?.errores?.[nombre];
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <input
        className="entrada"
        name={nombre}
        defaultValue={estado?.valores?.[nombre]}
        aria-invalid={!!error}
        {...props}
      />
      {error ? <div className="ayuda mal">{error}</div> : ayuda ? <div className="ayuda">{ayuda}</div> : null}
    </label>
  );
}

export function Selector({
  etiqueta,
  nombre,
  estado,
  opciones,
  valor,
  ayuda,
  onChange,
}: {
  etiqueta: string;
  nombre: string;
  estado?: EstadoFormulario;
  opciones: { valor: string; texto: string; grupo?: string }[];
  valor?: string;
  ayuda?: string;
  onChange?: (v: string) => void;
}) {
  const error = estado?.errores?.[nombre];
  const grupos = [...new Set(opciones.map((o) => o.grupo ?? ""))];
  const props = onChange ? { value: valor ?? "", onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) } : { defaultValue: estado?.valores?.[nombre] ?? valor ?? "" };
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <select className="entrada" name={nombre} aria-invalid={!!error} {...props}>
        <option value="">Elegí una opción</option>
        {grupos.map((g) =>
          g ? (
            <optgroup key={g} label={g}>
              {opciones.filter((o) => o.grupo === g).map((o) => (
                <option key={o.valor} value={o.valor}>{o.texto}</option>
              ))}
            </optgroup>
          ) : (
            opciones.filter((o) => !o.grupo).map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)
          ),
        )}
      </select>
      {error ? <div className="ayuda mal">{error}</div> : ayuda ? <div className="ayuda">{ayuda}</div> : null}
    </label>
  );
}

/** Contraseña con botón para mostrarla y, si se pide, la lista de requisitos marcándose en vivo. */
export function CampoClave({ etiqueta, nombre, estado, requisitos, autoComplete }: { etiqueta: string; nombre: string; estado?: EstadoFormulario; requisitos?: boolean; autoComplete: string }) {
  const [ver, setVer] = useState(false);
  const [valor, setValor] = useState("");
  const error = estado?.errores?.[nombre];
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <div className="relative">
        <input
          className="entrada pr-20"
          type={ver ? "text" : "password"}
          name={nombre}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <button type="button" onClick={() => setVer((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-tenue px-2 py-1 rounded hover:text-texto" aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}>
          {ver ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {error && <div className="ayuda mal">{error}</div>}
      {requisitos && (
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
          {REQUISITOS_CLAVE.map((r) => {
            const ok = r.ok(valor);
            return (
              <li key={r.id} style={{ color: ok ? "var(--ok)" : "var(--muted)" }}>
                {ok ? "✓" : "○"} {r.texto}
              </li>
            );
          })}
        </ul>
      )}
    </label>
  );
}
