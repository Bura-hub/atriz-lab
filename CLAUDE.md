# Instrucciones para Claude — `atriz-lab`

Este fichero se carga automáticamente al abrir Claude Code en este directorio.
**Estas reglas ganan a cualquier skill instalada.** Léelo entero antes de tocar nada.

---

## Qué es esto

La interfaz web de un laboratorio universitario de robótica: **16 robots Sphero RVR** con
Raspberry Pi y LIDAR, gobernados por WebSocket a través de rosbridge.

**No es un panel de administración ni un producto de consumo: es un instrumento de
laboratorio.** Los alumnos están **en la misma sala que el robot**, midiendo con cinta métrica
y transportador. El administrador mira los 16 desde el otro lado del aula, a veces proyectado.

El contexto de ingeniería —todo lo medido sobre estos robots— vive en el repositorio hermano
`atriz_migracion`. Su `CLAUDE.md` gobierna lo que la interfaz **puede afirmar**, y este fichero
no lo repite: lo aplica.

---

## 🔴 LA REGLA CENTRAL

**La pantalla nunca puede afirmar lo que no sabe.**

El peor modo de fallo de este proyecto —documentado una y otra vez— son **interfaces que
parecen sanas sobre sistemas rotos**: `systemctl is-active` diciendo *active* con el driver
muerto cuatro minutos; `undercarriage_white` devolviendo `success=true` sin encender el LED;
`colcon build` diciendo «finished» sin instalar nada; el topic registrado y mudo; el log
escribiendo «streaming reanudado» con el robot **apagado**.

Todas comparten la forma: **un código de salida 0 no prueba que algo pasara.** Una pantalla que
dice «LED encendido» porque un servicio devolvió `true` es otra entrada de esa lista.

Y ya pasó aquí: la portada de esta misma aplicación mostraba **1125 líneas de maqueta con datos
inventados** y un cartel de «Sistema operacional», sin haber hablado con ningún robot.

### Las cuatro frases que lo dicen todo

Tres vienen de `impeccable` y se adoptan como propias porque dicen exactamente la regla:

> **«No prometas una causa ni una resolución que el sistema no puede conocer.»**
> **«Muestra progreso determinado cuando exista; nunca inventes progreso.»**
> **«Un estado vacío distingue primer uso, sin resultados, filtros, permisos y fallo.»**

Y una cuarta, propia de aquí, porque hay un **sexto** tipo de estado vacío que ninguna guía
contempla:

> **«NO CONSTRUIDO»** — la funcionalidad no existe todavía. No es «cargando», no es
> «próximamente», no es un hueco silencioso: es una casilla que dice qué falta y qué la
> bloquea. Es el estado del **terminal**, que es el producto.

### Lo que la interfaz NO puede decir

Cada fila viene de una medición, no de una preferencia. Están fijadas en
`src/lib/interfaz/lenguaje.ts` y **hay una prueba que recorre los componentes y las rutas y
falla si alguna aparece**.

| Nunca | Por qué |
|---|---|
| «color cambiado», «LED encendido» | Ningún servicio del robot confirma un efecto físico. `undercarriage_white` devuelve `success=true` **sin encender nada** |
| «robot averiado» por falta de datos | `SIN_DATOS` es **ámbar**, con las tres causas listadas **sin elegir**. Un robot cargando es el estado cotidiano |
| Un porcentaje de batería como dato principal | `percentage` marcó **100 % con la batería a 8,29 V**, y además es una fracción 0-1 |
| Un número sin su antigüedad | El sondeo térmico va cada 30 s: una temperatura plana puede ser **el mismo dato repetido** |
| Una cifra de latencia | El extremo a extremo navegador→motores **no está medido** |
| Un dato de ejemplo o de relleno | Si no hay valor, se dice «no se sabe», y **tiene que verse distinto de un cero** |

