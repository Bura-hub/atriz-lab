import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ProveedorSesion } from '@/hooks/ContextoSesion'
import './globals.css'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA CARA DEL PANEL — Archivo, variable en anchura y peso
 * ═══════════════════════════════════════════════════════════════════════════
 * La tercera familia, y tiene un trabajo que ninguna de las otras dos hace: el
 * **rótulo grabado** de un frontal de instrumento. `VOLTAJE`, `RANGO 0–8,4 V`,
 * `CRIT` — versalitas estrechas, espaciadas, que caben junto al control sin
 * empujarlo. Geist Sans es una neogrotesca moderna con calidez humanista: lee
 * de maravilla un párrafo y no lee como letra serigrafiada sobre aluminio.
 *
 * 🔴 DOS EJES EN UN SOLO FICHERO, y eso es lo que la hace elegible: la anchura
 *    se pide con `font-stretch` e **interpola**, así que un rótulo no salta de
 *    una anchura a otra al cambiar de cuerpo. Con una fuente de un eje harían
 *    falta dos ficheros y dos descargas.
 *
 * 🔴 EMPAQUETADA, no pedida a Google. `next/font/google` también serviría desde
 *    el propio origen —descarga en el build—, pero entonces **compilar exige
 *    salida a internet**, y este laboratorio tiene su propio punto de acceso.
 *    176 kB en git cuestan menos que un despliegue que falla el día de la clase.
 *    Procedencia y licencia OFL: `fuentes/LEEME.md`.
 *
 * ⚠️ Y NO toca las medidas: las cifras siguen en Geist Mono. La regla del
 *    proyecto —*la monoespaciada es para MEDIDAS*— no cambia con la dirección.
 */
const CaraDePanel = localFont({
  src: [
    { path: './fuentes/archivo-latin.woff2', style: 'normal' },
    { path: './fuentes/archivo-latin-ext.woff2', style: 'normal' },
  ],
  variable: '--font-panel',
  display: 'swap',
  /*
   * 🔴 EL RESPALDO ES UNA LISTA DE CARAS ESTRECHAS, no `sans-serif` a secas. Si
   *    la fuente no cargara, un rótulo calculado para anchura 78 saldría en una
   *    cara de anchura normal y **desbordaría su casilla**. Con estas, degrada
   *    a algo del mismo ancho en vez de romper la rejilla del panel.
   */
  fallback: ['Roboto Condensed', 'Arial Narrow', 'Helvetica Neue', 'sans-serif'],
  adjustFontFallback: false,
})

/**
 * 🔴 LA PESTAÑA DEL NAVEGADOR TAMBIEN AFIRMA COSAS, Y ESTA MINTIO DESDE EL
 *    PRIMER DIA.
 *
 * Decia:
 *     title:       "Atriz Lab - Dashboard"
 *     description: "Laboratorio Remoto de Robotica - Panel de Control"
 *
 * Tres afirmaciones que el proyecto tiene decididas AL REVES, por escrito:
 *
 *   · **NO es un laboratorio remoto.** Es un taller PRESENCIAL sin SSH
 *     (decision 17): el alumno esta en el aula con el robot delante, midiendo
 *     con cinta y transportador. Lo remoto se aplazo con su condicion escrita.
 *   · **No es un panel de control** ni una consola de administracion. Es un
 *     instrumento de laboratorio.
 *   · Y «Dashboard» era el nombre de la MAQUETA que se borro de la portada:
 *     1125 lineas con datos inventados y un cartel de «Sistema operacional».
 *
 * 📝 Estuvo ahi meses porque la guardia de frases prohibidas vigilaba
 *    `componentes/`, `app/robot/` y `app/flota/` — y **no este fichero**. El
 *    punto ciego de la comprobacion coincidia exactamente con donde vivia el
 *    fallo, porque los dos salian del mismo descuido. Ya se vigila `app/`
 *    entero (`lenguaje.test.ts`).
 *
 * ⚠️ Y «laboratorio remoto» NO se añadio a `FRASES_PROHIBIDAS`, a proposito: esa
 *    lista es para cosas que la interfaz **no puede saber** (que un LED se
 *    encendio, que un robot esta averiado, cuanta latencia hay). Esto era otra
 *    cosa —una descripcion falsa del producto— y se arregla escribiendo la
 *    verdad, no ampliando una lista que dejaria de significar lo que significa.
 */
export const metadata: Metadata = {
  title: 'Atriz',
  description:
    'Instrumento del laboratorio de robótica: 16 robots Sphero RVR, presenciales, ' +
    'gobernados por WebSocket desde el aula.',
}

