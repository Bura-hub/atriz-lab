/**
 * EL DESENLACE DE UN OBJETIVO, COMO UNA LECTURA — no como un párrafo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ESTO ERAN ~400 CARACTERES DE PROSA, LEÍDOS CON EL ROBOT EN MARCHA
 * ═══════════════════════════════════════════════════════════════════════════
 * El `Aviso` de desenlace metía en un solo párrafo la historia del mapa rancio,
 * los 41 cm, el plazo de 20 ms de `bt_navigator` y la curva de anchos de hueco
 * —seiscientos caracteres en el caso de fallo—, y se lee **justo cuando el robot
 * acaba de pararse en el aula**: el peor instante para pedir cuatro renglones.
 *
 * Aquí se lee en este orden, que es el que importa:
 *
 *     SE DESPLAZÓ            LO QUE DIJO NAV2
 *     0,67 m                 ▬▬ ▬▬ ▬  falló
 *     según /odom            no dice dónde está el robot
 *
 *     Mira dónde está antes de repetirlo: puede haber llegado igual.
 *     ▸ Por qué
 *
 * 🔴🔴 **LO MEDIDO PRIMERO, LO QUE DIJO NAV2 DESPUÉS**, y esa inversión es lo
 *      que hace honesta a la pantalla. Si el titular fuera «terminó», la
 *      interfaz estaría dando peso de titular a la afirmación que se sabe falsa
 *      —`SUCCEEDED` a 41,3 cm, `ABORTED` sobre un robot que llegó—.
 *
 * 📌 El contexto **no se ha borrado**: vive en el `Contexto` de la tarjeta, que
 *    está a un clic y es donde el propio proyecto manda ponerlo — «¿cambia con
 *    lo que hace el robot ahora mismo? No → es contexto».
 */

import { SIN_DATO, metros } from '@/lib/interfaz/formato'
import {
  QueDijoLaAccion, nivelDe, queHacerAhora, rotuloDe,
} from '@/lib/robot/resultado_objetivo'
import { Dato } from '@/componentes/ui/Dato'

