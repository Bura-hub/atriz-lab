'use client'

/**
 * EL TERMINAL DEL ALUMNO — el producto, y la mitad BLOQUEADA de la aplicacion.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LA TRAMPA DE ESTA PANTALLA
 * ═══════════════════════════════════════════════════════════════════════════
 * Un terminal bonito con un editor de mentira y una salida con texto inventado
 * **es la maqueta de 1125 lineas renacida en miniatura**, y encima en la pestaña
 * principal. Seria fabricar exactamente el fallo que este proyecto entero
 * persigue, con la coartada del diseño.
 *
 * → **Regla de esta pantalla: CERO CONTENIDO FABRICADO.** Se dibuja el chasis,
 *   no una demostracion. El editor y la salida son contenedores vacios con su
 *   estado NOMBRADO, y ese nombre no es «cargando» ni «proximamente»: es **NO
 *   CONSTRUIDO**, el sexto tipo de estado vacio que ninguna guia de diseño
 *   contempla y que este proyecto necesita.
 *
 * ⚠️ El criterio para revisar esta pantalla es una sola pregunta: **¿alguien
 *    podria creer que esto ya funciona?** Si la respuesta no es un no rotundo,
 *    la pantalla esta mal.
 */

import { useRobot } from '@/hooks/ContextoRobot'
import { useTeleoperacion } from '@/hooks/useTeleoperacion'
import { BotonParada } from './BotonParada'

/** Un eslabon de la cadena de bloqueo, en orden. */
interface Eslabon {
  que: string
  estado: string
  porque: string
}

/**
 * 🔴 La cadena entera, y en orden. No es una lista de tareas: es la explicacion
 * de por que la pestaña principal de la aplicacion esta vacia, y quien la lea
 * tiene que poder seguir el hilo hasta el final sin preguntarle a nadie.
 */
const CADENA: readonly Eslabon[] = [
  {
    que: 'F0 · medir el punto de acceso del aula',
    estado: 'sin medir',
    porque:
      'si el AP aísla a sus clientes entre sí, el navegador no puede hablar con el robot y el '
      + 'transporte entero se replantea. Necesita estar en el aula, con un portátil y un robot. '
      + 'Diez minutos, y es el único experimento del proyecto que puede tirar un diseño completo.',
  },
  {
    que: 'Agente de sesión en el robot (puerto 9443)',
    estado: 'no escrito',
    porque:
      'el código del alumno corre EN el robot, con rclpy nativo sobre atriz.py, no por rosbridge. '
      + 'Hace falta algo que lo reciba, lo ejecute con una terminal de verdad y devuelva su salida. '
      + 'Su diseño depende de lo anterior.',
  },
  {
    que: 'Este terminal',
    estado: 'chasis dibujado, sin conectar',
    porque: 'lo que ves es la forma que tendrá. No hay editor ni salida porque no hay nada detrás.',
  },
]

