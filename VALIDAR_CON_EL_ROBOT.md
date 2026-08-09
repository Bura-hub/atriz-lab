# Lo que falta validar con el robot delante

> ## ✅ PASADA DEL 2026-08-09 CONTRA rvr-01
>
> | | resultado |
> |---|---|
> | **1a · arrancar SLAM desde la web** | ✅ `apagado` → `arrancando · 4 → 9 → 14 s` → `funcionando` en **~18 s**, botón a «Parar SLAM» |
> | **1b · los segundos suben** | ✅ 4, 9, 14 — no se quedan en 0, o sea que el `-1` se traduce bien |
> | **CIEGO** | ✅ forzado apagando el barrido con SLAM vivo: *«levantado, pero no le llega el barrido — el robot no conducirá»*, en teja, con el detalle del robot literal. **Es el estado que `is-active` llamaría *active*** |
> | **MUDO** | ✅ **apareció solo** al parar SLAM: *«la unidad dice `deactivating` pero no hay señal de que funcione»* |
> | **parar SLAM** | ✅ `funcionando` → `MUDO` → `apagado` |
> | **2a · sin modo por defecto** | ✅ ningún modo elegido, «Medir ahora» deshabilitado |
> | **2e · suelo mate en emisión** | 🔴 **DESTAPÓ UN FALLO** — ver abajo. Arreglado y re-verificado |
> | **2b · papel rojo mate, modo normal** | ✅ `R/G` = **2,96 · 2,97 · 2,94** (referencia 2,74) → «la superficie es **rojo**, medida por reflejo del LED». Dispersión del 0,9 % en tres tomas |
> | 🎯 **el 2×2 completo sobre el MISMO papel** | ✅ el mismo rojo en modo *luminosa* da **0 · 0 · 0 · 0** tres veces, dispersión 0, y la pantalla dice «no se puede decir». **Una superficie que solo refleja es invisible sin la luz**: los dos modos no son intercambiables, y eso queda demostrado sin mover el robot |
> | **2c · pantalla de móvil roja, modo luminosa** | ✅ `R/G` = **5,2 · 5,0 · 4,7** (referencia 5,12) → «la luz que sale de la superficie es **rojo**» |
> | 🎯🎯 **2d · LA MISMA pantalla, modo normal** | ✅ **`R 409 · G 721 · B 357` → `R/G = 0,57`.** La pantalla es ROJA y el sensor lee **más verde que rojo**. La interfaz **se niega a nombrarlo** y manda a cambiar de modo. Es la casilla que justifica todo el diseño |
>
> **El 2×2 sobre la MISMA pantalla roja, sin mover el robot:**
>
> ```
>                    luz APAGADA        luz ENCENDIDA
>   lectura       R 78 · G 15 · B 3   R 409 · G 721 · B 357
>   R/G                  5,0                  0,57
>   veredicto        «es rojo» ✅     «no se puede decir» ✅
> ```
>
> Un factor **9** entre los dos cocientes sobre el mismo objeto, y caen a lados
> opuestos de 1. Con la regla ingenua —`R/G > 1` → rojo, si no, verde por
> descarte— la casilla de la derecha habría dicho **«verde» sobre una pantalla
> roja**. Eso es lo que evita la banda plana.
> | **el socket por nombre** | ✅ **2736 ms en frío, 16-25 ms en caliente** desde el navegador, muy dentro del plazo de 10 s |
>
> 🔴 **El fallo que encontró la pasada:** con el robot sobre suelo mate en modo
> emisión, el sensor devolvió `R=0 G=1 B=0` —ruido— y la pantalla afirmó **«la luz
> que sale de la superficie es verde»**. Verde era el caso *por descarte* y una
> sola cuenta se coló por el borde de una guarda que comprobaba `verde === 0`.
> Arreglado con `VERDE_MINIMO_PARA_DECIDIR`, y re-medido en el robot.
>
> 🔴 **Y dos defectos del acuse de petición**, vistos al parar SLAM: seguía
> diciendo *«no dirá "funcionando" hasta que lo esté»* **un minuto después** de
> estar funcionando, y ese mismo texto salía tras pulsar PARAR, donde es un
> sinsentido. Los dos arreglados.
>
> 🔴🔴 **2f · EL APAGADO AUTOMATICO DE LA LUZ NO SALTO.** Cerrada la pestaña tras
> la última lectura (19:47:23), la luz siguió encendida **14 min 38 s** —visto en
> el robot, no solo en `color_activo`— y se apagó porque **la apagué a mano**. El
> apagado por inactividad son 120 s y pasaron 878.
>
> ⚠️ **El tope duro queda SIN MEDIR, y por mi culpa:** lo apagué a menos de dos
> segundos de cuando habría vencido, así que no distingo «saltó» de «lo apagué
> yo». Repetirlo exige no tocar nada durante 20 min.
>
> 📌 **Hipótesis, no medida:** el driver cuenta como actividad que alguien esté
> suscrito a `/color`, y rosbridge puede conservar la suscripción cuando la
> pestaña se cierra de golpe. Se cierra con `ros2 topic info /color` **en el
> robot**, mirando el número de suscriptores con la web cerrada.
>
> → Consecuencia: la pantalla **ya no promete** que la luz se apague sola. Dice
> que la apagues tú, con la medida al lado.
>
> ⏳ **Lo que queda sin ver, y por qué se dejó así:**
>
> - **`BLOQUEADO`** — 🔴 **no es un hueco: es inalcanzable a propósito.** Ver la
>   corrección en la sección 1.
> - **`NO_SE_SABE`** — exige parar el supervisor por SSH. Sin hacer.
> - **1c · el botón de Nav2 sin mapa** — 👤 **decisión de no hacerlo hoy.** Media
>   comprobación ya está: se midió `hay_mapa: true` llegando del robot y el botón
>   salió habilitado en consecuencia, así que **el campo viaja y la pantalla lo
>   lee**. La otra mitad es una rama booleana (`false` → `disabled` + motivo) con
>   prueba unitaria y sin nada del hardware que pueda sorprender. El coste —mover
>   el mapa recién hecho y devolverlo— no lo justifica.
>
> ### 🔴 DOS COSAS PARA EL ROBOT, encontradas de rebote
>
> **1 · `ATRIZ_MAPA` apunta fuera de la ruta por defecto.** El supervisor usa
> `os.environ.get('ATRIZ_MAPA') or ~/atriz_ws/src/Atriz_rvr/atriz_rvr_bringup/maps/aula.yaml`,
> y en rvr-01 **ese directorio está vacío** mientras `hay_mapa` dice `true`. O sea
> que la variable está puesta y el mapa vive en otro sitio. No es un fallo, pero
> **no está escrito en ningún documento del PC**, y quien lea el código deducirá
> la ruta equivocada — me pasó a mí, y mandé un comando que no podía funcionar.
> 📌 Se cierra con `systemctl show atriz-robot -p Environment | grep MAPA`.
>
> **2 · `rosapi/get_param` revienta.** Preguntando por `/supervisor_navegacion/mapa`
> desde rosbridge:
>
> ```
> result=true  ·  successful=false
> reason: "cannot access local variable 'node_name' where it is not associated with a value"
> ```
>
> Es un error **interno de rosapi**, no una respuesta a la pregunta. ⚠️ Y fíjate
> en la forma: `result=true` —rosbridge pudo llamar— con `successful=false`
> dentro. Es exactamente la distinción `result`/`success` que el robot documentó
> el 2026-08-08, apareciendo sola en el primer sitio donde se usó `rosapi`.
> 📌 Lo que importa decidir: **si `rosapi` no sirve para leer parámetros, la web
> no puede preguntarle al robot por su configuración** y todo lo que quiera saber
> tiene que venir por topic o por servicio propio — que es lo que ya hace
> `/estado_navegacion`. Puede que sea la respuesta correcta y no haya nada que
> arreglar; pero conviene saberlo antes de diseñar algo que dependa de `rosapi`.