⚠️ **«parada ACTIVA» SÍ se puede decir**, y es la excepción que confirma la regla: estuvo
prohibida hasta que el robot empezó a publicar su bandera y el flanco `false → true` se
presenció **con el robot en marcha, desde los dos lados a la vez**. Pasó de suposición a dato.
Solo se usa con `/estado_robot` en la mano; si no llega, la respuesta es «no se sabe», nunca
«no está puesta».

---

## 🔴🔴 LO QUE ESTA TABLA NO ES: UNA EXCUSA PARA NO DISEÑAR

Corregido el 2026-08-04, después de que el usuario tuviera que pedirlo cinco veces.

La tabla de abajo es correcta en lo que dice y **se usó para algo que no dice**. Sirvió de
coartada para dejar la aplicación en gris piedra, radio 0, tipografía del sistema, sin
profundidad, sin color de marca y con el movimiento reducido a tres reglas — y para contestar
«las skills no aplican aquí» cada vez que se pedía un diseño mejor.

**Las reglas de honestidad y las de artesanía son separables, y solo las primeras están
ganadas:**

| Se rechazaba | Veredicto |
|---|---|
| Pulso infinito en un indicador de estado | ✅ **Sigue prohibido.** Finge vida sobre robots que pueden estar mudos. Es la regla |
| Datos «orgánicos» inventados, *skeletons*, barras de progreso | ✅ **Siguen prohibidos.** Es telemetría falsa |
| Tipografía propia | 🔴 **Era falso.** El argumento —«el AP del aula puede bloquear la red»— es cierto, y la conclusión no: una fuente **se empaqueta**. Geist viaja en el bundle, **cero peticiones externas**, medido |
| Radio 0 «porque un instrumento no redondea» | 🔴 **Era una pose** disfrazada de principio |
| Sin sombras «porque sugieren relieve donde no lo hay» | 🔴 **Sobreaplicado.** La elevación separa papel de tablero; lo que `craft-floor` prohíbe es declararla **dos veces** (borde *y* sombra) |
| Color como «vocabulario de estados, no acento» | ⚠️ **Cierto y usado al revés:** servía para no tener **ningún** color. El mundo ahora tiene un campo que ocupa regiones enteras, y el vocabulario de estados sigue intacto encima |
| Movimiento casi nulo | 🔴 **Emil no dice eso.** Dice movimiento **con propósito**. Ahora hay un momento orquestado y ninguno se repite solo |

→ **La regla que queda:** cuando una skill choque con esta tabla, comprueba primero **si el
  choque es de honestidad o de gusto**. Si es de gusto, gana la skill.

---

## 🔴 PRECEDENCIA: estas reglas ganan a las skills

Hay **20 skills de diseño** instaladas en `.agents/skills/` del repositorio hermano. **Doce son
inaplicables o activamente hostiles** a un instrumento: están escritas para *landing pages*
premium, y `design-taste-frontend` se autoexcluye por escrito — *«Not dashboards, not data
tables, not multi-step product UI»*.

Cuando una skill contradiga esta tabla, **gana la tabla**. No la vuelvas a plantear.

