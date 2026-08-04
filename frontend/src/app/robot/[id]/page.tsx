/**
 * EL TERMINAL DEL ALUMNO — el producto, y la mitad BLOQUEADA de la aplicacion.
 *
 * No es una pantalla «por hacer»: esta bloqueada por una cadena de dependencias
 * que hay que medir en el aula, y decirlo en voz alta es mas util que un hueco
 * silencioso o una maqueta que promete algo que no existe.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { interpretarIdRobot, segmentoRobot } from '@/lib/interfaz/identidad'

export default async function PaginaTerminal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const destino = interpretarIdRobot(id)
  if (destino === null) notFound()
  const seg = segmentoRobot(destino)

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">El terminal todavía no existe</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-prose">
          Es donde el alumno escribirá y ejecutará su código en el robot, en vez de entrar por SSH.
          Va por un canal distinto del resto de esta aplicación —un agente de sesión en el puerto
          9443, no rosbridge— porque el código del alumno corre <strong>en</strong> el robot, con{' '}
          <code>rclpy</code> nativo sobre <code>atriz.py</code>.
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-prose">
          Está bloqueado por dos cosas, en este orden: el agente de sesión no está escrito, y su
          diseño de transporte depende de medir si el punto de acceso del aula aísla a sus clientes.
          Esa medición necesita el aula. Construirlo antes es apostar.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Lo que sí funciona hoy
        </h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link href={`/robot/${seg}/telemetria`} className="text-primary underline focus-ring">
              Telemetría
            </Link>{' '}
            — batería en voltios, motores con su antigüedad, odometría, encoders y LEDs.
          </li>
          <li>
            <Link href={`/robot/${seg}/conducir`} className="text-primary underline focus-ring">
              Conducir
            </Link>{' '}
            — teleoperación y el botón de parada.
          </li>
          <li>
            <Link href={`/robot/${seg}/diagnostico`} className="text-primary underline focus-ring">
              Diagnóstico
            </Link>{' '}
            — llegadas por topic, antigüedades y estado del enlace.
          </li>
        </ul>
      </section>
    </div>
  )
}
