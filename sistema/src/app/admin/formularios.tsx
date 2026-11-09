"use client";

import { Campo, Enviar, Formulario, Selector } from "@/components/formulario";
import { ROLES, type Rol } from "@/lib/reglas";
import { aprobar, cambiarAcceso, rechazar, reactivar, suspender } from "./acciones";

export type OpcionUnidad = { valor: string; texto: string; grupo?: string };
const opcionesRol = Object.entries(ROLES).map(([v, t]) => ({ valor: v, texto: t }));

export function FormAprobar({ id, rol, jurisdiccion, unidades }: { id: string; rol: Rol; jurisdiccion: string; unidades: OpcionUnidad[] }) {
  return (
    <Formulario accion={aprobar} className="grid gap-3">
      {(e) => (
        <>
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Selector etiqueta="Rol" nombre="rol" estado={e} opciones={opcionesRol} valor={rol} />
            <Selector etiqueta="Jurisdicción" nombre="jurisdiccion" estado={e} opciones={unidades} valor={jurisdiccion} />
          </div>
          <Enviar className="boton primario" pendiente="Aprobando…">Aprobar cuenta</Enviar>
        </>
      )}
    </Formulario>
  );
}

export function FormRechazar({ id }: { id: string }) {
  return (
    <Formulario accion={rechazar} className="grid gap-3" confirmar="¿Rechazar esta solicitud? Se le avisa por correo.">
      {(e) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Campo etiqueta="Motivo del rechazo" nombre="motivo" estado={e} placeholder="Se le envía por correo" />
          <Enviar className="boton peligro" pendiente="Rechazando…">Rechazar</Enviar>
        </>
      )}
    </Formulario>
  );
}

export function FormAcceso({ id, rol, jurisdiccion, unidades }: { id: string; rol: Rol | null; jurisdiccion: string | null; unidades: OpcionUnidad[] }) {
  return (
    <Formulario accion={cambiarAcceso} className="grid gap-3">
      {(e) => (
        <>
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Selector etiqueta="Rol" nombre="rol" estado={e} opciones={opcionesRol} valor={rol ?? ""} />
            <Selector etiqueta="Jurisdicción" nombre="jurisdiccion" estado={e} opciones={unidades} valor={jurisdiccion ?? ""} />
          </div>
          <Enviar className="boton primario" pendiente="Guardando…">Guardar rol y jurisdicción</Enviar>
        </>
      )}
    </Formulario>
  );
}

export function FormSuspender({ id }: { id: string }) {
  return (
    <Formulario accion={suspender} className="grid gap-3" confirmar="¿Suspender esta cuenta? Se corta su sesión y se le avisa por correo.">
      {(e) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Campo etiqueta="Motivo de la suspensión" nombre="motivo" estado={e} placeholder="Se le envía por correo" />
          <Enviar className="boton peligro" pendiente="Suspendiendo…">Suspender cuenta</Enviar>
        </>
      )}
    </Formulario>
  );
}

export function FormReactivar({ id }: { id: string }) {
  return (
    <Formulario accion={reactivar} confirmar="¿Reactivar esta cuenta?">
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <Enviar className="boton primario" pendiente="Reactivando…">Reactivar cuenta</Enviar>
        </>
      )}
    </Formulario>
  );
}
