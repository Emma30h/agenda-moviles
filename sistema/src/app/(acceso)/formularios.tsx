"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Campo, CampoClave, Enviar, Formulario, Selector } from "@/components/formulario";
import { jerarquiasDe, llevaJerarquia, ROLES, ROLES_PEDIBLES, TIPOS_PERSONAL } from "@/lib/reglas";
import { ingresar, pedirRecuperacion, reenviarCodigo, restablecerClave, solicitarCuenta, verificarCorreo } from "./acciones";

export type Unidad = { id: string; nombre: string; tipo: string; padre: string | null; orden: number };

// ---------------------------------------------------------------- ingresar
export function FormIngresar({ volver }: { volver: string }) {
  return (
    <Formulario accion={ingresar} className="grid gap-4">
      {(e) => (
        <>
          <input type="hidden" name="volver" value={volver} />
          <Campo etiqueta="Correo o DNI" nombre="identificador" estado={e} autoComplete="username" inputMode="email" autoFocus required ayuda="El DNI va sin puntos." />
          <CampoClave etiqueta="Contraseña" nombre="clave" estado={e} autoComplete="current-password" />
          <div className="text-right -mt-2 text-sm">
            <Link href="/recuperar">Olvidé mi contraseña</Link>
          </div>
          <Enviar pendiente="Ingresando…">Ingresar</Enviar>
        </>
      )}
    </Formulario>
  );
}

// ---------------------------------------------------------------- solicitar cuenta
const DESC_ROL: Record<string, string> = {
  cargador: "Carga la agenda y el personal de su Dirección.",
  supervisor: "Ve los móviles agendados en su jurisdicción.",
  jefe_calle: "Ve los móviles agendados en su jurisdicción.",
  monitoreo: "Consulta y verifica móviles escuchados en frecuencia.",
  general: "Administra los móviles de todas las Direcciones.",
};