export default function DisposicionRaiz({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // `suppressHydrationWarning` se conserva: el tema puede fijarse antes de que
    // React hidrate, y sin esto React avisa de una discrepancia que es esperada.
    //
    // 🔴 Las TRES fuentes van EMPAQUETADAS por `next/font`: se sirven desde el
    //    mismo origen, con `font-display: swap` y precarga. Cero peticiones a
    //    terceros — que era la razón real por la que esta aplicación no tenía
    //    tipografía propia, y que resulta que no obligaba a renunciar a ella.
    //
    //    Cada una tiene UN trabajo, y por eso son tres y no una con pesos:
    //      · Archivo  → el rótulo GRABADO del panel (estrecho, versalitas)
    //      · Geist    → la prosa, que aquí es mucha: esta aplicación explica
    //                   por qué un robot no obedeció, y eso se lee entero
    //      · Geist Mono → LAS MEDIDAS, y nada más
    <html
      lang="es"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${CaraDePanel.variable}`}
    >
      <body className="antialiased">
        {/*
          ═══════════════════════════════════════════════════════════════════
          EL CONTRATO DE DIRECCIÓN · 2026-08-16
          ═══════════════════════════════════════════════════════════════════
          Sobrevive a la compilación de producción a propósito: una decisión de
          diseño que solo vive en la conversación no se puede auditar seis meses
          después.

          🔴 EL DE ANTES DESCRIBÍA UN MUNDO QUE NO EXISTÍA. Decía «campo verde
             pino», «sombra teñida del propio verde» y «pestaña de color en el
             canto superior cuyo ANCHO codifica urgencia». Ninguna de las tres
             estaba en la hoja: el verde se sustituyó por doce tonos de sección,
             la sombra es tinta neutra, y la pestaña de ancho variable nunca se
             construyó. Un contrato que miente es peor que ninguno, porque quien
             lo lee cree que hay un sistema detrás.
             📝 También decía que «el sorteo externo devolvió vacío en este
                entorno». Era cierto y la causa está medida: en Windows el guion
                compara `resolve(argv[1])` con `fileURLToPath(import.meta.url)`,
                las dos cadenas difieren, y el bloque principal no corre — sale
                con 0 y sin una línea. Importando la función directamente sí
                tira, y el resultado está abajo.

          THESIS · Es un FRONTAL DE INSTRUMENTO DE BANCO. Panel claro, rótulo
          grabado, y —la pieza que decide todo lo demás— **el rango y la
          tolerancia impresos junto al control, haya lectura o no**. Un
          multímetro serigrafía «0–20 V ±0,5 %» al lado del conector para
          siempre; ese hábito es la tesis de esta aplicación hecha objeto,
          porque aquí Nav2 dice `SUCCEEDED` a 41 cm y `avanzar(0.20, 3)` da a
          veces 26 cm de 60. La escala impresa contesta «¿esto es bueno?» sin
          gastar una frase.
          Rechaza el «mission control» oscuro con barrido de radar, que es el
          reflejo de la categoría; y rechaza la retícula suiza blanca con un
          acento, que es su opuesto previsible.

          OWN-WORLD · Placas de panel, no tarjetas flotantes: separadas por
          canales fresados de 1 px, no por sombras. Rótulos GRABADOS en Archivo
          estrecha, versalitas y traqueo ancho, con su filete. Ventanas de
          lectura HUNDIDAS —bisel de 1 px claro arriba y oscuro abajo— donde
          vive una cifra viva. Escala impresa bajo cada medida con sus umbrales
          nombrados. Y el estado se distingue **sin color**: línea entera,
          guionada, a media altura, tachada, doblada.

          STORY · Quien entra ve dieciséis instrumentos, sabe de un vistazo cuál
          hay que ir a mirar, y al entrar en uno sigue leyendo el mismo panel.

          FIRST VIEWPORT · La cabecera es una placa serigrafiada con el nombre
          del robot y su estado en línea, no en color; debajo, la losa de
          instrumentos con sus escalas impresas.

          FORM · Frontal de instrumento de banco. Asignado por tirada externa —
          `concept-seed --scope direction --mode operate --from atriz-2026-08-16`
          → ASSIGNED INDEX 7 de mi lista de siete, ordenada por resonancia como
          la dejé escrita en el plan («el 5 y el 6 son los que más me
          interesan»). O sea: **la que yo había puesto la última**, que es
          exactamente para lo que sirve el dado. Los seis retadores se pesaron y
          ninguno gana en los dos ejes; del primero se ROBA una pieza, su
          gramática de estado sin matiz, porque es el tercer código de
          accesibilidad que este proyecto declara obligatorio y nunca construyó.

          FINISH · unreviewed and undocumented is unfinished; this build ends
          with the finish review, the verdict, and DESIGN.md
        */}
        {/*
          El raíl va aquí y no dentro de cada zona: es la ÚNICA navegación de la
          aplicación, y antes de existir había tres agujeros —el cuaderno sin
          salida, la portada inalcanzable, y el muro sin camino al cuaderno—.

          🔴 Y el proveedor de sesión lo envuelve TODO, por encima del raíl,
             porque las dos piezas que preguntan quién eres están lejos entre sí:
             el raíl (para el pie y la entrada de `/usuarios`) y `BotonParada`,
             dentro del marco del robot. Con un `fetch` en cada una habría dos
             verdades que podrían discrepar durante un instante.

          🔴 AQUÍ PONÍA: *«la sesión NO cierra ninguna pantalla; las nueve siguen
             abiertas sin entrar, los dieciséis alumnos usan la aplicación sin
             cuenta»*. **Falso desde el 2026-08-15**, cuando la Fase B hizo
             obligatorio el testigo: sin sesión no se abre un socket con ningún
             robot, así que las nueve se pintaban enteras **y no funcionaba
             ninguna**. Ese texto sobrevivió al hecho que describía durante un
             día entero.

          🔴 Y EL `Armazon` YA NO VIVE AQUÍ. Bajó a `(privado)/layout.tsx`, que es
             de SERVIDOR y decide antes de renderizar: sin sesión no sale ni un
             byte de una pantalla privada. Aquí solo queda lo que las dos mitades
             comparten —el documento, la fuente y quién eres—, porque la portada
             pública y `/entrar` no llevan raíl.
        */}
        <ProveedorSesion>{children}</ProveedorSesion>
      </body>
    </html>
  )
}