Todo lo de aquí estaba **construido, con pruebas en verde, y sin comprobar contra
rvr-01**. Se escribió entre el 2026-08-07 y el 08 con el robot apagado, contra
`herramientas/rosbridge_de_mentira.mjs`.

> 🔴 **Un doble prueba que el código no revienta, no que el robot haga eso.** Este
> mismo fichero existe porque el doble ya mintió una vez: tenía mal los nombres de
> campo de `/encoders` y `/motor_status`, la telemetría pintaba `—` con datos
> llegando, y **parecía un fallo de la web**.

Cada comprobación lleva **qué la refutaría**. Sin esa línea, una pasada verde no
distingue «funciona» de «no llegué a probarlo» — que es el error que en este
proyecto bloqueó el sensor de color durante seis días.

---

## 1 · Arrancar SLAM y Nav2 — `ControlNavegacion`

Es lo más grande sin verificar. El **supervisor sí corre** desde el 2026-08-07 y
los dos servicios contestan; lo que nadie ha visto es **esta pantalla contra él**.

| | qué hacer | qué debe pasar | 🔴 qué lo refuta |
|---|---|---|---|
| **1a** | entrar con sesión, `/robot/1/navegar`, pulsar «Arrancar SLAM» | el estado pasa a **arrancando** con los segundos subiendo, y a **funcionando** | que se quede en `arrancando` pasados ~60 s, o que salte a `funcionando` **sin** pasar por `arrancando` (querría decir que el latido no se está leyendo y se pinta un enlatado) |
| **1b** | mirar los segundos | suben de 1 en 1 | que salgan `0` fijos: sería `-1` mal traducido, y este proyecto usa `-1` para «no se sabe», nunca para «cero» |
| **1c** | con Nav2 **sin** mapa, pulsar «Arrancar Nav2» | el botón está **deshabilitado** y dice que falta el mapa | que se pueda pulsar: `hay_mapa` no se está leyendo |
| **1d** | parar el supervisor en el robot (`systemctl stop`) y esperar 5 s | los dos sistemas pasan a **«no se sabe»**, no se congelan en el último valor | que sigan diciendo `funcionando`: la guardia del latido no corre. **Es el fallo que la pantalla existe para no cometer** |