export function FormSolicitud({ unidades }: { unidades: Unidad[] }) {
  const porId = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u])), [unidades]);
  const direccionDe = (id: string): string => {
    let u = porId[id];
    while (u && u.tipo !== "direccion" && u.padre) u = porId[u.padre];
    return u?.tipo === "direccion" ? u.id : "";
  };
  const etiquetaGrupo = (u: Unidad) => {
    const d = direccionDe(u.id);
    return d ? porId[d].nombre.replace("Dirección ", "") : "General";
  };
  const opciones = unidades
    .filter((u) => u.tipo !== "general")
    .map((u) => ({ valor: u.id, texto: (u.tipo === "division" ? "— " : u.tipo === "departamento" ? "· " : "") + u.nombre, grupo: etiquetaGrupo(u) }));
  const [tipo, setTipo] = useState("");
  const [dependencia, setDependencia] = useState("");
  const [rol, setRol] = useState<string>("cargador");
  const [jurisdiccion, setJurisdiccion] = useState("");
  const sugerida = rol === "cargador" ? direccionDe(dependencia) : rol === "general" ? "G" : dependencia;

  return (
    <Formulario accion={solicitarCuenta} className="grid gap-5">
      {(e) => (
        <>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold mb-2">Datos personales</legend>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Campo etiqueta="Apellido" nombre="apellido" estado={e} autoComplete="family-name" required />
              <Campo etiqueta="Nombre" nombre="nombre" estado={e} autoComplete="given-name" required />
            </div>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Campo etiqueta="DNI" nombre="dni" estado={e} inputMode="numeric" maxLength={11} required ayuda="Sin puntos. También te sirve para ingresar." />
              <Campo etiqueta="Teléfono (opcional)" nombre="telefono" estado={e} type="tel" autoComplete="tel" />
            </div>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1 items-start">
              <Selector
                etiqueta="Tipo de personal"
                nombre="tipo_personal"
                estado={e}
                opciones={Object.entries(TIPOS_PERSONAL).map(([valor, texto]) => ({ valor, texto }))}
                valor={tipo}
                onChange={setTipo}
              />
              {llevaJerarquia(tipo) ? (
                <Selector
                  key={tipo}
                  etiqueta="Jerarquía"
                  nombre="jerarquia"
                  estado={e}
                  opciones={jerarquiasDe(tipo).flatMap((g) => g.lista.map((j) => ({ valor: j, texto: j, grupo: g.grupo })))}
                  ayuda={tipo === "tecnico" ? "El personal técnico usa las jerarquías de suboficial." : undefined}
                />
              ) : (
                <div className="campo">
                  <span>Jerarquía</span>
                  <div className="entrada text-tenue">{tipo ? "No corresponde (personal civil)" : "Elegí primero el tipo de personal"}</div>
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold mb-2">Acceso que necesitás</legend>
            <Selector etiqueta="Dependencia donde prestás servicio" nombre="dependencia" estado={e} opciones={opciones} valor={dependencia} onChange={(v) => { setDependencia(v); setJurisdiccion(""); }} />
            <div className="grid gap-2" role="radiogroup" aria-label="Rol">
              <span className="text-[13px] text-tenue">Rol</span>
              {ROLES_PEDIBLES.map((r) => (
                <label key={r} className={`tarjeta flex gap-3 items-start p-3 cursor-pointer ${rol === r ? "ring-2 ring-acento" : ""}`}>
                  <input type="radio" name="rol_pedido" value={r} checked={rol === r} onChange={() => { setRol(r); setJurisdiccion(""); }} className="mt-1" />
                  <span>
                    <b className="text-sm">{ROLES[r]}</b>
                    <span className="block text-[12.5px] text-tenue">{DESC_ROL[r]}</span>
                  </span>
                </label>
              ))}
              {e.errores?.rol_pedido && <div className="ayuda mal">{e.errores.rol_pedido}</div>}
            </div>
            <Selector
              etiqueta="Jurisdicción"
              nombre="jurisdiccion_pedida"
              estado={e}
              opciones={[{ valor: "G", texto: "Toda la Dirección General", grupo: "General" }, ...opciones]}
              valor={jurisdiccion || sugerida}
              onChange={setJurisdiccion}
              ayuda="Qué parte vas a ver o cargar. El Super Admin la confirma al aprobar tu cuenta."
            />
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold mb-2">Cuenta</legend>
            <Campo etiqueta="Correo electrónico" nombre="correo" estado={e} type="email" autoComplete="email" required ayuda="Te vamos a enviar un código para confirmarlo." />
            <CampoClave etiqueta="Contraseña" nombre="clave" estado={e} requisitos autoComplete="new-password" />
            <CampoClave etiqueta="Repetí la contraseña" nombre="clave2" estado={e} autoComplete="new-password" />
          </fieldset>

          <Enviar pendiente="Enviando solicitud…">Solicitar cuenta</Enviar>
        </>
      )}
    </Formulario>
  );
}

// ---------------------------------------------------------------- confirmar el correo
export function FormVerificar({ correo }: { correo: string }) {
  return (
    <div className="grid gap-4">
      <Formulario accion={verificarCorreo} className="grid gap-4">
        {(e) => (
          <>
            <input type="hidden" name="correo" value={correo} />
            <Campo etiqueta="Código" nombre="codigo" estado={e} inputMode="numeric" autoComplete="one-time-code" maxLength={10} autoFocus className="entrada text-center text-xl tracking-[0.4em]" />
            <Enviar pendiente="Verificando…">Confirmar correo</Enviar>
          </>
        )}
      </Formulario>
      <Formulario accion={reenviarCodigo}>
        {() => (
          <>
            <input type="hidden" name="correo" value={correo} />
            <Enviar className="boton ancho" pendiente="Enviando…">Enviar un código nuevo</Enviar>
          </>
        )}
      </Formulario>
    </div>
  );
}

// ---------------------------------------------------------------- recuperar la contraseña
export function FormRecuperar() {
  return (
    <Formulario accion={pedirRecuperacion} className="grid gap-4">
      {(e) => (
        <>
          <Campo etiqueta="Correo o DNI" nombre="identificador" estado={e} autoComplete="username" autoFocus required />
          <Enviar pendiente="Enviando…">Enviarme un código</Enviar>
        </>
      )}
    </Formulario>
  );
}

export function FormRestablecer({ identificador }: { identificador: string }) {
  return (
    <Formulario accion={restablecerClave} className="grid gap-4">
      {(e) => (
        <>
          <input type="hidden" name="identificador" value={identificador} />
          <Campo etiqueta="Código" nombre="codigo" estado={e} inputMode="numeric" autoComplete="one-time-code" maxLength={10} autoFocus className="entrada text-center text-xl tracking-[0.4em]" />
          <CampoClave etiqueta="Contraseña nueva" nombre="clave" estado={e} requisitos autoComplete="new-password" />
          <CampoClave etiqueta="Repetí la contraseña nueva" nombre="clave2" estado={e} autoComplete="new-password" />
          <Enviar pendiente="Guardando…">Cambiar contraseña</Enviar>
        </>
      )}
    </Formulario>
  );
}
