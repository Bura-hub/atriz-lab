/**
 * UN GRUPO DE LA PANTALLA, con su rótulo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTO EXISTE: LA PILA DE CAJAS IGUALES
 * ═══════════════════════════════════════════════════════════════════════════
 * Las pestañas del robot eran una pila plana de tarjetas: cuatro, seis, ocho
 * cajas blancas del mismo tamaño, una detras de otra, sin nada que dijera cuales
 * van juntas ni por que. Con eso, la unica jerarquia posible es el ORDEN — y el
 * orden no se ve.
 *
 * Las maquetas de Stitch no hacen eso en ninguna pantalla: parten la pagina en
 * GRUPOS con nombre —«FLUJO CONTINUO DEL RVR», «SONDEO DRIVER», «SALIDAS
 * DIRECTAS»— y dentro de cada uno ponen las tarjetas que le pertenecen.
 *
 * El rotulo no es decoracion, es INFORMACION: dice de donde viene lo que hay
 * debajo. En este proyecto eso importa mas que en la mayoria, porque los datos
 * de una misma pantalla llegan por caminos distintos y a ritmos distintos —un
 * stream a 16,5 Hz, un sondeo cada 30 s, un servicio que se pregunta— y
 * confundirlos es lo que hace que alguien lea una temperatura de hace medio
 * minuto como si fuera de ahora.
 *
 * ⚠️ NO es una `Tarjeta`. No tiene superficie, ni borde, ni sombra: es solo un
 *    rotulo y un hueco. Meterle caja crearia una caja dentro de la caja, que es
 *    justo el ruido que este componente viene a quitar.
 */

import { ReactNode } from 'react'

export interface PropsGrupo {
  /** Corto y en mayusculas por CSS. «Flujo continuo», «Sondeo del driver». */
  titulo: string
  /**
   * Una linea que dice DE DONDE sale lo de dentro y CADA CUANTO llega. Opcional,
   * pero es lo que convierte el rotulo en informacion en vez de en un adorno.
   */
  fuente?: string
  children: ReactNode
}

export function Grupo({ titulo, fuente, children }: PropsGrupo) {
  return (
    <section className="space-y-3">
      {/*
        El rotulo va sobre una linea que cruza el ancho del grupo: es lo que hace
        que se lea como una division de la pagina y no como el titulo de la
        primera tarjeta. `items-baseline` para que el titulo y la fuente compartan
        linea base aunque tengan tamaños distintos.
      */}
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[rgb(var(--filo)/0.12)] pb-2">
        {/*
          🔴 EL CONTENEDOR NO PUEDE LEERSE MAS PEQUEÑO QUE SU CONTENIDO.

          Esto iba en `.microetiqueta` de 11 px sobre tarjetas cuyo titulo son 19
          semibold: la banda quedaba por debajo de lo que agrupa, asi que no
          llegaba a estructurar la pagina — se leia como una raya con una
          etiqueta, no como una division. En las maquetas de Stitch es al reves:
          «FLUJO CONTINUO DEL RVR» pesa mas que «ODOMETRIA BASE», que es un mono
          diminuto.

          17 px semibold en el tono de la pantalla, y en caja baja: en versalitas
          espaciadas esto se leia como un ROTULO DE DATO -que es lo que hace
          `.microetiqueta`- y aqui hace falta que se lea como un TITULO. No sube
          a 20 a proposito: no compite con el titulo de pantalla de la cabecera,
          que es el unico que manda. La escalera queda pantalla > grupo >
          tarjeta > dato.

          📝 Dos revisores de la segunda ronda, mirando pantallas distintas,
             dieron este mismo hallazgo con casi las mismas palabras: «el
             contenedor se lee mas pequeño que su contenido».

          📝 El tono va a plena tinta y aqui SI puede ir saturado —al contrario
             que en un campo— porque son dos palabras: el color identifica, no
             inunda.
        */}
        <h2
          className="text-[17px] font-semibold leading-none tracking-tight"
          style={{ color: 'rgb(var(--tono-seccion))' }}
        >
          {titulo}
        </h2>
        {fuente !== undefined && (
          <p className="microetiqueta">{fuente}</p>
        )}
      </header>
      {children}
    </section>
  )
}