| La skill dice | Aquí | Por qué |
|---|---|---|
| `design-taste-frontend-v1:207` *«Every card must have an "Active State" that loops infinitely (Pulse…) to ensure the dashboard feels 'alive'»* · `stitch-design-taste:95` *«Pulse on status dots»* · `gpt-taste:47` *«Static interfaces are strictly forbidden»* | 🔴 **PROHIBIDO, y hay una prueba** | **Un pulso infinito en un indicador de estado es indistinguible de un latido real.** En una pantalla que vigila 16 robots, algo que se mueve siempre parece algo vivo siempre. Es la familia de fallo que este proyecto entero persigue |
| `impeccable/critique.md:325-338` — «≤4 opciones visibles», puntuación de carga cognitiva | **No aplica a la superficie de telemetría** | Un panel con doce subsistemas, cada uno con estado + antigüedad, saldría «crítico». La densidad aquí es deliberada |
| `impeccable/distill.md` — *«Hide complexity behind clear entry points»* | 🔴 **Prohibido** para las causas de `SIN_DATOS` y los motivos de una baldosa | Esconder **por qué** algo está en ámbar deja el ámbar sin acción posible. El motivo *es* la acción |
| Cuatro skills — «máximo un color de acento» | **Rechazado** | Aquí el color es un **vocabulario de estados** (no se sabe · vivo · mirar · ir · frenando), no un acento de marca |
| `redesign-existing-projects:80` — datos «orgánicos» tipo `47,2 %` en vez de redondos | 🔴 **Prohibido** | En una *landing* es cosmética. Aquí es **telemetría falsa que parece real** |
| `craft-floor.md:26` — *«A kicker or eyebrow above a heading. This one is a ban, not a default»* | ✅ **Exención escrita** | En un instrumento la microetiqueta sobre el valor **es la unidad y el contexto**, no decoración. La prohibición viene de páginas de marketing, donde el eyebrow es un adorno |
| `industrial-brutalist-ui §7` — scanlines CRT, dithering, ruido analógico | 🔴 **Prohibido** | Decoración que **compite con señal real**. De esa skill se toma el vocabulario estructural (§3.2, §5, §8), no el disfraz |
| `minimalist-ui:67` — *«Sections should not feel empty and flat… subtle full-width background imagery»* | **Rechazado** | Aquí un hueco es un dato: significa «no se sabe» |
| `high-end-visual-design:11` *«NEVER generate the exact same layout twice»* · `gpt-taste:14` aleatorización | **Rechazado** | `impeccable/operate.md:61` lo dice mejor: *«Consistency over surprise. The same visual vocabulary screen to screen is a virtue»* |
| hooks de `impeccable` (`detect.mjs` tras cada edición) | 🔴 **NO se instalan** | Su detector incluye el ban de eyebrows y de status dots: pelearía contra esta tabla en cada commit |

### Cómo se usan las que SÍ sirven

- **`impeccable` en modo `Operate`**, siempre — *«App UI, dashboards, editors… Scanability,
  consistency, native expectations outrank expression»*. Si el router cae en `Persuade`, está
  mal encaminado. Comandos: `audit`, `critique`, `clarify`, `harden`, `polish`.
  Lee `reference/operate.md`: es el documento más alineado de las veinte.
- **La familia de motion de Emil** (`emil-design-eng`, `review-animations`,
  `find-animation-opportunities`) como **filtro, no como generador**. Son anti-animación por
  diseño: *«Expect to reject most candidates»*, *«When unsure whether motion feels right, the
  strongest move is often to delete it»*.
- **`apple-design` por secciones**: §1 Response, §3 Interruptibility, §14 Reduced motion,
  §15 Typography. Sáltate los materiales translúcidos.
- **`industrial-brutalist-ui` como vocabulario estructural**: rejilla de 1 px, monoespaciada
  para todo número medido, `border-radius: 0`, densidad bimodal, y semántica HTML de verdad
  (`<data>`, `<samp>`, `<output>`, `<dl>`).

---

## Restricciones duras

- **Español** en identificadores, comentarios y **todo texto visible**.
- 🔴 **Cero dependencias nuevas.** Hay Next 15.5.6, React 19, Tailwind 3.4, `lucide-react`,
  Vitest. No se instala `jsdom`, ni `@testing-library`, ni una librería de animación, ni una
  fuente, ni un paquete de iconos.
- 🔴 **`src/lib/rosbridge/` no se toca.** Está probado contra hardware: ha movido un robot,
  ha disparado su parada de emergencia, y su odometría coincide con la cinta métrica.
  Cambiarlo exige una justificación fuerte y explícita.
- 🔴 **`src/hooks/` no se toca** desde un componente. Lo nuevo vive con los componentes —
  precedente ya sentado por `componentes/robot/useMuestreo.ts`.