export function PanelTerminal({ etiqueta }: { etiqueta: string }) {
  const { transporte } = useRobot()
  // 🔴 Se crea aqui porque esta pantalla es la dueña de su parada, y NUNCA llama
  //    a `mover()`: no arranca ningun bucle de 10 Hz. `BotonParada` exige recibir
  //    la teleoperacion en vez de crearla, justamente para que dos pantallas no
  //    publiquen `cmd_vel_raw` a la vez.
  const teleoperacion = useTeleoperacion(transporte)

  return (
    <div className="space-y-4">
      {/* ── EL CHASIS ───────────────────────────────────────────────────── */}
      <section className="border border-border bg-card">
        <header className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Terminal · {etiqueta}
          </h2>
          <span className="border border-border px-2 py-0.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            no construido
          </span>
        </header>

        <div className="rejilla lg:grid-cols-2">
          <div className="min-h-[13rem] p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Editor · el código del alumno
            </p>
            <p className="mt-3 max-w-prose font-mono text-sm text-muted-foreground">
              Aquí irá el código, unas 30 líneas. <strong>No hay editor todavía</strong> — y no hay
              tampoco un editor de mentira, porque una caja que se puede escribir y no ejecuta nada
              es peor que una vacía.
            </p>
          </div>

          <div className="min-h-[13rem] p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Salida del programa
            </p>
            <p className="mt-3 max-w-prose font-mono text-sm text-muted-foreground">
              Aquí saldrá lo que imprima el programa, mientras corre.{' '}
              <strong>No hay nada que mostrar</strong>: no hay ningún programa ejecutándose, así que
              esta caja está vacía a propósito y no con un ejemplo.
            </p>
          </div>
        </div>

        {/*
          🔴 LA LINEA DE ENTRADA SE VE, Y ESTA DESHABILITADA CON SU MOTIVO.
             Que se vea es el argumento: sin entrada bidireccional **dos de las
             diez prácticas están muertas**. `04_giro_preciso.py` tiene cuatro
             `input()` —el alumno mide con transportador y pulsa Enter— y
             `99_test_ctrl_c.py` un quinto. Esa consecuencia merece estar en
             pantalla y no solo enterrada en un plan.
        */}
        <div className="border-t border-border p-3">
          <label
            htmlFor="entrada-terminal"
            className="text-[11px] uppercase tracking-wide text-muted-foreground"
          >
            Entrada del programa
          </label>
          <input
            id="entrada-terminal"
            type="text"
            disabled
            placeholder="el programa pedirá que midas algo y pulses Enter"
            className="mt-1 w-full border border-border bg-muted/40 px-2 py-1 font-mono text-sm text-muted-foreground disabled:cursor-not-allowed"
          />
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Sin esta línea, <strong>dos de las diez prácticas no se pueden hacer</strong>: piden al
            alumno que mida con transportador y pulse Enter, cuatro y cinco veces. Por eso está
            dibujada aunque no funcione — es un requisito, no un adorno.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
          <button
            type="button"
            disabled
            className="border border-border px-4 py-2 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed"
          >
            Ejecutar
          </button>
          <button
            type="button"
            disabled
            className="border border-border px-4 py-2 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed"
          >
            Parar el programa
          </button>
          <span className="text-xs text-muted-foreground">
            Los dos necesitan el agente de sesión.
          </span>
        </div>
      </section>

      {/*
        ✅ Y ESTO SÍ FUNCIONA HOY, que es lo que separa esta pantalla de una
           maqueta. La parada está verificada contra el robot —4 de 4 corridas,
           frenada de 1,8 a 2,9 cm, con el driver confirmándolo en su bandera— y
           para el robot **venga la orden de donde venga**, incluido un guion del
           alumno lanzado por SSH. Que es justo lo que esta pestaña albergará.
      */}
      <section className="border border-border bg-card">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Esto sí funciona
          </h2>
        </header>
        <div className="p-3">
          <BotonParada teleoperacion={teleoperacion} />
          <p className="mt-2 max-w-prose text-xs text-muted-foreground">
            Para el robot aunque el programa lo esté moviendo desde un guion lanzado por SSH: el
            driver descarta todo mando de movimiento mientras la tenga puesta. Liberarla es
            presencial, con el robot delante.
          </p>
        </div>
      </section>

      {/* ── POR QUÉ ESTÁ VACÍO ──────────────────────────────────────────── */}
      <section className="border border-border bg-card">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Qué falta, en orden
          </h2>
        </header>
        <dl className="rejilla">
          {CADENA.map((e) => (
            <div key={e.que} className="p-3">
              <dt className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold">{e.que}</span>
                <span className="border border-border px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {e.estado}
                </span>
              </dt>
              <dd className="mt-1 max-w-prose text-xs text-muted-foreground">{e.porque}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        🔴 ESTO SOLO PUEDE VIVIR AQUÍ, y es incómodo de escribir: cuando el
           terminal exista, el alumno tendrá MÁS autoridad sobre el robot que
           esta web. Es el precio de que su código corra con rclpy nativo, y esta
           pantalla es su único domicilio posible.
      */}
      <section className="border border-warning/40 bg-warning/10 p-3">
        <h2 className="text-sm font-semibold">
          Cuando esto funcione, el alumno podrá más que esta web
        </h2>
        <p className="mt-1 max-w-prose text-xs">
          Su código corre con <code>rclpy</code> nativo en el robot, así que alcanza{' '}
          <code>raw_motors</code>, <code>move_timed</code>, <code>move_to_pose</code> y los modos de
          infrarrojos — los caminos que <strong>se saltan la capa de seguridad</strong> y que esta
          web tiene cerrados con una lista blanca. La frase «<code>raw_motors</code> ya no es
          alcanzable», que está verificada para el navegador, deja de ser cierta mientras haya una
          sesión de alumno en marcha. No es un fallo del diseño: es su precio, y está escrito aquí
          para que nadie lo descubra por sorpresa.
        </p>
      </section>
    </div>
  )
}