### Los tres estados que hay que provocar a mano

Ninguno aparece solo, y son la razón de que haya seis estados y no un interruptor.

- **`CIEGO`** — con SLAM funcionando, apagar el barrido (`atriz-escaneo off`, o el
  botón de la pestaña Conducir). Debe aparecer en 1-2 s como *«levantado, pero no
  le llega el barrido — el robot no conducirá»*, **en rojo**.
  🔴 Refuta: que se quede en `funcionando`, o que salga en ámbar — sin barrido el
  robot no conduce (0,0 cm contra 9,9), y eso no es un aviso, es un impedimento.
- **`MUDO`** — reiniciar el driver **por debajo** de un `slam_toolbox` ya
  arrancado. Es el caso medido: el búfer TF se rompe y el mapa deja de crecer.
  🔴 Refuta: que la pantalla siga diciendo `funcionando`, que es justo lo que dice
  `systemctl is-active` y el motivo de que no baste.
- 🔴 **`BLOQUEADO` — ESTE PUNTO ESTABA MAL, corregido el 2026-08-09 leyendo el
  supervisor.** Decía: *«pedir Nav2 sin mapa tres veces seguidas: `StartLimitBurst=3`
  agota el presupuesto»*. **No ocurre.** El supervisor comprueba el mapa **antes**
  de llamar a `systemctl` y devuelve un rechazo limpio:

  ```python
  if cual == 'nav':
      if not self._hay_mapa():
          motivos.append(f'no hay mapa legible en {self._mapa}')
  if motivos:
      resp.success = False          # ← y NUNCA llama a systemctl
  ```

  Su propia cabecera lo dice: *«por eso este nodo se NIEGA antes de llamar a
  systemctl. Un `isfile` de coste cero evita **el único estado del que la web no
  puede salir sola**»*. **`BLOQUEADO` es deliberadamente inalcanzable desde la
  web**, y esa es una propiedad del diseño, no un hueco de la validación.

  📝 El punto salió de un comentario del `.msg` que describe lo que pasa al
  hacer `systemctl start` **a mano**, o sea la situación de antes de que el
  supervisor existiera. Copié la consecuencia sin comprobar si el camino seguía
  abierto.

  → Producirlo de verdad exige entrar al robot y hacer `systemctl start
  atriz-nav` **saltándose el supervisor**, y deja la unidad en un estado que
  solo se deshace con `sudo systemctl reset-failed`. **No se hace por
  curiosidad**: se hará el día que alguien tenga que reproducir un incidente.

- ✅ **Lo que SÍ hay que validar del mapa es el punto 1c** —el botón
  deshabilitado— porque recorre exactamente la misma comprobación `hay_mapa` y
  es el estado que un alumno sí puede encontrarse.