- 🔴🔴 **NO SE LLAMA A `/rosapi/*`. NUNCA.** No es una preferencia de diseño: **una llamada de
  esta web mató el nodo `rosapi` del robot** el 2026-08-08, y `systemctl` siguió en verde.
  `rosapi/params.py` revienta en su propio temporizador de limpieza (`Can't subtract times with
  different clock types`) unos 30 s después de que se le pregunte por **un nodo que no existe** —
  que es el caso **normal** aquí: `amcl`, `slam_toolbox` y los nodos de Nav2 solo existen con la
  navegación arrancada.
  → El robot lo mitigó con `respawn` (el fallo dura ~2 s en vez de para siempre), pero **la causa
    está aguas arriba, en Jazzy**. Lo único que lo cierra desde este lado es no llamarlo.
  → ⚠️ Y el daño no es local: rosapi es **lo que `roslibjs` usa AL CONECTAR**, así que tumbarlo
    deja sin arrancar a **los clientes nuevos de ese robot** mientras los ya conectados parecen
    sanos. Este cliente no usa roslibjs y no lo necesita — la auditoría del robot lo confirma:
    *«cero dependencias, le pasa por encima»*. **Que siga así.**
  → 📝 Si algún día hace falta un parámetro del robot, el nombre va `<nodo>:<parámetro>` —con dos
    puntos, no barra— y **solo de un nodo que se sepa vivo**. Pero antes de eso, pregúntate si el
    robot puede publicarlo: `/estado_robot` y `/estado_navegacion` existen justamente por esto.
- 🔴 **SI ALGÚN DÍA SE PUBLICA EN `/initialpose`, EL SELLO VA A CERO.** Está en la lista blanca
  y **hoy no se usa**, pero el robot midió que su banco de pruebas lo publicaba mal **en las diez
  tandas de la historia del proyecto**: `Failed to transform initial pose in time (extrapolation
  into the future)` — el sello iba **69 ms por delante** de lo último que tenía TF, así que AMCL
  lo descartaba siempre.
  → 🔴 **Y el fallo es mudo para quien publica:** no hay respuesta, no hay error, el mensaje sale y
    nadie lo rechaza en tu cara. El banco «creía fijar la pose y no la fijaba nunca».
  → El arreglo del robot fue **sello `0`**, que le dice a TF «lo más reciente que tengas». Un
    `Date.now()` del navegador sería aún peor: ni siquiera está sincronizado con el reloj del robot.
- **Sin líneas de coautoría en los commits.**

---

## 🔴 Lo que las pruebas NO cubren, y hay que saberlo

**Las pruebas corren en `environment: 'node'` sobre `src/lib/**` y `src/hooks/**`. Ninguna
renderiza un componente**, y `vitest.config.ts` documenta que `jsdom` no se instala.

→ **Una batería verde no prueba que nada se pinte.** Si un cambio visual se declara terminado
  por un `npm test` en verde, ha reproducido el fallo que este proyecto lleva documentando
  desde el principio: una comprobación que no mira nada y cuenta como aprobada.
→ ✅ **Y desde el 2026-08-04 hay una prueba que sí las mira**:
  `lib/interfaz/pantallas_reales.test.ts`, guardada tras `ATRIZ_ROBOT=1`. Arranca un navegador
  headless por CDP —sin instalar nada: node 22 trae `WebSocket` global—, abre las **nueve
  rutas** contra el robot real y comprueba el HTML **ya hidratado**. **32 comprobaciones**, ~86 s.
  🔴 **Y necesita `ATRIZ_WEB` si sirves fuera del puerto 3118**, que es su valor por defecto.
  Equivocarlo NO da un error claro: el navegador abre la página de «no se puede conectar» de
  Edge y **27 de las 29 comprobaciones pasan igual** —es la misma trampa que el propio fichero
  documenta dos líneas más abajo, y ha vuelto a morder—. Si pasa demasiado rápido y demasiado
  limpio, mira el puerto.
