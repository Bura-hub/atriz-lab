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
    /*
      LA MISMA BARRA QUE EL MURO. Un alumno que llega desde el muro tiene que
      reconocer que sigue en el mismo sitio: el campo de color es lo que da esa
      continuidad, y por eso ocupa la cabecera entera y no un filete.

      Al irse las pestañas al raíl, el campo se queda con una sola fila: el
      relleno inferior pasa de cero —lo daban las lengüetas— a `pb-5`, para que
      la barra no quede pegada al contenido.
    */
    <header
      /*
        EL CANTO DE COLOR: una línea de 1 px con el tono de esta pestaña.
        Sustituye a lo que el suelo de calidad prohíbe —un borde lateral de color
        de más de 1 px— y además no desplaza nada al cambiar de pantalla, que era
        el defecto que ya se corrigió en las baldosas del muro.
      */
      className={`relative z-10 bg-pozo-alto shadow-barra ${tono === null ? '' : 'filo-estado'}`}
      style={tono === null ? undefined : ({ '--filo-estado': `var(${tono})` } as CSSProperties)}
    >
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {/*
              🔴 EL RÓTULO DE SECCIÓN, EN SU TONO. Antes el único sitio donde
                 vivía el tono de esta pantalla era un canto de 1 px sobre
                 1400 de ancho: en la captura no se distinguía de la sombra de
                 la barra. Aquí sí se ve, y **dice algo**: en móvil el raíl es
                 una tira que se desplaza, así que la entrada activa puede
                 quedar fuera de vista y esta era la única pantalla del robot
                 sin nada que dijera en cuál estás.

              ⚠️ Va en `.microetiqueta`, o sea en el nivel tipográfico de un
                 rótulo de dato, no en el de un titular: no compite con el
                 nombre del robot, que es lo que manda en esta barra.
            */}
            {seccion !== null && (
              <span
                className="microetiqueta w-full"
                style={{ color: `rgb(var(${seccion.color}))` }}
              >
                {seccion.texto}
              </span>
            )}
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {etiquetaRobot(destino)}
            </h1>
            {/* La URL, siempre visible: es lo que distingue «me equivoqué de
                robot» de «este robot no responde». */}
            <code className="font-mono text-xs text-muted-foreground">{url}</code>
          </div>
          <div className="flex items-center gap-3">
            <InsigniaEnlace sobreBarra />
            {/*
              «socket abierto/cerrado» y no «robot conectado»: lo que el
              navegador sabe es el estado de SU WebSocket. Un socket abierto
              contra un robot mudo sigue diciendo «abierto», y eso es exacto.
            */}
            <span className="text-xs text-muted-foreground">
              socket {conectado ? 'abierto' : 'cerrado'}
            </span>
          </div>
        </div>

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
        */}
        {/*
          ⚠️ La parada NO se estira. Iba con `flex-1 max-w-md`, o sea ~440 px de
             ancho por 90 de alto, y a su izquierda quedaban ~600 px con una
             sola linea pequeña dentro. Ahora tiene un ancho fijo -suficiente
             para que el rotulo entre en una linea, que es lo unico que importa-
             y el hueco que queda es respiro entre dos cosas, no un vacio.
        */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-t border-[rgb(var(--filo)/0.10)] pt-4">
          <VoltajeDelMarco />
          {/* 23rem y no menos: es lo que necesita «Parada de emergencia» para
              caer en UNA linea a `text-2xl`. Partido en dos se lee peor justo
              en el control que tiene que ser inequivoco. */}
          <div className="w-full shrink-0 sm:w-[23rem]">
            <BotonParada teleoperacion={teleoperacion} />
          </div>
        </div>
      </div>
    </header>
  )
}

export interface PropsMarcoRobot {
  destino: DestinoRobot
  children: ReactNode
}

export function MarcoRobot({ destino, children }: PropsMarcoRobot) {
  return (
    <ProveedorRobot robot={destinoParaTransporte(destino)}>
      <div className="relative min-h-screen bg-background text-foreground">
        {/* La misma luz que el muro: continuidad de mundo entre pantallas. */}
        <div className="luz-ambiente" aria-hidden="true" />
        <CabeceraRobot destino={destino} />
        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6">{children}</main>
      </div>
    </ProveedorRobot>
  )
}
