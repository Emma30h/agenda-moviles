# Preguntas para entrevistas — App Agenda de Móviles

Dudas que surgen del análisis de los Excel y que hay que aclarar con quien conozca la calle. Se agregan a medida que aparecen.

## Personal (nóminas DPCN / DPCS)

- [ ] **Filas sin datos de situación.** 137 personas en Norte y 429 en Sur no tienen `SITUACION REVISTA`, `TNO` ni `PERSONAL DE CALLE`. ¿Ya no están en la dirección, o simplemente no se cargaron?
- [ ] **TNO y personal de calle.** Casi todos los TNO figuran como `PERSONAL DE CALLE = NO`. Hay un jefe de guardia en Sur con TNO y de calle: ¿es un error de carga?
- [ ] **Retención de armamento.** El campo dice "NO" para todos los TNO y solo 3 personas tienen "SI". ¿Se usa en la práctica? ¿Cómo se sabe hoy quién tiene el arma retenida?
- [ ] **Nómina duplicada.** DPCS incluye las 503 filas de Norte y repite 555 personas. ¿Cuál es la fuente oficial por persona?

## Móviles (flotas)

- [ ] **Matrícula repetida.** La matrícula interna 1 figura en dos dominios (AF859VY en Norte y AG999CN en Sur). ¿Cuál es la correcta?
- [ ] **Móviles sin dirección o división.** 45 de Ojos en Alerta y 7 de Policiales no tienen dirección; 27 de Policiales no tienen división. ¿A quién pertenecen?
- [ ] **Trámite de baja.** Dos móviles figuran con "TRAMITE DE BAJA" en lugar de división. ¿Cuentan en la flota?
- [ ] **Dos flotas.** ¿Ojos en Alerta y Policiales se manejan como una sola flota o por separado?

## Móviles sin agendar y frecuencia

- [ ] ¿Cómo se detecta hoy que un móvil salió sin estar agendado? ¿Quién lo detecta y a quién avisa?
- [ ] ¿Hasta qué hora, respecto del inicio del turno, tiene que estar cargada la agenda?
- [ ] ¿Qué datos mínimos hacen falta para considerar agendado un móvil?
- [ ] Validar: el Administrador General supervisa y le reclama al cargador de cada dirección. ¿Quién cumple hoy esa función?
- [ ] Validar: Monitoreo verifica el móvil escuchado en frecuencia y, si no está agendado, deja una alerta. ¿Le sirve así?

## Roles y acceso

- [ ] Validar roles: Administrador General, cargador Norte, cargador Sur y Monitoreo. ¿Falta alguno?
- [ ] ¿Cuántas personas cargan por dirección y por turno? ¿Desde qué equipos?
- [ ] ¿Los jefes de división o departamento deberían ver o cargar la agenda?

## Estructura orgánica

- [ ] Además de Norte, Sur y Monitoreo, ¿qué otras direcciones tiene la Dirección General? ¿Logística, Socioeducativo, EPAT 360 y la Subdirección General tienen estatus de dirección?

## Préstamo de móviles (Norte ↔ Sur)

- [ ] ¿Quién decide el préstamo? Entendemos que lo determina el administrador de móviles según falte o sobre en cada zona. ¿Es una sola persona o hay una por dirección?
- [ ] ¿Se presta por turno, por día o por tiempo indefinido? ¿Cómo y cuándo se marca la devolución?
- [ ] Mientras está prestado, ¿a qué dirección cuenta para el recuento: a la que es dueña o a la que lo usa?
- [ ] ¿Se presta también con su dotación, o solo el móvil?
- [ ] ¿Hay préstamos entre departamentos de la misma dirección (por ejemplo, de Norte a Este)?

## Móvil ocupado fuera del horario (procedimientos)

- [ ] Cuando un móvil queda retenido por un procedimiento (por ejemplo, entrega de aprehendido pasado el cambio de turno, a las 7 o a las 14), ¿cuánto suele demorar? ¿Hay un tope?
- [ ] ¿Quién avisa al administrador, y por qué medio?
- [ ] ¿Qué otros motivos tienen los móviles para faltar al recuento además del procedimiento (traslado de detenido, comisión, otra tarea)?
- [ ] ¿Cómo se maneja la dotación de relevo cuando el turno entrante se queda sin ese móvil?
- [ ] ¿Qué se anota del motivo y qué datos hacen falta: número de procedimiento, comisaría o destino, hora de inicio?

## Préstamo de personal (Norte ↔ Sur)

- [ ] Un efectivo de Norte puede ser prestado a Sur por una guardia. ¿Quién lo decide y quién lo autoriza?
- [ ] ¿El préstamo es siempre por una guardia, o puede ser por varios días?
- [ ] Al terminar la guardia, ¿vuelve solo a su dirección o alguien tiene que marcar la devolución?
- [ ] ¿Se presta también entre divisiones de la misma dirección? ¿Se registra?
- [ ] ¿A qué dirección cuenta para la dotación del día: a la suya o a la que lo recibe?

## Asignación de móviles a divisiones

- [ ] Cada móvil figura asignado a una división en las planillas de flota. ¿En la práctica cada división usa solo sus móviles, o el departamento los reparte según la necesidad del día?
- [ ] Si una división le pasa un móvil a otra de la misma dirección, ¿es un préstamo (vuelve) o una reasignación (queda)? ¿Quién lo decide?
- [ ] ¿Cada cuánto cambia la asignación de móviles a divisiones?

## Dotación

- [ ] Usualmente son 2 personas, pero se vio móviles saliendo con una sola. ¿Está permitido salir solo? ¿En qué casos? ¿Hay un máximo de integrantes?
- [ ] ¿Hace falta siempre un chofer y un jefe de coche, o con un chofer alcanza?
- [ ] En el prototipo se puso un cupo por móvil: 1 chofer, 1 jefe de coche y hasta 2 acompañantes. ¿Es correcto? ¿Cambia según el vehículo (sedán, pick-up, camioneta)?
- [ ] ¿Los horarios de turno (por ejemplo 07–14, 14–07, 07–23) son iguales para toda la dirección, o cada departamento o división tiene los suyos?

## Funcionamiento en la calle (pendiente de contar)

- [ ] ¿Cómo se presta un móvil de Norte a Sur y cómo se registra?
- [ ] ¿Quién carga la agenda, y cuándo?
- [ ] ¿Qué estados de móvil y qué motivos de fuera de servicio usan en la práctica?
- [ ] ¿Cómo se cuenta la dotación de cada móvil?
- [ ] ¿Hay móviles que no están en ninguna de las dos flotas?
