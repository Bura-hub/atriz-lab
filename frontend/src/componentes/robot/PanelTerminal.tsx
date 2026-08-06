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
import { Aviso } from '@/componentes/ui/Aviso'
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

/**
 * Una caja vacía con su motivo dentro. **Nunca con contenido simulado.**
 *
 * 🔴 EL RÓTULO VA DENTRO DE LA CAJA, Y LA CAJA MIDE 300 px.
 *
 * Antes el rótulo flotaba encima y la caja medía 190 px: el terminal —que es el
 * ASUNTO de esta pantalla— eran dos rectángulos punteados más bajos que
 * cualquiera de las tarjetas de texto que tenían debajo, y el rótulo se leía
 * como un párrafo suelto entre dos bloques en vez de como la cabecera de uno.
 * La maqueta de Stitch lo pinta al revés: un bloque alto con `EDITOR · TU
 * CÓDIGO` **dentro**, separado por su propia línea. Eso es lo que hace que el
 * hueco se lea como un chasis y no como un espacio que sobró.
 */
function Hueco({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    /*
      ⚠️ 210 px y no 300. A 300 con el texto centrado quedaban ~110 px de vacio
         encima y otros 110 debajo, dos veces: se leia como un componente que no
         termino de cargar, no como un chasis. El argumento del comentario -que
         la caja no sea mas baja que las tarjetas de debajo- se cumple igual.
    */
    <div className="flex min-h-[210px] flex-col rounded-md border border-dashed border-[rgb(var(--filo)/0.16)] bg-[rgb(var(--vidrio)/0.03)]">
      <p className="microetiqueta border-b border-[rgb(var(--filo)/0.12)] px-4 py-2.5">
        {etiqueta}
      </p>
      {/* `items-start`: el texto queda pegado bajo su rotulo y el hueco de abajo
          se lee como «aqui ira el codigo», que es lo que es. */}
      <div className="flex flex-1 items-start px-4 py-5">
        <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

export function PanelTerminal({ etiqueta }: { etiqueta: string }) {

  return (
    <div className="space-y-4">
      {/*
        🔴 EL PORQUÉ DE LA PARADA, EN EL PIE Y EN UNA LÍNEA — Y ANTES ABRÍA LA
           TARJETA CON CUATRO.

        Era un párrafo de cuatro líneas **antes del editor**, así que el asunto de
        la pantalla —el terminal— empezaba por debajo de la mitad del alto. Y
        decía dos cosas que ya están dichas 200 px más arriba, en la franja del
        marco: que la parada está ahí, y por qué no hay botón para liberarla (su
        propio desplegable lo explica con casi las mismas palabras). Repetirlo
        aquí no añadía nada y costaba el sitio del terminal.

        Lo que NO estaba dicho en ningún otro sitio se queda, porque es lo único
        que ata esta pantalla al robot de verdad: hoy los guiones se lanzan por
        SSH, así que el robot se mueve mientras esto está abierto sin que esta
        pantalla haya mandado nada.
      */}
      <Tarjeta
        titulo={`Terminal · ${etiqueta}`}
        subtitulo="Aquí todavía no se puede escribir ni ejecutar código: esto es la forma que tendrá, sin nada detrás."
        extremo={<Insignia tono="NEUTRO">no construido</Insignia>}
        pie={(
          <p>
            La parada de arriba para el robot{' '}
            <strong className="text-foreground/85">venga la orden de donde venga</strong>, incluido
            un guion que hayas lanzado por SSH — que es como se lanzan hoy, con esta pantalla
            abierta y sin que ella haya mandado nada.
          </p>
        )}
      >
        {/* EL CHASIS. Dos columnas que se apilan en móvil. */}
        <div className="grid gap-5 px-5 py-5 lg:grid-cols-5">
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
          {/* En `.microetiqueta`, como los rótulos de las dos cajas de arriba: al
              meterlos DENTRO de su caja, este se quedó siendo el único rótulo del
              terminal en otra tipografía. Un rótulo no puede pertenecer a dos
              familias en la misma pieza. */}
          <label
            htmlFor="stdin-taller"
            className="microetiqueta mb-2 block"
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

          {/*
            🔴 `rounded-md`, NO `rounded-full`. Eran las dos únicas píldoras de la
               aplicación: `Tarjeta` lleva escrito que «un instrumento no
               redondea», y una píldora al lado de una ficha troquelada se lee
               como un botón de otra interfaz. La forma también es vocabulario.
          */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md bg-[rgb(var(--vidrio)/0.07)] px-5 py-2 text-sm font-semibold text-muted-foreground"
            >
              Ejecutar
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md border border-[rgb(var(--filo)/0.12)] px-5 py-2 text-sm font-medium text-muted-foreground"
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
        {/*
          🔴 TRES FICHAS EN FILA, NO UNA LISTA VERTICAL.

          Debajo del terminal había tres tarjetas seguidas con la MISMA anatomía
          —lista vertical de título, estado en versalitas y párrafo—, así que la
          pantalla era la misma forma repetida cuatro veces y nada decía cuál de
          ellas importaba. Estas tres son **casillas**, no pasos de una lectura:
          en fila se ven las tres a la vez y se cuentan de un vistazo, que es lo
          que el propio subtítulo promete.

          En un `div` con su relleno: el cuerpo de `Tarjeta` va a sangre.
        */}
        <div className="px-5 py-5">
          {/* `items-start`: sin el, las tres fichas se estiran a la altura de la
              mas larga y la tercera -una linea- se quedaba con ~210 px de blanco
              dentro. `PanelNoObedece` ya resuelve este mismo caso asi, con su
              motivo escrito: una pantalla hacia bien lo que la otra hacia mal. */}
          <ol className="grid items-start gap-4 md:grid-cols-3">
            {CADENA.map((c) => (
              <li key={c.paso} className="pozo-interior flex flex-col p-4">
                <div className="flex items-baseline gap-3">
                  <span className="cifra-menor text-muted-foreground/45">{c.paso}</span>
                  {/* Sin `--estado-mirar`: es un color del vocabulario de ESTADO
                      y estas tres palabras no hablan del robot, hablan de lo que
                      falta por construir. El ordinal y la palabra ya las
                      separan. */}
                  <span className="microetiqueta">{c.estado}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight">
                  {c.titulo}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {c.porque}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Lo que el agente tendrá que dar"
        subtitulo="Cada requisito con la medida que lo obliga. Es lo que separa «no está hecho» de «no está hecho de cualquier manera»."
      >
        <ul className="divide-y divide-[rgb(var(--filo)/0.09)]">
          {REQUISITOS.map((r) => (
            <li key={r.titulo} className="px-5 py-4">
              <h3 className="text-base font-semibold tracking-tight">{r.titulo}</h3>
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
        {/* Mismo arreglo que en «no obedece»: los topos son de CSS, no un `·`
            tecleado dentro del texto —que se lleva el sangrado por delante y no
            lo ve ningún lector de pantalla—. */}
        {/*
          🔴🔴 ESTO ERA DOS PARRAFOS ENTEROS EN AMBAR, Y EL AMBAR ES ESTADO.

          `--estado-mirar` significa «este robot pide que lo mires». Aqui teñia
          dos avisos que **no dicen nada del robot** —hablan del espacio que hace
          falta para que una practica no choque contra nada—, asi que el color
          afirmaba algo falso. Y su hue es casi identico al de `--seccion-porque`
          (166 78 8), asi que la pantalla violeta llevaba ademas pegotes del color
          identitario de OTRA pantalla.

          Son advertencias de seguridad de verdad, asi que no pierden peso: pasan
          a un `Aviso` con su PALABRA. La regla del muro —«el color nunca va
          solo»— vale igual al reves: una advertencia no puede ir señalada solo
          por un color, y menos por uno prestado.
        */}
        <div className="border-t border-[rgb(var(--filo)/0.09)] px-5 py-4">
          <Aviso nivel="ATENCION" titulo="Espacio">
            <ul className="mt-1 list-disc space-y-1.5 pl-5 marker:text-muted-foreground/50">
              {AVISOS_ESPACIO.map((a) => (
                <li key={a} className="max-w-prose leading-relaxed">{a}</li>
              ))}
            </ul>
          </Aviso>
        </div>
      </Tarjeta>
    </div>
  )
}
