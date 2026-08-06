'use client'

/**
 * El marco del espacio de trabajo de UN robot: abre su conexion y la mantiene
 * mientras se navega entre sus pestañas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTO ES UN COMPONENTE DE CLIENTE Y EL `layout.tsx` NO
 * ═══════════════════════════════════════════════════════════════════════════
 * Los `layout.tsx` del App Router son **componentes de servidor por defecto**, y
 * un WebSocket solo puede vivir en el cliente. `ProveedorRobot` usa `useMemo`,
 * `useEffect` y `useState`; sin el `'use client'` de arriba, Next falla en
 * ejecucion con un error que **no menciona WebSockets** y manda a buscar donde no
 * es.
 *
 * → El `layout.tsx` se queda con lo que si es de servidor: leer `params`,
 *   interpretarlo y responder 404 si no nombra ningun robot. Lo que cruza la
 *   frontera es un objeto plano (`DestinoRobot`), que se serializa sin problema.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y POR QUE EL PROVEEDOR VA AQUI Y NO MAS ARRIBA
 * ═══════════════════════════════════════════════════════════════════════════
 * `robot/[id]/layout.tsx` es la frontera exacta del ciclo de vida de la
 * conexion: navegar entre `/telemetria`, `/conducir` y `/diagnostico` **no**
 * desmonta el layout, asi que el WebSocket no se corta al cambiar de pestaña;
 * navegar a otro robot **si** lo desmonta, porque cambia el segmento `[id]`, y
 * la limpieza de `useTransporte` cierra el socket viejo antes de abrir el nuevo.
 *
 * Con `/robot?id=` no habria pasado nada de eso: cambiar de robot no desmontaria
 * nada y la conexion vieja se quedaria viva -que es justo el fallo que la capa de
 * datos ya pago dos veces.
 */

import { usePathname } from 'next/navigation'
import { CSSProperties, ReactNode } from 'react'
import { entradaDeRuta } from '@/componentes/comun/RailNavegacion'
import { ProveedorRobot, useRobot } from '@/hooks/ContextoRobot'
import { urlDeRobot } from '@/lib/rosbridge/transporte'
import { DestinoRobot, destinoParaTransporte, etiquetaRobot } from '@/lib/interfaz/identidad'
import { VoltajeDelMarco } from './Bateria'
import { BotonParada } from './BotonParada'
import { InsigniaEnlace } from './EstadoEnlace'

/*
 * 🔴 LAS PESTAÑAS YA NO VIVEN AQUI. Se fueron al raíl
 * (`componentes/comun/RailNavegacion.tsx`), que es la unica navegacion de la
 * aplicacion. Antes habia DOS: esta barra para las seis pestañas del robot, y
 * nada para movese entre el muro, el cuaderno y la portada — de ahi que el
 * cuaderno no tuviera ni un enlace de salida.
 *
 * ⚠️ Y con ellas se fue una decision razonada que hay que volver a tomar: esta
 *    barra ponia «Por que no obedece» ENTRE conducir y diagnostico a proposito
 *    —«es donde alguien la busca, justo despues de intentar mover el robot»— y
 *    el rail la pone la tercera. El documento de diseño (§4) las lista en un
 *    TERCER orden. Los tres se contradicen y el conflicto sigue abierto.
 *
 * Lo que se queda aqui es lo que el rail NO tiene y esta pantalla si necesita:
 * el nombre del robot, su URL, y si el socket esta abierto.
 */