⚠️ **Y hay un número que la pantalla NO promete y conviene medir igual:** cuánto
tarda hasta `funcionando`. Hay dos cifras y son de hitos distintos — **24,3 s**
hasta que Nav2 acepta objetivos y **30,2 s** hasta que el supervisor lo declara,
las dos con n≤2. La pantalla enseña segundos transcurridos y ninguna barra de
progreso justamente por eso.

---

## 2 · El sensor de color y sus dos modos — `MedirColor`

Construido contra el contrato de `SENSOR_COLOR.md`, medido en el robot pero
**nunca ejercitado desde esta interfaz**.

| | qué hacer | qué debe pasar | 🔴 qué lo refuta |
|---|---|---|---|
| **2a** | abrir la pestaña Telemetría | **ningún modo** seleccionado, «Medir ahora» deshabilitado | que arranque con uno puesto: elegir por el alumno lo que hay debajo del robot es justo lo que produce la medida invertida |
| **2b** | poner el robot sobre **papel rojo mate**, modo *superficie normal*, medir | dice **rojo** (referencia medida: `R/G = 2,74`) | que diga «no se puede decir»: el umbral de reflejo estaría mal puesto |
| **2c** | poner el robot sobre una **pantalla de móvil roja a tope**, modo *superficie luminosa*, medir | dice **rojo** (`R/G ≈ 5,12`) | que diga verde o «no se puede decir» |
| **2d** | 🎯 **la casilla que lo prueba todo**: la misma pantalla roja, modo *superficie normal* | **«no se puede decir»**, con el motivo y la salida a modo emisión | que diga **rojo**: sería un acierto por casualidad sobre `R/G = 0,66`, que es *menos rojo que verde*. Y peor, que diga **verde** sin avisar |
| **2e** | robot sobre papel mate, modo *superficie luminosa* | los cuatro canales a **cero**, y la pantalla **no** lo trata como avería | que diga «el sensor no contestó»: `claro = 0` con `success=true` son doce lecturas válidas medidas, no una ausencia |
| **2f** | dejar el modo *normal* quieto 15 min | el robot apaga la luz solo, y la línea de estado pasa a **«la luz está al revés de lo que pide este modo»** | que siga diciendo que concuerda: se estaría recordando en vez de leyendo `color_activo` |

---

## 3 · Lo que ya se validó y solo hay que no romper

No hay que repetirlo, pero si algo de esto falla, **es una regresión**:

- conducir desde el navegador: 3 s a 0,100 m/s → **30,0 cm de cinta** contra 29,7 de `/odom`
- la parada de emergencia, pulsada y **liberada** desde la web con testigo del robot
- la lista blanca **deniega en silencio**: `raw_motors` al 30 % → **0,00 cm**
- `ws://rvr-01.local:9090` **abre** en el navegador, por nombre

---

## 4 · Cómo correrlo

```bash
cd frontend
npm run contrato        # antes que nada: el robot manda sobre la lista blanca

# Con el robot encendido y en la misma red:
ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/accion_real.test.ts
ATRIZ_ROBOT=1 npx vitest run src/lib/interfaz/barrido_real.test.ts

# ⚠️ MUEVE EL ROBOT — lo deja parado al terminar:
ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/parada_en_marcha.test.ts

# Y las once pantallas, con datos reales. 🔴 El puerto NO es opcional:
ATRIZ_ROBOT=1 ATRIZ_WEB=http://localhost:3000 ATRIZ_HOST=1 \
  npx vitest run src/lib/interfaz/pantallas_reales.test.ts
```

🔴 **Si `pantallas_reales` pasa demasiado rápido y demasiado limpio, comprueba el
puerto.** 27 de sus 29 comprobaciones son de AUSENCIA, y una página de error del
navegador las cumple todas. Ya ha mordido dos veces.

---

## 5 · Y lo que este fichero no puede hacer

**Decidir si una afirmación es verdad.** Solo dice qué mirar. Las dos cosas que la
web tuvo que retirar el 2026-08-08 —«los servicios no existen en el robot» y «el
error al llegar es de 6 cm»— **habrían pasado cualquier lista de comprobación**:
la primera porque nadie preguntó al robot, la segunda porque una tanda salió bien.

→ Antes de anotar «verificado», escribe **qué habrías visto si fuera falso**. Si no
hay respuesta, no es una medida.
