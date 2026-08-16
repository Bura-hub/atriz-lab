import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ProveedorSesion } from '@/hooks/ContextoSesion'
import './globals.css'

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
    // 🔴 Las dos fuentes van EMPAQUETADAS por `next/font`: se sirven desde el
    //    mismo origen, con `font-display: swap` y precarga. Cero peticiones a
    //    terceros — que era la razón real por la que esta aplicación no tenía
    //    tipografía propia, y que resulta que no obligaba a renunciar a ella.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased">
        {/*
          EL CONTRATO DE DIRECCIÓN. Sobrevive a la compilación de producción a
          propósito: una decisión de diseño que solo vive en la conversación no
          se puede auditar seis meses después.

          THESIS: el tablero de operaciones de una sala de control, impreso y
          con luz. Rechaza la consola oscura de telemetría con acento de neón,
          que es el reflejo de esta categoría, y también el minimalismo gris
          plano que esta misma aplicación tenía y que no era sobriedad sino el
          otro surco.
          OWN-WORLD: campo verde pino que ocupa cabecera y raíl; fichas de papel
          casi blanco con sombra teñida del propio verde; pestaña de color en el
          canto superior cuyo ANCHO codifica urgencia; Geist empaquetada, mono
          solo para medidas.
          STORY: quien entra ve el estado de dieciséis robots de un vistazo,
          sabe cuál hay que ir a mirar, y entra en uno sin perder el sitio.
          FIRST VIEWPORT: masthead verde a sangre con el nombre y el enlace al
          muro; debajo, la losa 4×4 de fichas a tamaño de lectura larga.
          FORM: tablero operativo (6.º de siete candidatos derivados; el 1.º y
          el 4.º quedaron fuera por ser el surco propio y el de la categoría).
          El sorteo externo devolvió vacío en este entorno y se dice así en el
          CHANGELOG en vez de fingir una tirada.
          FINISH: unreviewed and undocumented is unfinished; this build ends
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
