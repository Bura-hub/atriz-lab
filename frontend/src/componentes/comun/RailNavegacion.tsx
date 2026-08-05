'use client'

/**
 * EL RAÍL. La navegación de la aplicación, permanente y a la izquierda.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUÉ EXISTE, Y NO ES SOLO PARECIDO CON LA MAQUETA
 * ═══════════════════════════════════════════════════════════════════════════
 * Hasta ahora **no había navegación global**: cada zona montaba su propia
 * cabecera y los enlaces entre ellas eran cinco en toda la aplicación. El
 * inventario destapó tres agujeros reales:
 *
 *   · `/cuaderno` **no tenía ni un enlace de salida**: solo se salía con el
 *     botón «atrás» del navegador.
 *   · **la portada no era alcanzable** desde ninguna otra pantalla.
 *   · desde el muro no se llegaba al cuaderno, ni al revés.
 *
 * El raíl los cierra los tres, y de paso unifica cuatro anchos de página
 * distintos que se habían ido acumulando.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 DOS COSAS EN LAS QUE **NO** SE SIGUE A LA MAQUETA, Y SU MOTIVO
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. **El descriptor bajo la marca.** La maqueta pone «Fleet Operational
 *    Control»: está en inglés —el proyecto entero es en español— y afirma que
 *    esto es un control de flota **remoto**, que es exactamente lo que la
 *    decisión 17 dice que NO es. Es un taller presencial: el alumno está en la
 *    misma sala que el robot, midiendo con cinta.
 *
 * 2. **El color de la entrada activa.** La maqueta la pinta en lima `#B6E01E`,
 *    que **es el color del estado «mirar»** de esta aplicación. Usar un color
 *    del vocabulario de estados para navegación lo rompe: a partir de ahí el
 *    lima ya no significa «míralo», significa «estás aquí». La activa va en
 *    `--primary`.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import {
  IconoConducir, IconoCuaderno, IconoDiagnostico, IconoFlota, IconoLidar,
  IconoNoObedece, IconoPortada, IconoTaller, IconoTelemetria, PropsIcono,
} from './Iconos'

export interface EntradaRail {
  href: string
  texto: string
  Icono: (p: PropsIcono) => ReactNode
  /** Se pinta atenuado y con la coletilla. Para el terminal. */
  bloqueada?: boolean
}

/** Las seis pestañas de un robot, en el orden del documento. */
export function pestanasDeRobot(segmento: string): EntradaRail[] {
  const base = `/robot/${segmento}`
  return [
    { href: base, texto: 'Taller', Icono: IconoTaller, bloqueada: true },
    { href: `${base}/conducir`, texto: 'Conducir', Icono: IconoConducir },
    { href: `${base}/no-obedece`, texto: 'Por qué no obedece', Icono: IconoNoObedece },
    { href: `${base}/telemetria`, texto: 'Telemetría', Icono: IconoTelemetria },
    // 🔴 El LIDAR va en su PROPIA pestaña, y eso no es organizacion: es coste.
    //    `/scan` es el 83 % del trafico de un robot, asi que su suscripcion
    //    tiene que morir al salir.
    { href: `${base}/lidar`, texto: 'LIDAR', Icono: IconoLidar },
    { href: `${base}/diagnostico`, texto: 'Diagnóstico', Icono: IconoDiagnostico },
  ]
}

/** Los tres destinos que existen siempre, haya robot o no. */
const GENERALES: EntradaRail[] = [
  { href: '/flota', texto: 'Flota', Icono: IconoFlota },
  { href: '/cuaderno', texto: 'Cuaderno', Icono: IconoCuaderno },
  { href: '/', texto: 'Portada', Icono: IconoPortada },
]

function Entrada({ e, activa }: { e: EntradaRail; activa: boolean }) {
  return (
    <Link
      href={e.href}
      aria-current={activa ? 'page' : undefined}
      className={`pulsable focus-ring flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-[var(--t-estado)] ${
        activa
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-[rgb(var(--vidrio)/0.06)] hover:text-foreground'
      }`}
    >
      <e.Icono className="shrink-0" />
      <span className="truncate">{e.texto}</span>
      {e.bloqueada === true && (
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider opacity-60">
          bloqueado
        </span>
      )}
    </Link>
  )
}

export interface PropsRail {
  /** Las seis del robot. Vacío fuera de `/robot/[id]`. */
  pestanas?: readonly EntradaRail[]
  /**
   * La parada de emergencia, abajo del todo.
   *
   * 🔴 Llega como `ReactNode` y no se construye aquí a propósito: necesita el
   *    `Transporte` del robot, que solo existe dentro de `ProveedorRobot`. El
   *    raíl vive por encima de ese proveedor, así que la pieza la inyecta quien
   *    sí está dentro (`MarcoRobot`).
   */
  parada?: ReactNode
}

export function RailNavegacion({ pestanas = [], parada }: PropsRail) {
  const ruta = usePathname()

  return (
    /*
      En escritorio es una columna fija a la izquierda. Por debajo de `lg` se
      convierte en una TIRA HORIZONTAL desplazable arriba — no en un menú
      escondido tras un botón, porque **la parada de emergencia no puede quedar
      detrás de un clic**.
    */
    <nav
      aria-label="Navegación principal"
      className="relative z-20 flex shrink-0 flex-col gap-5 border-b border-[rgb(var(--filo)/0.08)] bg-pozo-alto/80 px-4 py-4 backdrop-blur-xl lg:h-screen lg:w-[272px] lg:border-b-0 lg:border-r lg:px-5 lg:py-6"
    >
      <Link href="/" className="focus-ring shrink-0 rounded-md">
        <span className="block text-[1.6rem] font-extrabold leading-[0.9] tracking-[-0.05em] text-foreground">
          Plataforma<br />Atriz
        </span>
        {/*
          🔴 En español, y sin llamarlo «control de flota remoto»: es un taller
             PRESENCIAL, y decir lo contrario es la afirmación que la decisión
             17 del proyecto tiene prohibida.
        */}
        <span className="mt-2 block text-[10px] uppercase leading-relaxed tracking-[0.18em] text-muted-foreground">
          Laboratorio de robótica
          <br />
          presencial
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {pestanas.length > 0 && (
          <>
            {pestanas.map((e) => (
              <Entrada key={e.href} e={e} activa={ruta === e.href} />
            ))}
            <hr className="my-2 hidden border-[rgb(var(--filo)/0.08)] lg:block" />
          </>
        )}
        {GENERALES.map((e) => (
          <Entrada key={e.href} e={e} activa={ruta === e.href} />
        ))}
      </div>

      {parada !== undefined && <div className="shrink-0">{parada}</div>}
    </nav>
  )
}
