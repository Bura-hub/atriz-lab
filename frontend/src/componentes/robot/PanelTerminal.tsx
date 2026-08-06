'use client'

/**
 * EL TALLER DEL ALUMNO. **NO CONSTRUIDO**, y esta pantalla lo dice dos veces.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL CRITERIO DE REVISIÓN ES UNA SOLA PREGUNTA
 * ═══════════════════════════════════════════════════════════════════════════
 *      ¿alguien podría creer que esto ya funciona?
 *
 * Si la respuesta no es un no rotundo, la pantalla está mal. Por eso aquí no
 * hay **ni una línea de código ni una de salida inventada**, ni cursor, ni
 * prompt `$`, ni resaltado de sintaxis falso, ni «próximamente».
 *
 * Es el 90 % del tiempo del alumno y el 0 % de lo que funciona, y esa
 * desproporción se enseña en vez de disimularse: lo que ocupa la pantalla no es
 * un decorado de terminal, es **la lista de requisitos medidos que el agente de
 * sesión tendrá que cumplir**. Así el hueco es un encargo, no un adorno.
 *
 * ⚠️ Y lo único de esta pantalla que habla con el robot HOY es la parada de
 *    emergencia — porque el alumno lanza sus guiones por SSH mientras esto no
 *    exista, **y el robot se mueve de verdad mientras esta pantalla está
 *    abierta**.
 */

import { ReactNode } from 'react'
import { AVISOS_ESPACIO, ESPACIO } from '@/lib/taller/espacio'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/** Los tres eslabones de la cadena, en orden. Ninguno se puede saltar. */
const CADENA: readonly { paso: string; titulo: string; estado: string; porque: string }[] = [
  {
    paso: '1',
    titulo: 'F0 · medir el punto de acceso del aula',
    estado: 'sin medir',
    porque:
      'Si el AP aísla a sus clientes entre sí, el navegador no puede hablar con el robot y el '
      + 'transporte se replantea entero. Diez minutos en el aula, y es el único experimento que '
      + 'puede tirar un diseño completo.',
  },
  {
    paso: '2',
    titulo: 'Agente de sesión en el robot',
    estado: 'no escrito',
    porque:
      'Tu código corre EN el robot, con rclpy nativo sobre atriz.py — no por rosbridge. Haría '
      + 'falta un servicio propio, escuchando en el robot.',
  },
  {
    paso: '3',
    titulo: 'Este terminal',
    estado: 'chasis dibujado, sin conectar',
    porque: 'Lo que ves. La forma que tendrá, sin nada detrás.',
  },
]

/**
 * Lo que el agente de sesión tendrá que dar, **cada uno con la medida que lo
 * obliga**. No es documentación interna: es lo que separa «no está hecho» de
 * «no está hecho de cualquier manera».
 */
const REQUISITOS: readonly { titulo: string; porque: string }[] = [
  {
    titulo: 'PTY, no tubería',
    porque:
      '05_sensor_color.py imprime una fila cada 0,5 s y el seguidor de línea gira a 10 Hz. '
      + 'Contra una tubería, print() escribe a bloques: pantalla congelada con el robot en marcha.',
  },
  {
    titulo: 'stdin bidireccional',
    porque:
      'Cuatro input() en 04_giro_preciso.py (líneas 75, 103, 106 y 109) y un quinto en '
      + '99_test_ctrl_c.py (línea 64). Sin él, dos prácticas de diez están muertas.',
  },
  {
    titulo: 'Señales y PID a la vista',
    porque:
      'SIGINT repetido, SIGQUIT, SIGTERM y SIGHUP son el objeto de estudio de la práctica 99, y '
      + 'su ejercicio 5 pide kill -9 <pid> desde otra terminal.',
  },
]

