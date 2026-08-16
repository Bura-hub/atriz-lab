# Plataforma Atriz — verdad de producto

> Este fichero existe para **fundar** las decisiones de diseño en hechos, no en gusto.
> Todo lo que hay aquí está medido, decidido por el usuario, o marcado como no verificado.
> Si algo de aquí deja de ser cierto, se corrige aquí **antes** de rediseñar sobre ello.

## Qué es

La interfaz web del **laboratorio de robótica de la Universidad de Nariño**: dieciséis
Sphero RVR, cada uno con una Raspberry Pi 4 y un LIDAR YDLIDAR X2, corriendo ROS 2 Jazzy,
gobernados desde el navegador.

**No es un laboratorio remoto.** El alumno está en la sala, con el robot en el suelo y una
cinta métrica en la mano. La pantalla y el suelo se comparan entre sí — y cuando no
coinciden, la pantalla lo dice.

## Platform

web

## Quién la usa

| | Quién | Qué hace | Dónde está |
|---|---|---|---|
| **Alumno** | 16 por clase, una cuenta cada uno | Conduce, mide, corre su programa en el Taller, anota en el cuaderno | De pie o sentado junto a su robot, portátil del aula |
| **Profesor** | 1 | Ve los 16 a la vez, libera paradas, arranca navegación, da de alta la clase | Al fondo, con el muro **proyectado** en una pared |

**Escena de uso, y manda sobre el gusto:** aula **iluminada**, proyector, un robot en marcha
a un metro. El criterio de legibilidad del muro es **una persona a tres metros**. Móvil no es
prioridad.

## La tesis: es un INSTRUMENTO, y un instrumento no adivina

Todo lo demás sale de aquí. Esta aplicación se niega a afirmar lo que no ha medido, porque
cada vez que el proyecto afirmó de más, alguien cruzó el laboratorio para nada.

Hechos medidos que **obligan** a la interfaz:

| Lo que pasa de verdad | Por qué obliga a la pantalla |
|---|---|
| Nav2 dice `SUCCEEDED` a **6,1 · 11,8 · 41,3 cm** del objetivo | El desenlace de la acción **no informa de lo que pasó**. Se enseña el desplazamiento medido, no el veredicto |
| `avanzar(0.20, 3)` da **26,4 cm** unas veces y **59,5** otras | El polígono de seguridad frena sin avisar. La orden pedida y la distancia recorrida son **dos datos distintos** |
| Un RVR dormido deja el nodo **vivo, con sus topics, y mudo** | «El topic existe» no es «hay dato». Lo que se mira es el **ritmo** |
| El mapa engorda los objetos ~5 cm por lado | Un hueco de 45 cm se cierra. Los umbrales se **dicen**, no se suponen |
| `Aproximacion.radius` = **0,15 m** inmoviliza el robot por completo | Un robot que no obedece casi nunca está roto |
| Con el barrido apagado, el robot **no conduce** — y es el estado normal en reposo | La pantalla tiene que decirlo **antes** de que el alumno pulse |

**Consecuencia de diseño, no negociable:** la ausencia de un dato se pinta como **ausencia**
—una raya—, nunca como cero. `<data value>` existe solo cuando hay valor.

## Lo que la interfaz hace

Doce rutas. Portada pública y `/entrar`; el resto detrás de sesión.

- **Muro de flota** — los 16 a la vez, proyectado. Voltaje, señal de vida, quién lo ocupa.
- **Robot** (6 pestañas) — Taller (editor + terminal contra un agente en el robot),
  Telemetría, Conducir, LIDAR, Navegar, No obedece, Diagnóstico.
- **Cuaderno** — donde el alumno anota lo que midió con la cinta y lo compara con la pantalla.
- **Usuarios** — alta de una clase entera, roles, reseteo.

## Restricciones duras

**Seguridad**
- La **parada de emergencia** tiene que estar siempre a la vista, sin scroll, y su rojo
  (`--destructive`) es **suyo y de nada más**.
- La web publica en `/cmd_vel_raw`, **nunca** en `/cmd_vel` — que es la SALIDA de la capa de
  seguridad. Publicar ahí funciona y **salta el filtro**.
- Nunca se llama a `/rosapi/*`: una sola llamada mata el nodo `rosapi` del robot.
- Sin sesión no hay credencial, y sin credencial el robot **cierra la puerta**.

**Accesibilidad**
- El estado se codifica **tres veces**: color **+ palabra + trama**. Una de cada doce personas
  no distingue el lima del coral, y esto se proyecta. ⏳ La trama está **declarada y sin
  implementar** — es deuda abierta, no una idea.
- Contrastes **medidos** con WCAG, no estimados. AA (4,5) en mesa, **7,0** en proyección.
- Tema **claro**, fijado por la escena y no heredado del sistema operativo. El modo proyección
  es **un botón**: la decisión la toma quien proyecta, no su portátil.
- `prefers-reduced-motion` conserva color y opacidad a 200 ms. Matarlas devolvería el
  destello a quien pidió menos movimiento.

**Honestidad del instrumento**
- **Ninguna animación infinita** sobre un dato, un enlace o la salud de nada.
- **Nada se anima al llegar un dato**: `/odom` va a 16,5 Hz.
- Los motivos **no se esconden** tras un desplegable: el motivo ES la acción.
- **Cero peticiones a la red en tiempo de ejecución.** Su caso testigo: una fuente de iconos
  que no llegó dejó los nombres (`visibility`, `shield`, `memory`) sueltos en la pantalla.

**Idioma**
- **Español** en todo texto visible. Y no se le llama «control de flota remoto»: es un taller
  **presencial**.

## Lo que NO es

- No es un panel de control de una flota remota.
- No lleva cámaras (decidido por el usuario).
- No promete precisión que no tiene: los ~10-12 cm de error de Nav2 se **dicen**.
- No es una aplicación de móvil.