→ 🔴 **Y su primera ejecución enseñó la lección más útil del día: 18 de sus 19 comprobaciones
  pasaron sobre seis páginas 404.** Repetición, hueco disfrazado de dato y frase prohibida son
  todas de **ausencia**, y una página vacía las cumple. Solo la que exige que los datos
  **lleguen** lo vio. → **Toda batería de comprobaciones de ausencia necesita al menos una de
  presencia**, o es una comprobación muerta que cuenta como aprobada.
→ 🔴🔴 **Y NI SIQUIERA ESO BASTA: el 2026-08-09 el ROBOT encontró tres fallos que ninguna
  comprobación de este repositorio veía**, y dos de ellos con las 579 pruebas, `tsc` y `eslint`
  en verde. Un «es verde» afirmado sobre **ruido** (`R=0 G=1 B=0`), un acuse que decía «espera»
  un minuto después de haber llegado, y una promesa de que la luz se apaga sola que **no se
  cumplió** —14 min 38 s encendida—.
  → **La única forma de encontrarlos fue conducir la interfaz contra el hardware y mirar.** Hay
    dos herramientas para eso, y el orden importa:
    · `herramientas/rosbridge_de_mentira.mjs` — sin robot, para estados que tardan minutos o que
      no se pueden pedir (`ciego`, `mudo`, latcheado). 🔴 **Prueba que el código no revienta, NO
      que el robot haga eso**: llegó a tener mal los nombres de campo de `/encoders` y la
      telemetría pintaba `—` con datos llegando, **pareciendo un fallo de la web**.
    · **`VALIDAR_CON_EL_ROBOT.md`** — la lista contra rvr-01, y cada punto lleva **qué lo
      refutaría**. Sin esa línea, una pasada verde no distingue «funciona» de «no llegué a
      probarlo».
→ Lo que sigue sin cubrirse: colores, espaciado y si algo se lee a tres metros. **Eso exige una
  persona mirando.**
→ Y para el muro del administrador, el criterio de aceptación es **una persona a tres metros**.

### El texto pintado sí se comprueba ya — `lib/interfaz/repeticion.ts`

Existe porque el 2026-08-04 la telemetría pintó **«hace hace 7,9 s»** y **«en reposo: 27,5 °C en
reposo»**, y **las 321 pruebas pasaron**. Lo encontró una captura de pantalla.

Son **dos detectores y no uno**, y esa es la parte que importa: `hace hace` es una palabra
pegada a sí misma, `en reposo … en reposo` es una frase repetida **a distancia**. El primer
detector que se escribió solo veía lo primero, o sea la mitad de lo que ya había ocurrido.

**🔴 Y sus dos parámetros salieron de fallos del propio detector, no de teoría:**

- **`\b` en JavaScript es ASCII aunque lleve el flag `u`.** Se define contra `[A-Za-z0-9_]`, así
  que una letra acentuada abre una **frontera de palabra falsa** a su lado. En español eso
  dispara sin parar: `batería a 8,29 V, a 1,29 V` casaba como «a a», y gritó en **tres
  pantallas** sobre texto correcto. Se arregló con `(?<!\p{L})` y `(?!\p{L})`, que sí son
  Unicode.
- **El corte «etiqueta contra prosa» se mide en PALABRAS, no en caracteres.** Con el tope en 90
  caracteres, esta línea real del diagnóstico —72 caracteres— gritaba: *«Un hueco declarado es
  honesto; un hueco callado se lee como todo bien»*. Es una oración con dos mitades **paralelas
  a propósito**; repetir «un hueco» es la figura, no un fallo. Trece palabras la dejan fuera.

→ **La lección, que es la de siempre aquí: un verificador con falsos positivos se acaba
  ignorando, y eso es peor que no tenerlo.** Los dos fallos se encontraron **pasándolo por las
  pantallas de verdad**, no razonando sobre él.
→ ⚠️ **Y lo que NO ve, dicho para que nadie lo descubra tarde:** trabaja sobre el texto de **un
  solo elemento**. `Atasco [no se sabe] no se sabe` —la misma frase repartida entre la insignia y
  la antigüedad— pasó por delante sin que lo detectara. Eso lo vio una captura.

