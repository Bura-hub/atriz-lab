import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    // 🔴 `componentes/` (en español) es donde vive la interfaz, y SIN esta línea
    //    Tailwind no genera ni una de sus clases: los componentes compilan, se
    //    montan y salen SIN NINGÚN ESTILO. Es un fallo silencioso de la misma
    //    familia que los demás de este proyecto —nada da error y el efecto no
    //    ocurre—, así que hay una prueba que comprueba que cada glob de aquí
    //    apunta a un directorio que EXISTE (`lib/interfaz/estilo.test.ts`).
    './src/componentes/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // 🔴 `lib/` y `hooks/` AÑADIDOS EL 2026-08-16, y no es celo.
    //
    //    Sin ellos, una clase escrita desde ahí —un mapa `{ vivo: 'bg-…' }` que
    //    un componente consume— **no se compila**, y el elemento sale sin estilo
    //    sin que nada dé error. Es el MISMO fallo silencioso que la nota de
    //    arriba describe, por la puerta de al lado.
    //
    //    📌 Hoy el patrón vigente es que `lib/` devuelva **variables CSS** y no
    //       clases (por eso `tokensQueNoPintan` existe), así que estos dos globs
    //       probablemente no aporten ni una clase. No es configuración muerta:
    //       es la red que hace que el día que alguien escriba una, funcione en
    //       vez de fallar en silencio.
    './src/lib/**/*.{js,ts,jsx,tsx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          foreground: 'rgb(var(--warning-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          foreground: 'rgb(var(--success-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        /* El pozo: el fondo de la aplicación y sus barras fijas. */
        pozo: {
          DEFAULT: 'rgb(var(--pozo) / <alpha-value>)',
          alto: 'rgb(var(--pozo-alto) / <alpha-value>)',
        },
        /*
         * LOS BLOQUES. Color a plena saturación que ocupa una tarjeta ENTERA, y
         * **solo cuando ese robot pide algo**. No son acentos: son campos.
         */
        bloque: {
          vivo: 'rgb(var(--bloque-vivo) / <alpha-value>)',
          mirar: 'rgb(var(--bloque-mirar) / <alpha-value>)',
          ir: 'rgb(var(--bloque-ir) / <alpha-value>)',
        },
        // El vocabulario de estados. Son NUESTROS, así que van en español.
        estado: {
          neutro: 'rgb(var(--estado-neutro) / <alpha-value>)',
          vivo: 'rgb(var(--estado-vivo) / <alpha-value>)',
          mirar: 'rgb(var(--estado-mirar) / <alpha-value>)',
          ir: 'rgb(var(--estado-ir) / <alpha-value>)',
          frenando: 'rgb(var(--estado-frenando) / <alpha-value>)',
        },
      },
      fontFamily: {
        /*
         * 🔴 GEIST, EMPAQUETADA. Y esto corrige un argumento mío que era falso.
         *
         * Esta aplicación usó la tipografía del sistema con la excusa de que «el
         * punto de acceso del aula puede bloquear la red y la fuente caería en
         * silencio». La premisa es cierta; la conclusión no: una fuente **se
         * empaqueta**. `geist` viaja en el bundle y `next/font` la sirve desde
         * el mismo origen — **cero peticiones externas**, igual que antes, pero
         * con una letra que tiene carácter y una caja de cifras hecha para
         * leerse de un vistazo.
         */
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Para todo número MEDIDO. `craft-floor` prohíbe la monoespaciada como
        // disfraz de «técnico»; aquí es exactamente su uso legítimo: medida.
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'Consolas', 'monospace'],
        /*
         * ── LA CARA DEL PANEL ──────────────────────────────────────────────
         * Archivo, variable en anchura. Es la letra GRABADA de un frontal de
         * instrumento: rótulos, escalas, umbrales nombrados.
         *
         * ⚠️ Casi nunca se pide por esta utilidad: `.microetiqueta`, `.rotulo` y
         *    `.escala` ya la traen con su anchura y su traqueo, que es lo que la
         *    hace parecer serigrafía. Un `font-panel` suelto da la cara sin la
         *    voz — y entonces solo es «otra sans».
         *
         * 🔴 El respaldo son caras ESTRECHAS de verdad, no `sans-serif`: estas
         *    clases piden `font-stretch: 78%`, y un navegador que lo sintetice
         *    sobre una cara de ancho normal deforma las letras y desborda la
         *    casilla del rótulo.
         */
        panel: ['var(--font-panel)', 'Roboto Condensed', 'Arial Narrow', 'sans-serif'],
      },
      borderRadius: {
        /*
         * 🔴 2 px, Y ESTO **NO** ES VOLVER AL RADIO 0.
         *
         * `craft-floor` fija el radio de tarjeta en 12-16 px, y aquí se anula a
         * propósito porque la dirección elegida lo pide: en el mundo de «Galón»
         * una ficha es una **placa de máquina troquelada**, y una chapa tiene el
         * canto apenas roto, no redondeado. La propia skill lo autoriza —«The
         * brief wins… even when they conflict with a saturated-pattern
         * warning»—.
         *
         * La diferencia con lo que había antes: aquello era radio **0** escrito
         * como un principio inventado («un instrumento no redondea»). Esto es
         * 2 px sacados de un objeto real, y la píldora sigue existiendo para los
         * controles pequeños, que es donde toca.
         */
        sm: '8px',
        DEFAULT: '12px',
        md: '14px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        ficha: '20px',
      },
      boxShadow: {
        /*
         * 🔴 UNA SOLA FUENTE DE ELEVACIÓN POR ELEMENTO: borde **o** sombra.
         *
         * `craft-floor`: «Declare elevation once, border or shadow. A 1px
         * border under a wide soft shadow is the ghost card.» Las fichas usan
         * SOMBRA; la rejilla de 1 px usa LÍNEA. No se mezclan en el mismo
         * elemento.
         *
         * En «Galón» la placa no flota: se APOYA. Por eso lleva una línea dura
         * de 1 px debajo —el canto de la chapa— y sobre ella una sombra difusa.
         * Las dos van teñidas de grafito, nunca en negro puro.
         */
        /*
         * 🔴 `ficha` y `ficha-alta` VIVIAN AQUI Y SE BORRARON (2026-08-16): cero
         *    usos en toda la aplicacion. La elevacion de las tarjetas la pinta
         *    `.vidrio` directamente en `globals.css`, no una utilidad.
         *    Configuracion que existe y no hace nada — el patron que este
         *    proyecto persigue.
         */
        bloque: '0 20px 44px -20px rgb(var(--sombra) / 0.75)',
        barra: '0 10px 28px -18px rgb(var(--sombra) / 0.60)',
      },
      /*
       * 🔴 SIGUE SIN HABER NINGUNA ANIMACIÓN INFINITA, y eso no se negocia.
       *
       * Tres de las skills instaladas piden un pulso perpetuo en los
       * indicadores de estado. En una pantalla que vigila 16 robots que pueden
       * estar mudos, **algo que late siempre es indistinguible de algo vivo
       * siempre**. Hay una prueba que lo impide (`lib/interfaz/estilo.ts`).
       *
       * Lo que sí hay ahora es movimiento CON PROPÓSITO: un momento de entrada
       * orquestado, transiciones de estado y respuesta al pulsar. Nada se
       * repite solo, y nada se mueve porque llegue un dato.
       */
      /*
       * 🔴 `entrar` VIVIA AQUI Y SE MUDO A `globals.css` (2026-08-16).
       *
       * Tailwind solo emite un `@keyframes` si su utilidad aparece en un fichero
       * escaneado, y `animate-entrar` aparecia en UNO. Pero el fotograma lo
       * consumen DOS: ese, y `.escalonado` —la entrada de las seis pestañas del
       * robot—, que lo escribe a mano en su `animation:`.
       *
       * O sea que quitar `animate-entrar` de ese unico sitio dejaba a las seis
       * pestañas **sin animacion, en silencio**: CSS perfectamente valido
       * apuntando a un fotograma inexistente. Declararlo en la hoja lo desarma, y
       * `keyframesHuerfanos()` de `estilo.ts` impide que vuelva a pasar.
       */
    },
  },
  plugins: [],
}

export default config
