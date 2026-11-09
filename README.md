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
| `Designaciones radiales SAE.md` | Designaciones reales relevadas del SAE y dudas que dejaron. |
| `Recursos/` | Excel de nóminas y flotas reales. **No se versiona** (datos personales). |

## Cómo ver el prototipo

Servirlo con cualquier servidor estático, por ejemplo:

```bash
python -m http.server 3000 --directory prototipo
```

y abrir http://localhost:3000.

## Qué incluye el prototipo

- **Control en vivo:** móviles sin agendar por dirección, personal apto libre, dotaciones incompletas, verificación de móviles escuchados en frecuencia y reclamos del General a los cargadores.
- **Reservado:** un móvil que no sale en la guardia sin tener novedad deja de contar como sin agendar solo esa guardia.
- **Recuento:** propios, prestados y recibidos por dirección y departamento, y qué móviles faltan y por qué.
- **Tipo de móvil:** Ojos en Alerta o Policial, con su logo en la lista y la ficha, filtro en Móviles y conteo en Recuento.
- **Móviles:** pantalla principal del cargador. Lista los móviles de su dirección con su estado; al tocar uno se abre su agenda para asignar designación radial, horario y personal, marcarlo ocupado o fuera de servicio y terminar el servicio.
- **Designaciones:** el nombre se escribe con sugerencias de su Dirección y el número es libre. Controla en vivo si la combinación está en uso. Un nombre nuevo se usa como excepción y el Administrador General puede sumarlo a la lista desde su pestaña **Designaciones**.
- **Buscador general:** DNI, interno, patente, designación radial o apellido. Todos los buscadores ignoran acentos, mayúsculas y signos, y admiten errores de tipeo.
- **Personal:** aptitud (TNO, licencias, suspensiones) y préstamo de efectivos por guardia.
- **Alta, edición y baja:** desde Personal y Móviles se agrega, edita, pasa de división o da de baja. Nada se borra: las bajas quedan con motivo y se pueden revertir.
- **Situaciones:** TNO, licencias y suspensiones se cargan en la ficha de cada persona. La aptitud se calcula sola según las fechas.
- **Historial de cambios:** las ediciones de móviles y personal se pueden deshacer de a un paso.

**Roles:** Administrador General (supervisa, reclama y deriva recursos), cargador Norte, cargador Sur y Monitoreo (consulta y reporta frecuencia).

Los datos se guardan en el navegador. El paso siguiente es una base compartida (por ejemplo Supabase) para que el tiempo real funcione entre computadoras.
