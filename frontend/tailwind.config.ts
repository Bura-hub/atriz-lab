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
        /*
         * EL TABLERO. El campo de color que sostiene la aplicación entera: la
         * cabecera, el raíl y el fondo sobre el que se apoyan las fichas.
         * **No es un acento — ocupa regiones enteras.**
         */
        tablero: {
          DEFAULT: 'rgb(var(--tablero) / <alpha-value>)',
          claro: 'rgb(var(--tablero-claro) / <alpha-value>)',
          foreground: 'rgb(var(--tablero-foreground) / <alpha-value>)',
          tenue: 'rgb(var(--tablero-tenue) / <alpha-value>)',
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
      },
      borderRadius: {
        /*
         * 🔴 EL RADIO 0 ERA UNA POSE, y se corrige.
         *
         * Estaba escrito como si fuera un principio —«un instrumento no
         * redondea»— y no lo es: era una elección estética que dejaba la
         * aplicación con aspecto de maqueta sin terminar. `craft-floor` fija el
         * radio de tarjeta en 12-16 px y reserva la píldora para controles
         * pequeños; eso es una escala pensada, no un gusto.
         */
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '14px',
        '2xl': '18px',
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
         * Llevan desplazamiento y desenfoque —un halo sin desplazamiento es
         * decoración— y van teñidas del color del tablero, no en negro puro,
         * que es lo que hace que una sombra parezca suciedad sobre papel.
         */
        ficha: '0 1px 2px -1px rgb(var(--sombra) / 0.30), 0 2px 6px -2px rgb(var(--sombra) / 0.20)',
        'ficha-alta':
          '0 2px 4px -2px rgb(var(--sombra) / 0.32), 0 12px 22px -10px rgb(var(--sombra) / 0.28)',
        rail: '0 10px 28px -14px rgb(var(--sombra) / 0.50)',
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
      keyframes: {
        entrar: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        entrar: 'entrar var(--t-entrada) var(--curva-salida) both',
      },
    },
  },
  plugins: [],
}

export default config
