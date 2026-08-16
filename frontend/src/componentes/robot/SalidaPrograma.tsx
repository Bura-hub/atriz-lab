'use client'

/**
 * LO QUE IMPRIME EL PROGRAMA DEL ALUMNO, con las trazas señaladas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL COLOR NO VIENE DEL ROBOT: SE DEDUCE AQUI
 * ═══════════════════════════════════════════════════════════════════════════
 * El agente arranca el programa con `TERM='dumb'` a proposito
 * (`agente_nucleo.py:450`), asi que **no llega ni una secuencia de escape**. Lo
 * unico que queda para distinguir un error de una medida es la forma del texto,
 * y de eso se encarga `salida_resaltada.ts`.
 *
 * ⚠️ Es una heuristica y la pantalla lo dice. Un `print('Traceback (most recent
 *    call last):')` del alumno se pintara como una traza: es literalmente el
 *    mismo texto. El aviso solo sale cuando se ha marcado algo — uno que salga
 *    siempre acaba sin leerse.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE SE AGRUPA, Y NO ES UNA OPTIMIZACION PREMATURA
 * ═══════════════════════════════════════════════════════════════════════════
 * Hoy la salida son hasta 4000 lineas en **un solo nodo de texto**, que es
 * baratisimo. Un elemento por linea serian 4000 elementos reconciliados en cada
 * trozo que llega del PTY —a 10 Hz en el seguidor de linea, **con el robot en
 * marcha y el alumno teniendo que poder pulsar Parar**—.
 *
 * `segmentar()` junta las lineas llanas consecutivas, asi que un programa que no
 * falla devuelve UN bloque y el DOM queda **exactamente como esta hoy**. El coste
 * va con el numero de trazas, no con el de lineas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 CADA TROZO VA DENTRO DE UN ELEMENTO, Y ESO NO ES ESTILO
 * ═══════════════════════════════════════════════════════════════════════════
 * `navegador_cdp.ts:165` barre las HOJAS del DOM —los elementos sin hijos— y
 * sobre ellas corren tres guardias de `pantallas_reales.test.ts`: repeticiones,
 * markdown sin renderizar, y «la salida no inventa nada».
 *
 * Un trozo escrito como texto suelto dentro del `<pre>` **no seria una hoja**, y
 * las tres guardias dejarian de ver la salida sin que nada se pusiera en rojo.
 * Por eso hasta los bloques llanos van en un `<span>`: para que lo que hoy se
 * vigila se siga vigilando.
 *
 * ⚠️ TRAMPA APUNTADA PARA QUIEN LO EJECUTE CON UN ROBOT: esa tercera guardia
 *    rechaza cualquier hoja que case `/^Traceback/`. Hoy no salta porque la
 *    prueba abre la pantalla en frio y la salida esta VACIA —renderiza un `<p>`,
 *    no este componente—. Si algun dia la prueba llega a ejecutar un programa que
 *    falle, saltara sobre una traza REAL, que es justo lo contrario de lo que esa
 *    guardia quiere cazar. Se arregla acotandola al estado vacio, no cegandola.
 */

import { useMemo } from 'react'
import { segmentar, type ClaseLinea, type Segmento } from '@/lib/taller/salida_resaltada'

/**
 * De clase de linea a clase de CSS.
 *
 * 🔴 NINGUNA ES ROJA, y es deliberado: `MarcoRobot` promete que la parada de
 *    emergencia es el unico elemento en rojo, el Taller enseña ese boton en esta
 *    misma pantalla, y este proyecto ya descubrio que esa promesa era FALSA en
 *    `/no-obedece` —cuatro cosas en el rojo del boton—. Una traza en rojo seria
 *    el cuarto rojo otra vez. Se lee como error por la ESTRUCTURA: filete al
 *    lado, marcos apagados y el mensaje final en tinta plena y seminegrita.
 */
const CLASE: Record<ClaseLinea, string> = {
  normal: '',
  // 🔴 `--consola-apagada` y no `--muted-foreground`: el gris de la aplicacion
  //    esta calculado sobre papel y sobre el panel oscuro da **2,11:1**, o sea
  //    ilegible. Aqui son 6,60:1, medidos sobre `--consola-fondo`.
  traza_cabecera: 'text-[rgb(var(--consola-apagada))]',
  traza_fichero: 'text-[rgb(var(--consola-apagada))]',
  traza_codigo: '',
  // Los `^^^^` de Python 3.11+ señalan el trozo exacto que fallo: es la
  // informacion mas util de la traza entera y lleva la tinta del mensaje.
  traza_marca: 'font-semibold',
  traza_error: 'font-semibold',
}

/** Un bloque llano, o una traza entera con sus lineas. */
type Grupo =
  | { traza: false; segmento: Segmento }
  | { traza: true; lineas: Segmento[] }

/** Junta los segmentos de traza CONSECUTIVOS para poder ponerles un filete. */
function agrupar(segmentos: readonly Segmento[]): Grupo[] {
  const grupos: Grupo[] = []
  for (const s of segmentos) {
    if (s.clase === 'normal') { grupos.push({ traza: false, segmento: s }); continue }
    const ultimo = grupos[grupos.length - 1]
    if (ultimo !== undefined && ultimo.traza) ultimo.lineas.push(s)
    else grupos.push({ traza: true, lineas: [s] })
  }
  return grupos
}

export interface SalidaProgramaProps {
  lineas: readonly string[]
  /** Lo ultimo que llego sin terminar en salto. Nunca es una traza: esta a medias. */
  cola: string
}

export function SalidaPrograma({ lineas, cola }: SalidaProgramaProps) {
  const grupos = useMemo(() => agrupar(segmentar(lineas)), [lineas])

  return (
    <>
      {/*
        El indice como clave: la salida se regenera entera con cada trozo que
        llega del PTY, asi que no hay ninguna clave estable que dar.
      */}
      {grupos.map((g, i) => (g.traza
        ? (
          <span
            key={i}
            /*
              🔴 EL FILETE SUBE A `--sintaxis-numero`. `--estado-mirar` es un ambar
                 calculado para papel y sobre el panel oscuro cae a **3,39:1** —
                 por debajo del suelo—, asi que el unico elemento que dice «esto
                 es una traza» se habria vuelto casi invisible justo al oscurecer.
                 El durazno de la consola da 9,63:1 y es de la misma familia.
            */
            className="my-1 block border-l-2 border-[rgb(var(--sintaxis-numero))] pl-2.5"
          >
            {g.lineas.map((l, j) => (
              <span key={j} className={`block ${CLASE[l.clase]}`}>{l.texto}</span>
            ))}
          </span>
        )
        : <span key={i} className="block">{g.segmento.texto}</span>
      ))}
      {/*
        La cola va aparte y SIN clasificar: es media linea, todavia sin su salto.
        Es lo que hace visible el `input()` de una practica, que pregunta sin
        terminar la linea — clasificarla la haria parpadear al completarse.
      */}
      {cola !== '' && <span className="block">{cola}</span>}
    </>
  )
}