/** Una caja vacía con su motivo dentro. **Nunca con contenido simulado.** */
function Hueco({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {etiqueta}
      </p>
      <div className="flex min-h-[190px] items-center rounded-md border border-dashed border-[rgb(var(--filo)/0.16)] bg-[rgb(var(--vidrio)/0.03)] p-5">
        <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

export function PanelTerminal({ etiqueta }: { etiqueta: string }) {

  return (
    <div className="space-y-4">
      <Tarjeta
        titulo={`Terminal · ${etiqueta}`}
        subtitulo="Aquí todavía no se puede escribir ni ejecutar código: esto es la forma que tendrá, sin nada detrás."
        extremo={<Insignia tono="NEUTRO">no construido</Insignia>}
      >
        {/*
          🔴 LA PARADA YA NO ESTÁ AQUÍ: subió al MARCO, y por eso ahora sale en
          las seis pestañas. Era exigencia del documento de diseño (§4), y
          además cierra un hueco real — con la parada solo en esta pantalla y en
          Conducir, quien estuviera mirando la telemetría o el LIDAR con el robot
          en marcha tenía que CAMBIAR DE PANTALLA para pararlo.

          Lo que sí se queda es el porqué de que aquí importe tanto: el alumno
          lanza sus guiones por SSH, así que el robot se mueve de verdad mientras
          esta pantalla está abierta y sin que ella haya mandado nada.
        */}
        <div className="px-5 py-5">
          <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
            La parada está arriba, en la franja del marco, y sale en las seis pestañas. Para el
            robot <strong className="text-foreground/85">venga la orden de donde venga</strong>,
            incluido un guion que hayas lanzado por SSH. No hay botón para liberarla: soltarla es
            un acto presencial, junto al robot.
          </p>
        </div>

        {/* EL CHASIS. Dos columnas que se apilan en móvil. */}
        <div className="grid gap-5 border-t border-[rgb(var(--filo)/0.09)] px-5 py-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Hueco etiqueta="Editor · tu código">
              No hay editor. <strong className="text-foreground/85">Y tampoco hay uno de
              mentira</strong>: ni resaltado de sintaxis, ni números de línea, ni cursor. Una caja
              en la que se puede escribir y que no ejecuta nada es peor que una vacía.
            </Hueco>
          </div>
          <div className="lg:col-span-2">
            <Hueco etiqueta="Salida del programa">
              Sin cursor, sin prompt y sin una sola línea de texto simulado. Lo que iría aquí es lo
              que imprima tu guion, en vivo.
            </Hueco>
          </div>
        </div>

        {/* LA LÍNEA DE ENTRADA: visible y desactivada, con el motivo debajo. */}
        <div className="border-t border-[rgb(var(--filo)/0.09)] px-5 py-5">
          <label
            htmlFor="stdin-taller"
            className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            Lo que le contestas al programa
          </label>
          <input
            id="stdin-taller"
            type="text"
            disabled
            placeholder="el programa te pedirá que midas algo y pulses Enter"
            className="w-full cursor-not-allowed rounded-md border border-[rgb(var(--filo)/0.12)] bg-[rgb(var(--vidrio)/0.03)] px-3.5 py-2.5 font-mono text-sm text-muted-foreground placeholder:text-muted-foreground/50"
          />
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
            Desactivada porque no hay nada al otro lado. Sin esta línea,{' '}
            <strong className="text-foreground/85">dos prácticas de diez están muertas</strong>:
            los cuatro <code className="font-mono">input()</code> de{' '}
            <code className="font-mono">04_giro_preciso.py</code> y el de{' '}
            <code className="font-mono">99_test_ctrl_c.py</code>.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full bg-[rgb(var(--vidrio)/0.07)] px-5 py-2 text-sm font-semibold text-muted-foreground"
            >
              Ejecutar
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full border border-[rgb(var(--filo)/0.12)] px-5 py-2 text-sm font-medium text-muted-foreground"
            >
              Parar el programa
            </button>
            <span className="font-mono text-sm text-muted-foreground">PID —</span>
            <span className="text-xs text-muted-foreground">
              El PID es dato de la práctica 99, no decoración. Los tres necesitan el agente de
              sesión.
            </span>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Qué falta, en orden"
        subtitulo="Tres casillas, no un avance medido: ninguna se puede saltar y ninguna está a medias."
      >
        <ol className="divide-y divide-[rgb(var(--filo)/0.09)]">
          {CADENA.map((c) => (
            <li key={c.paso} className="flex gap-4 px-5 py-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--filo)/0.16)] font-mono text-xs text-muted-foreground">
                {c.paso}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <h3 className="text-[15px] font-semibold tracking-tight">{c.titulo}</h3>
                  <span className="text-[11px] uppercase tracking-wider text-estado-mirar">
                    {c.estado}
                  </span>
                </div>
                <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                  {c.porque}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <Tarjeta
        titulo="Lo que el agente tendrá que dar"
        subtitulo="Cada requisito con la medida que lo obliga. Es lo que separa «no está hecho» de «no está hecho de cualquier manera»."
      >
        <ul className="divide-y divide-[rgb(var(--filo)/0.09)]">
          {REQUISITOS.map((r) => (
            <li key={r.titulo} className="px-5 py-4">
              <h3 className="text-[15px] font-semibold tracking-tight">{r.titulo}</h3>
              <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                {r.porque}
              </p>
            </li>
          ))}
        </ul>
      </Tarjeta>

      {/*
        🔴 LA CUENTA DEL ESPACIO VA **ANTES** DE EJECUTAR, NO EN UNA AYUDA.
        En cuanto el guion construye `Robot()`, la biblioteca enciende el
        barrido y el robot ya obedece. Para cuando alguien buscara esta tabla
        detrás de un clic, el robot ya se estaría moviendo.
      */}
      <Tarjeta
        titulo="Haz la cuenta del espacio, antes"
        subtitulo="El robot no esquiva: solo tiene la capa de seguridad, y esa necesita el barrido encendido."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-medium">práctica</th>
                <th scope="col" className="px-5 py-2.5 font-medium">qué despejar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--filo)/0.08)]">
              {ESPACIO.map((p) => (
                <tr key={p.fichero ?? 'propio'}>
                  <td className="px-5 py-2.5">
                    <span className="font-mono text-[12.5px] text-muted-foreground">
                      {p.fichero ?? '—'}
                    </span>
                    <span className="ml-2.5">{p.titulo}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    {p.despejar === null ? (
                      <span className="italic text-muted-foreground">
                        no se puede saber: la cuenta sale de tu código
                      </span>
                    ) : p.despejar}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-2 border-t border-[rgb(var(--filo)/0.09)] px-5 py-4">
          {AVISOS_ESPACIO.map((a) => (
            <li key={a} className="max-w-prose text-[13px] leading-relaxed text-estado-mirar">
              · {a}
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}
