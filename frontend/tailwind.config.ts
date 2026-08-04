import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    // 🔴 `componentes/` (en español) es donde vive la interfaz, y SIN esta línea
    //    Tailwind no genera ni una de sus clases: los componentes compilan, se
    //    montan y salen SIN NINGÚN ESTILO. Es un fallo silencioso de la misma
    //    familia que los demás de este proyecto —nada da error y el efecto no
    //    ocurre—, así que ahora hay una prueba que comprueba que cada glob de
    //    aquí apunta a un directorio que EXISTE (`lib/interfaz/estilo.test.ts`).
    //
    // 📝 Había dos globs más. `./src/pages/**` estaba **MUERTO** —ese directorio
    //    no existe— y `./src/components/**` (con C, en inglés) apuntaba a la
    //    maqueta huérfana de 1125 líneas que nadie importa. El primero se quita
    //    porque no casaba con nada; el segundo, porque ese código se borra.
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
        // 🔴 Tipografía del SISTEMA. Cero red: ver la cabecera de `globals.css`.
        sans: [
          'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif',
        ],
        // Para todo número medido. Es la mitad del vocabulario de un instrumento.
        mono: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'DejaVu Sans Mono', 'monospace'],
      },
      borderRadius: {
        // Todo al mismo token, que vale 0. Un instrumento no redondea, y si algún
        // día lo hiciera sería cambiando UNA línea de `globals.css`.
        sm: 'var(--radio)',
        DEFAULT: 'var(--radio)',
        md: 'var(--radio)',
        lg: 'var(--radio)',
        xl: 'var(--radio)',
      },
      // 🔴 NO hay bloque `animation` ni `keyframes`. Tenía cinco entradas, dos de
      //    ellas INFINITAS (`pulse` y `bounce`) — exactamente lo que tres de las
      //    skills instaladas exigen, y lo que esta interfaz no puede permitirse:
      //    un pulso perpetuo en un indicador de estado es indistinguible de un
      //    latido real. Lo único que se mueve vive en `globals.css`, dura 150 ms
      //    y no se repite.
      //
      // 🔴 Tampoco hay `boxShadow`: la jerarquía la dan la línea de 1 px y el
      //    tamaño. Una sombra sugiere relieve donde no hay ninguno.
    },
  },
  plugins: [],
}

export default config
