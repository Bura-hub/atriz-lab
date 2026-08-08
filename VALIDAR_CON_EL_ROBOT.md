# Lo que falta validar con el robot delante

Todo lo de aquí está **construido, con pruebas en verde, y NO comprobado contra
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
- **`BLOQUEADO`** — pedir Nav2 **sin mapa** tres veces seguidas: `StartLimitBurst=3`
  agota el presupuesto en ~40 s y la unidad queda `failed`. Debe decir que hace
  falta `systemctl reset-failed` **en el robot**.
  🔴 Refuta: que ofrezca «reintentar». Volver a pulsar no hará nada, y ese botón
  deja al alumno dándole a algo muerto.

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
