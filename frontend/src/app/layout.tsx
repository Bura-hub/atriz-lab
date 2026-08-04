import type { Metadata } from 'next'
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
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  )
}