function CabeceraRobot({ destino }: { destino: DestinoRobot }) {
  // La teleoperacion se TOMA del contexto, no se crea: es una sola por conexion
  // y la crea el proveedor. Dos instancias serian dos bucles de 10 Hz sobre
  // `/cmd_vel_raw`.
  const { conectado, teleoperacion } = useRobot()
  const url = urlDeRobot(destinoParaTransporte(destino))
  /*
    La pestaña en la que estamos: da el rótulo Y el tono. `null` fuera de las
    rutas conocidas —y entonces no se pinta ningún canto ni ningún rótulo, en
    vez de inventarlos—.
  */
  const seccion = entradaDeRuta(usePathname())
  const tono = seccion?.color ?? null

  return (
    <>
      {/*
        ═══════════════════════════════════════════════════════════════════════
        🔴🔴 EL HERO DE LA PANTALLA, Y ANTES NO HABIA NINGUNO
        ═══════════════════════════════════════════════════════════════════════
        Esto era una barra blanca con el nombre del robot en `text-3xl` y el de
        la SECCIÓN en una `.microetiqueta` de 10 px. Consecuencia, vista en
        captura: **las seis pestañas eran la misma pantalla** con distinto
        contenido debajo, y ninguna tenía título propio.

        Y peor: se llega aquí desde el muro, donde ese mismo robot es una ficha
        de color saturado con su cifra enorme. Aterrizar en una barra blanca
        rompe la continuidad de mundo justo en el clic — que es precisamente lo
        que el comentario de este componente decía tener.

        Ahora el campo lleva el tono de IDENTIDAD de la pestaña, el título de
        pantalla es el título de pantalla, y la cifra fantasma es la misma firma
        que las fichas del muro. El nombre del robot y su URL suben al ante-
        título: siguen siempre visibles —«me equivoqué de robot» tiene que
        distinguirse de «este robot no responde»— pero dejan de ser lo único.

        🔴 EL TONO ES DE IDENTIDAD, NUNCA DE ESTADO. Ver `.campo-seccion` en
           `globals.css`: el color saturado del estado sigue siendo escaso y
           sigue significando lo mismo que en el muro.
      */}
      <header
        className={`relative z-10 ${tono === null ? 'bg-pozo-alto' : 'campo-seccion'}`}
        style={tono === null ? undefined : ({ '--tono-seccion': `var(${tono})` } as CSSProperties)}
      >
        {/* Textura, no contenido: por eso `aria-hidden` y por eso solo aparece
            cuando el destino es un robot NUMERADO. Una dirección IP suelta no
            tiene número que agrandar. */}
        {destino.clase === 'NUMERO' && (
          <span aria-hidden="true" className="cifra-fantasma">
            {String(destino.numero).padStart(2, '0')}
          </span>
        )}
        {/*
          🔴 LA BANDA SE QUEDA SOLO CON IDENTIDAD Y TITULO, y los signos vitales
             bajan enteros a la franja. Antes la insignia de enlace y el «socket
             cerrado» iban aqui arriba a la derecha, y **caian justo encima de la
             cifra fantasma**: se leian las dos superpuestas y ninguna se leia
             bien. Ademas dejaban los signos vitales repartidos en dos zonas
             -enlace arriba, bateria abajo- cuando son la misma pregunta.
        */}
        <div className="relative mx-auto max-w-6xl px-4 pb-9 pt-7 sm:px-6">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="microetiqueta !text-white/85">{etiquetaRobot(destino)}</span>
            <code className="font-mono text-[11px] text-white/60">{url}</code>
          </p>
          {/*
            El título de pantalla, por fin. `clamp` y no un tamaño fijo: cae de
            2,6 rem en un portátil a 1,9 en un móvil sin puntos de corte, que es
            donde se leía peor.
          */}
          <h1
            className="mt-2 font-semibold leading-[0.95] tracking-[-0.035em]"
            style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)' }}
          >
            {seccion?.texto ?? etiquetaRobot(destino)}
          </h1>
        </div>
      </header>

      {/*
        🔴 LA FRANJA DE SEGURIDAD, y está en LAS SEIS PESTAÑAS a propósito.

          Es exigencia escrita del documento de diseño (§4): «el marco le da la
          franja de seguridad con la parada y el voltaje en las seis pestañas,
          así que no cambia de pantalla para saber si el robot está vivo».

          Antes la parada vivía solo en Conducir y en el Terminal: quien
          estuviera mirando la telemetría, el LIDAR o el diagnóstico con el
          robot en marcha **tenía que cambiar de pantalla para pararlo**. Y el
          voltaje no estaba en ninguna parte del marco.

          Va aquí abajo y no en la fila de arriba porque la parada es un bloque
        —lleva el testigo del robot y el resultado del último intento—, no un
        control de una línea.

        🔴 Y VA SOBRE BLANCO, FUERA DEL CAMPO DE COLOR. El rojo de la parada es
           un color RESERVADO, y sobre un campo saturado —ámbar en «por qué no
           obedece», ciruela en diagnóstico— deja de destacar. Sobre papel no
           compite con nada.

        ⚠️ ESTE COMENTARIO DECÍA «el ÚNICO elemento en rojo de la pantalla», Y
           ERA FALSO. `--estado-ir` y `--destructive` valían el mismo RGB, así
           que en «por qué no obedece» había cuatro cosas exactamente del color
           del botón —el veredicto, la causa, el valor «cerrado» y su icono— y la
           parada no era única en nada. Lo pilló un revisor muestreando el píxel,
           no leyendo. Los dos tokens ya están separados; lo que se conserva es
           la lección: **una afirmación escrita en un comentario envejece igual
           que el código, y nadie la comprueba.**
      */}
      <div className="relative z-10 bg-pozo-alto shadow-barra">
        {/*
          ⚠️ La parada NO se estira. Iba con `flex-1 max-w-md`, o sea ~440 px de
             ancho por 90 de alto, y a su izquierda quedaban ~600 px con una
             sola linea pequeña dentro. Ahora tiene un ancho fijo -suficiente
             para que el rotulo entre en una linea, que es lo unico que importa-
             y el hueco que queda es respiro entre dos cosas, no un vacio.
        */}
        {/*
          🔴 TRES BLOQUES, NO DOS, Y ESO CIERRA LA MAYOR ZONA MUERTA DE LA APP.
             Con `justify-between` y solo dos hijos —voltaje y parada— quedaban
             ~550 px de blanco puro en el centro, justo por encima del pliegue y
             justo donde entra el ojo. El hueco no se rellena con adorno: se
             rellena con el OTRO signo vital, que estaba arriba compitiendo con
             la cifra fantasma. Bateria y enlace responden a la misma pregunta
             -«¿este robot esta vivo?»- y ahora se leen juntos.
        */}
        {/*
          ⚠️ `items-center` y `py-3`: la franja medía ~142 px con su contenido en
             las dos esquinas —batería+enlace arriba a la izquierda, parada a la
             derecha—, dejando un vacío en L de ~710×70 px en el centro. Sumada a
             la cabecera eran **270 px antes del primer contenido**, o sea un
             tercio de un portátil de aula gastado en dos cifras.
             Con el rótulo de la parada en UNA línea (ver `sm:w-[27rem]`) el
             bloque rojo baja de 124 px a ~75 y la franja entera a ~95.
        */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-4 px-4 py-3 sm:px-6">
          <VoltajeDelMarco />

          <div className="flex flex-col gap-1">
            <span className="microetiqueta">Enlace</span>
            <span className="flex flex-wrap items-center gap-2.5">
              <InsigniaEnlace sobreBarra />
              {/*
                «socket abierto/cerrado» y no «robot conectado»: lo que el
                navegador sabe es el estado de SU WebSocket. Un socket abierto
                contra un robot mudo sigue diciendo «abierto», y eso es exacto.
              */}
              <span className="text-xs text-muted-foreground">
                socket {conectado ? 'abierto' : 'cerrado'}
              </span>
            </span>
          </div>

          {/* `ml-auto`: la parada se ancla a la derecha sin `justify-between`,
              que es lo que abria el hueco cuando solo habia dos bloques. */}
          {/* 27rem: lo que necesita «PARADA DE EMERGENCIA» para caer en UNA
              linea a `text-2xl`. Partido en dos lineas el bloque medía 124 px de
              alto y era, con diferencia, el objeto mas pesado de la pantalla —
              por encima de cualquier dato. Ahora es igual de inequivoco y ocupa
              lo que le toca. */}
          <div className="w-full shrink-0 sm:ml-auto sm:w-[27rem]">
            <BotonParada teleoperacion={teleoperacion} />
          </div>
        </div>
      </div>
    </>
  )
}