export interface PropsResultado {
  hora: string
  accion: QueDijoLaAccion
  /** Metros según `/odom`. `null` = no se pudo medir, que **no es cero**. */
  recorrido: number | null
  /** El mensaje del servidor de acción. Solo cuando falló. */
  motivo: string | null
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 «TERMINÓ» NO SE PINTA DE VERDE, Y CASI SE HACE
 * ═══════════════════════════════════════════════════════════════════════════
 * El reflejo era `marca-bien` + `--estado-vivo`: entera, sólida, verde. Pero ese
 * token está documentado como **«solo desde un dato RECIENTE y concreto»**, y lo
 * que aquí hay es exactamente lo contrario — la acción dice que acabó y **no se
 * sabe dónde**. Pintarlo en verde sería dar peso de confirmación a la afirmación
 * que esta tarjeta existe para desmentir: `SUCCEEDED` a 41,3 cm.
 *
 * Así que «terminó» se lleva la marca de **NO SE SABE** —media altura, apoyada
 * abajo—, que es la lectura honesta: el dato llegó, la información está
 * incompleta. Y «falló» se lleva la guionada, que es «hay que ir a mirar».
 *
 * 📌 **Ninguno de los dos se lleva la marca entera.** Esa es la forma de decir,
 *    en el tercer código, lo que la prosa dice en palabras: ni terminar ni
 *    fallar informan de dónde está el robot.
 */
const MARCA: Readonly<Record<QueDijoLaAccion, string>> = {
  TERMINO: 'marca-neutro',
  FALLO: 'marca-atencion',
}

const TINTA: Readonly<Record<QueDijoLaAccion, string>> = {
  TERMINO: 'text-[rgb(var(--estado-neutro))]',
  FALLO: 'text-[rgb(var(--estado-mirar))]',
}

export function ResultadoObjetivo({ hora, accion, recorrido, motivo }: PropsResultado) {
  return (
    /*
     * 🔴 `role="status"` Y NO `role="alert"`, y antes era `alert`. Un `ABORTED`
     *    está medido significando «el robot llegó diez segundos después», así
     *    que interrumpir al lector con una alerta afirma un fracaso que la
     *    propia tarjeta dice a continuación que no se sabe. `status` anuncia sin
     *    interrumpir, que es lo que corresponde a un resultado que hay que ir a
     *    comprobar.
     *
     * `.pozo-interior`: la ventana de lectura del frontal. Separa «el panel» de
     * «lo que el panel acaba de medir» sin gastar otra línea ni otro color.
     */
    <div className="pozo-interior mt-4 py-1" role="status">
      <div className="px-5 pt-3">
        <span className="microetiqueta">resultado · {hora}</span>
      </div>

      <div className="rejilla sm:grid-cols-2">
        {/*
          🔴 EL DESPLAZAMIENTO VA PRIMERO Y ES EL ÚNICO NÚMERO, porque es lo
             único medido. Lo pidió el robot con estas palabras: «lo que sí se
             puede mostrar es el desplazamiento por /odom, que es la fuente que
             acierta a 0,3-4,2 cm».

          ⚠️ Y LA NOTA NO ES OPCIONAL: «se desplazó» y «distancia al objetivo»
             son dos metros distintos en la misma tarjeta, y el segundo exige
             cruzar `map` con `odom` — **que es justamente el cruce que se
             equivoca**, el que produce los 41,3 cm. La etiqueta lleva la
             advertencia encima para que no haga falta deducirla.
        */}
        <Dato
          etiqueta="se desplazó"
          valor={recorrido === null ? SIN_DATO : metros(recorrido)}
          crudo={recorrido ?? undefined}
          nota={recorrido === null
            ? 'No llegó odometría con la que comparar, así que esto no es un cero: es un hueco.'
            : 'Según /odom, la fuente que acierta a 0,3-4,2 cm. No es la distancia al objetivo.'}
        />

        {/*
          Lo que dijo Nav2, en la misma rejilla pero SIN cifra: no es una medida
          y no puede parecerlo. Marca de estado + palabra, que es la redundancia
          que el proyecto exige.
        */}
        <div className="px-5 py-3.5">
          <div className="microetiqueta">lo que dijo Nav2</div>
          <div className={`mt-1 flex items-center gap-2 ${TINTA[accion]}`}>
            <span aria-hidden="true" className={`marca-estado ${MARCA[accion]}`} />
            <span className="text-lg font-semibold leading-none">{rotuloDe(accion)}</span>
          </div>
          <p className="mt-2 max-w-prose text-[11px] leading-snug text-muted-foreground/80">
            No dice dónde paró el robot. Se ha medido dando por cumplido un objetivo a{' '}
            <strong>41 cm</strong>, y abortando otro que el robot cumplió.
          </p>
        </div>
      </div>

      {/*
        La línea de acción. Es lo único que hay que hacer ahora, y por eso va
        sola, en tinta plena y con el peso del texto normal — no de una nota.
      */}
      <p className="max-w-prose px-5 pb-1 text-sm leading-relaxed">
        {queHacerAhora(accion)}
      </p>

      {/*
        🔴 EL MENSAJE DEL SERVIDOR VA EN CRUDO Y SIN TRADUCIR. Es lo que hay que
           pegar en un informe o buscar en el journal del robot; reescribirlo con
           palabras propias lo haría inbuscable. Solo aparece cuando falló: en el
           caso bueno no hay ninguno, y un hueco vacío se lee como algo que falta.
      */}
      {motivo !== null && motivo !== '' && (
        <p className="px-5 pb-3 pt-1">
          <code className="break-words text-[11px] text-muted-foreground">{motivo}</code>
        </p>
      )}

      {/*
        📝 El nivel se calcula y no se pinta como color de fondo: la ventana de
           lectura es la misma gane quien gane. Lo que cambia es la marca y la
           tinta de la palabra, que son los dos códigos que sí se leen de lejos.
           Se deja el cálculo a la vista para que la asimetría sea explícita.
      */}
      <span className="sr-only">{nivelDe(accion) === 'ATENCION' ? 'Requiere atención' : 'Nota'}</span>
    </div>
  )
}
