# App Agenda de Móviles

Dirección General de Policía Territorial y Proximidad.

**Objetivo:** que los administradores vean en tiempo real qué móviles y qué personal están disponibles, dónde presta servicio cada uno (Norte o Sur) y qué móviles faltan agendarse. Todos trabajan con los mismos números.

## Contenido

| Archivo | Qué es |
|---|---|
| `prototipo/index.html` | Prototipo navegable con datos ficticios. |
| `Modelo de datos.md` | Tablas, relaciones y reglas para la base de datos. |
| `Preguntas para entrevistas.md` | Dudas pendientes. Se suman a medida que aparecen. |
| `Guia de entrevista.md` | Guía ordenada para entrevistar al personal. |
| `Recursos/` | Excel de nóminas y flotas reales. **No se versiona** (datos personales). |

## Cómo ver el prototipo

Servirlo con cualquier servidor estático, por ejemplo:

```bash
python -m http.server 3000 --directory prototipo
```

y abrir http://localhost:3000.

## Qué incluye el prototipo

- **Control en vivo:** móviles sin agendar por dirección, personal apto libre, dotaciones incompletas, verificación de móviles escuchados en frecuencia y reclamos del General a los cargadores.
- **Recuento:** propios, prestados y recibidos por dirección y departamento, y qué móviles faltan y por qué.
- **Móviles:** ficha, fuera de servicio con motivo y gravedad, préstamo entre direcciones.
- **Agenda del turno:** servicios por división y turno, dotación con cupo por rol, retenido por procedimiento, horario ajustable.
- **Personal:** aptitud (TNO, licencias, suspensiones) y préstamo de efectivos por guardia.
- **Historial de cambios.**

**Roles:** Administrador General (supervisa, reclama y deriva recursos), cargador Norte, cargador Sur y Monitoreo (consulta y reporta frecuencia).

Los datos se guardan en el navegador. El paso siguiente es una base compartida (por ejemplo Supabase) para que el tiempo real funcione entre computadoras.
