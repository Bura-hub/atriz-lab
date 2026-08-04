# Instrucciones para Claude — `atriz-lab`

Este fichero se carga automáticamente al abrir Claude Code en este directorio.
**Estas reglas ganan a cualquier skill instalada.** Léelo entero antes de tocar nada.

---

## Qué es esto

La interfaz web de un laboratorio universitario de robótica: **16 robots Sphero RVR** con
Raspberry Pi y LIDAR, gobernados por WebSocket a través de rosbridge.

**No es un panel de administración ni un producto de consumo: es un instrumento de
laboratorio.** Los alumnos están **en la misma sala que el robot**, midiendo con cinta métrica
y transportador. El profesor mira los 16 desde el otro lado del aula, a veces proyectado.

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
- **Sin líneas de coautoría en los commits.**

---

## 🔴 Lo que las pruebas NO cubren, y hay que saberlo

**Las pruebas corren en `environment: 'node'` sobre `src/lib/**` y `src/hooks/**`. Ninguna
renderiza un componente**, y `vitest.config.ts` documenta que `jsdom` no se instala.

→ **Una batería verde no prueba que nada se pinte.** Si un cambio visual se declara terminado
  por un `npm test` en verde, ha reproducido el fallo que este proyecto lleva documentando
  desde el principio: una comprobación que no mira nada y cuenta como aprobada.
→ Lo que sí se puede automatizar sin instalar nada: **Edge headless por CDP contra un
  rosbridge falso escrito a mano**. Está descrito en `.superpowers/informe-pantallas.md`.
  Reutilízalo, no lo reinventes.
→ Y para el muro del profesor, el criterio de aceptación es **una persona a tres metros**.

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