### 🔴🔴 Un WebSocket que no abre NO da error. Nunca.

Ni `onerror`, ni `onclose`, ni excepción. Medido el 2026-08-04 contra un robot **encendido y
sano**: `ws://rvr-01.local:9090` estuvo **12 s en silencio absoluto**, la misma firma exacta que
una dirección inalcanzable. El navegador prueba las direcciones que resolvió el nombre en orden
y se queda ~21 s en cada SYN sin respuesta.

**Por qué importa más de lo que parece:** sin `onclose`, la reconexión con espera creciente **no
llega ni a arrancar**. El muro dejaba **16 conexiones colgadas para siempre** y las 16 baldosas
decían «no llego» sobre un robot que estaba perfectamente.

→ Por eso `transporte.ts` tiene **`PLAZO_CONEXION_MS`** (10 s): convierte un cuelgue en un cierre,
  y con él vuelve el camino normal —aviso, cancelación de pendientes, reintento—.
→ ⚠️ **Y el número está medido, no elegido:** la primera versión puso 5 s y era demasiado justo
  —4623 ms con el muro entero intentándolo, y una toma suelta de **7293 ms**—. Un plazo corto no
  da un fallo: da un «no llego» **intermitente sobre un robot sano**, que es el peor caso posible
  para depurar. Subirlo **no cuesta nada en pantalla**: la baldosa ya dice «no llego» desde el
  primer instante, y el plazo solo decide cuándo se reintenta.
→ ✅ La causa de fondo se arregló **en el robot** (una dirección por red), porque JavaScript **no
  puede** enumerar lo que resolvió un nombre ni elegir dirección: no hay API. Detalle en
  `lib/interfaz/direcciones.ts`.
→ 📝 **La regla general: `ping` y `Resolve-DnsName` pueden dar verde los dos con el navegador
  colgado.** Para un cliente web, el único testigo válido es abrir el socket desde el navegador.

### Dos trampas de este repositorio en concreto

**🔴 `npm run build` con `npm run dev` corriendo rompe el servidor.** Los dos escriben en
`.next/`: la compilación de producción pisa el caché del de desarrollo y las rutas empiezan a
dar **HTTP 500** con un error que **no menciona tu fichero** (`ENOENT:
.next/server/vendor-chunks/next.js`). Se arregla parando, `rm -rf .next` y arrancando de nuevo.
Uno u otro, nunca los dos a la vez.

**🔴 Un glob roto en `tailwind.config.ts` hace que los componentes salgan SIN ESTILOS y sin dar
error.** Lo dice el comentario del propio fichero. Hay una prueba que comprueba que cada glob
de `content` apunta a un directorio que existe: si la tocas, deja algo equivalente.

---

## Comandos

```bash
cd frontend
npm test                  # las pruebas puras, en Node
npx tsc --noEmit
npx eslint src
npm run build             # ⚠️ NO con `dev` corriendo
npm run contrato          # compara la lista blanca con robot.launch.py DEL ROBOT
npx next dev -p 3118      # y ENTRA en las rutas: compilar no es pintar
```

**`npm run contrato` lee el árbol de trabajo de `../Atriz_rvr`**, así que su veredicto depende
de en qué rama esté **ese** repositorio. Lo dice en su primera línea: si no pone `rama ros2`,
míralo **antes** de tocar `contrato.ts` — la web no puede prometer lo que `ros2` no publica.

### Contra el robot

Dos pruebas se saltan por defecto y solo corren con `ATRIZ_ROBOT=1`. **Mueven el robot**:

```bash
ATRIZ_ROBOT=1 npx vitest run src/lib/rosbridge/parada_en_marcha.test.ts   # ⚠️ lo deja parado
ATRIZ_ROBOT=1 npx vitest run src/lib/interfaz/barrido_real.test.ts        # solo enciende el LIDAR
```

Aparecen como `skipped`, no como aprobadas: un guion que mueve un robot no se ejecuta por
accidente al pasar la batería.
