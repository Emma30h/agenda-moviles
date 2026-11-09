export const NOMBRE_EVENTO: Record<string, string> = {
  solicitud: "Pidió una cuenta",
  correo_verificado: "Confirmó su correo",
  aprobacion: "Cuenta aprobada",
  rechazo: "Solicitud rechazada",
  ingreso: "Ingresó",
  ingreso_fallido: "Intento de ingreso fallido",
  bloqueo: "Bloqueo por intentos",
  salida: "Salió",
  recuperacion: "Pidió recuperar la contraseña",
  cambio_contrasena: "Cambió la contraseña",
  cambio_rol: "Cambio de rol o jurisdicción",
  suspension: "Cuenta suspendida",
  reactivacion: "Cuenta reactivada",
};
export const CLASE_EVENTO: Record<string, string> = {
  ingreso_fallido: "mal", bloqueo: "mal", suspension: "mal", rechazo: "mal",
  ingreso: "ok", aprobacion: "ok", reactivacion: "ok", cambio_contrasena: "info", cambio_rol: "info",
};
