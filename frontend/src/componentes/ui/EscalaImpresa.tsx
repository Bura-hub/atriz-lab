/**
 * LA ESCALA SERIGRAFIADA BAJO UNA MEDIDA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ES LA FIRMA DE LA DIRECCIÓN, Y CONTESTA UNA PREGUNTA QUE LA CIFRA NO PUEDE
 * ═══════════════════════════════════════════════════════════════════════════
 * «7,80 V» no dice si el robot está bien. Lo dice **7,80 dentro de 6,0–8,4, con
 * *baja* en 7,0 y *crítica* en 6,5**, que es lo que un frontal de banco lleva
 * impreso al lado del conector desde que sale de fábrica.
 *
 * Esta aplicación lo necesita más que un multímetro, porque casi ninguno de sus
 * números se interpreta solo: Nav2 dice `SUCCEEDED` a 41 cm, `avanzar(0.20, 3)`
 * da 26 de 60, y el polígono de seguridad son 15 cm que nadie ve.
 *
 * 🔴🔴 ESTE ENCABEZADO AFIRMABA DOS COSAS QUE HOY SON FALSAS, Y ERAN MÍAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Decía *«NO ES UNA BARRA DE PROGRESO: no hay relleno»* y *«NO DECIDE NADA: no
 * colorea según el umbral»*. Las dos dejaron de ser ciertas el mismo día
 * (2026-08-16), y las dos cayeron porque el usuario pidió justo eso — primero el
 * recorrido lleno, después el color por umbral.
 *
 * 📌 Se corrigen en vez de borrarse porque **este es el patrón que el proyecto
 *    persigue**: un comentario que describe un mundo anterior, en el fichero que
 *    lo contradice. Aquí caducó en horas; el `EstadoBarrido` de Conducir llevaba
 *    meses afirmando «apagado» sobre un LIDAR encendido.
 *
 * Lo que sí sigue en pie de aquellos dos párrafos:
 *
 * ⚠️ **El ancho NO es un porcentaje.** Esta escala no empieza en cero: la de la
 *    batería empieza en 6,00 V. Con 7,79 V el relleno llega al 74 % y eso NO es
 *    «74 % de batería». Por eso los extremos van rotulados con su VALOR.
 *
 * 🔴 **Sigue sin decidir nada.** El tono se le PASA desde fuera, y sale del
 *    mismo `nivelBateria()` que ya tiñe la insignia: se renderiza dos veces, se
 *    decide una. Y jamás `--destructive`, que es de la parada.
 *
 * 🔴 SE PINTA AUNQUE NO HAYA VALOR, a propósito. Con el robot apagado la regla y
 *    sus umbrales siguen ahí, igual que la serigrafía de un panel sin corriente.
 *    Es la misma decisión que ya tomó `Dato` con su `referencia`, y la que hace
 *    que esta tarjeta pase de cero cifras a tener la escala entera.
 */

import { CSSProperties } from 'react'
import { Escala, marcasVisibles, posicion } from '@/lib/interfaz/escala'

export interface PropsEscalaImpresa {
  /** `null` cuando no llegó. La escala se dibuja igual; el cursor no. */
  valor: number | null
  escala: Escala
  /**
   * Cómo se escribe un número en esta escala. Del formateador de la pantalla —
   * `voltios`, `centimetros`, `grados`…
   *
   * 🔴 **LA UNIDAD LA PONE ESTE FORMATO, Y NO HAY UNA PROP APARTE.** La había:
   *    `unidad?: string`, «lo que va serigrafiado bajo el extremo derecho». Y en
   *    el primer uso real salió **`8,40 V V`** — porque `voltios()` ya escribe la
   *    V. Dos sitios para decir lo mismo, y el segundo se estrenó contradiciendo
   *    al primero.
   *
   * 📌 Es la forma que este proyecto persigue: dos fuentes de verdad sobre un
   *    mismo dato acaban discrepando. Aquí discreparon en el primer render, que
   *    es la versión barata; la cara es `--estado-ir` valiendo exactamente
   *    `--destructive` sin que nadie lo viera durante semanas.
   *
   * ⚠️ Y lo destapó un PRIMER PLANO, no la página entera: en la captura completa
   *    esa V de más mide 4 px dentro de 3147 de alto. Por eso existe
   *    `herramientas/recorte.mjs`.
   */
  formato: (n: number) => string
  /**
   * El tono del relleno, como NOMBRE de variable CSS (`--estado-vivo`…).
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * 👤 PEDIDO POR EL USUARIO EL 2026-08-16, Y AQUÍ PONÍA LO CONTRARIO
   * ═══════════════════════════════════════════════════════════════════════════
   * El relleno nació en tinta neutra con este argumento mío: *«teñirlo según el
   * umbral pondría el veredicto en un segundo sitio —la insignia ya lo da— y la
   * escala dibuja, no juzga»*. **Era flojo, y por dos motivos:**
   *
   *   · Esta aplicación **busca** la redundancia: su regla central es que el
   *     estado se codifique tres veces —color, palabra y trama— porque una de
   *     cada doce personas no distingue el lima del coral. Decir lo mismo en la
   *     insignia y en la barra no es duplicar: es el tercer código otra vez.
   *   · Y no hay dos fuentes de verdad: el tono sale del MISMO `nivelBateria()`
   *     que ya tiñe la insignia. Se renderiza dos veces, se decide una.
   *
   * 🔴 LO QUE SÍ SOBREVIVE DE AQUEL ARGUMENTO, y es lo que hay que respetar:
   *    **nunca `--destructive`**. Ese rojo es exclusivo de la parada de
   *    emergencia, y este proyecto ya descubrió que `--estado-ir` valía su mismo
   *    RGB exacto y que `/no-obedece` tenía CUATRO cosas en el rojo del botón.
   *    Los tonos que se pasan aquí son del eje de ESTADO (`--estado-vivo`,
   *    `--estado-mirar`, `--estado-ir`), no el de la parada.
   *
   * ⚠️ Y el color NO va solo: la posición del cursor, los umbrales impresos y la
   *    palabra de la insignia siguen diciendo lo mismo sin él. En gris los tres
   *    tonos a este alfa se parecen — y da igual, porque no son el único código.
   *
   * Sin `tono`, el relleno es tinta neutra. Es lo correcto para una escala que
   * no tiene veredicto detrás.
   */
  tono?: string
}