export interface PropsMarcoRobot {
  destino: DestinoRobot
  children: ReactNode
}

export function MarcoRobot({ destino, children }: PropsMarcoRobot) {
  /*
    El mismo tono que la cabecera, y de la misma fuente. Fuera de una ruta
    conocida cae a grafito -`--estado-neutro`-, que es un gris: la tarjeta queda
    como estaba en vez de heredar un color inventado.
  */
  const tono = entradaDeRuta(usePathname())?.color ?? '--estado-neutro'

  return (
    <ProveedorRobot robot={destinoParaTransporte(destino)}>
      <div className="relative min-h-screen bg-background text-foreground">
        {/* La misma luz que el muro: continuidad de mundo entre pantallas. */}
        <div className="luz-ambiente" aria-hidden="true" />
        <CabeceraRobot destino={destino} />
        {/*
          `--tono-seccion` se pone AQUI y baja por herencia a todas las tarjetas
          de la pestaña: es lo que les da su capucha y el filete de su titulo sin
          enhebrar una prop por seis paneles. Y `.escalonado` les da la entrada
          en cascada, el mismo momento orquestado que tiene el muro.
        */}
        <main
          className="escalonado relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6"
          style={{ '--tono-seccion': `var(${tono})` } as CSSProperties}
        >
          {children}
        </main>
      </div>
    </ProveedorRobot>
  )
}