export function EscalaImpresa({ valor, escala, formato, tono }: PropsEscalaImpresa) {
  const marcas = marcasVisibles(escala)
  const p = valor === null ? null : posicion(valor, escala)
  const pct = (n: number) => `${(n * 100).toFixed(3)}%`

  return (
    /*
     * `aria-hidden`: la escala es REDUNDANTE por diseño. El valor, su unidad y
     * los umbrales ya están en el DOM como texto en la tarjeta que la contiene —
     * leerlos otra vez le daría a un lector de pantalla dos versiones del mismo
     * dato, y la segunda sin contexto. Lo que aporta aquí es **la posición**, y
     * eso no se lee en voz alta.
     */
    <div aria-hidden="true" className="select-none pt-1.5">
      <div className="regla-escala">
        {/*
          🔴 EL RELLENO VA PRIMERO, Y EL ORDEN ES LA RAZÓN. Los umbrales y el
             cursor se pintan DESPUÉS, así que quedan por encima: un relleno que
             tapara la marca de «crítica» escondería justamente el dato que hace
             falta comparar con el nivel.
          👤 Pedido el 2026-08-16. Ver `.regla-relleno` en `globals.css` para lo
             que un relleno sí dice y lo que no —esta escala no empieza en cero,
             así que el ancho NO es un porcentaje de carga—.
        */}
        {p !== null && (
          <span
            className="regla-relleno"
            /*
             * 🔴 `--relleno` ES UNA PROPIEDAD PERSONALIZADA, no `background`.
             *    El modo oscuro forzado del navegador reescribe
             *    `background-color`, `color`, `border-color` y `background-image`
             *    del atributo `style` ANTES de que React hidrate — `PanelLeds` lo
             *    documenta desde que se vio en Edge. Una variable no es ninguna
             *    de esas cuatro, así que el HTML del servidor y el del cliente
             *    siguen coincidiendo y no hay aviso de hidratación.
             */
            style={{
              width: pct(p),
              ...(tono === undefined ? {} : { '--relleno': `var(${tono})` }),
            } as CSSProperties}
          />
        )}
        {marcas.map((m) => (
          <span
            key={m.nombre}
            className="regla-marca"
            style={{ left: pct(posicion(m.en, escala) ?? 0) }}
          />
        ))}
        {/*
          🔴 EL CURSOR SOLO SI HAY DÓNDE PONERLO. `p === null` cubre los dos
             casos que importan y que este proyecto ya pagó por separado: no hay
             dato, y el dato es `NaN`. Pintarlo en el 0 % sería indistinguible de
             una batería en el mínimo — o sea, inventar una alarma.
        */}
        {p !== null && <span className="regla-cursor" style={{ left: pct(p) }} />}
      </div>

      {/*
        Los rótulos van DEBAJO y en la cara del panel: son serigrafía, no datos.
        El de cada umbral se centra en su marca; los dos extremos van a los
        cantos.
      */}
      <div className="relative mt-1 h-[13px]">
        <span className="regla-rotulo" style={{ left: 0 }}>{formato(escala.min)}</span>
        {marcas.map((m) => (
          <span
            key={m.nombre}
            className="regla-rotulo -translate-x-1/2"
            style={{ left: pct(posicion(m.en, escala) ?? 0) }}
          >
            {m.nombre}
          </span>
        ))}
        <span className="regla-rotulo right-0" style={{ left: 'auto' }}>
          {formato(escala.max)}
        </span>
      </div>
    </div>
  )
}
