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
  /**
   * El tono de IDENTIDAD de esa pantalla, como nombre de variable CSS.
   *
   * 🔴 ES UN EJE DISTINTO DEL DE ESTADO, y separarlos es lo que permite tener
   *    color por todas partes sin romper el idioma. Los `--bloque-*` de la flota
   *    significan «este robot pide algo»; si esos mismos tres tonos se
   *    repartieran como adorno dejarían de significarlo —«si todas fueran de
   *    color la pantalla gritaría entera y no diría nada»—. Estos responden a
   *    «¿dónde estoy?», nunca a «¿qué pasa?», y por eso son hues que el
   *    vocabulario de estado no usa.
   */
  color: string
  /** Se pinta atenuado y con la coletilla. Para el terminal. */
  bloqueada?: boolean
}

/** Las seis pestañas de un robot, en el orden del documento. */
export function pestanasDeRobot(segmento: string): EntradaRail[] {
  const base = `/robot/${segmento}`
  return [
    { href: base, texto: 'Taller', Icono: IconoTaller, color: '--seccion-taller', bloqueada: true },
    { href: `${base}/conducir`, texto: 'Conducir', Icono: IconoConducir, color: '--seccion-conducir' },
    { href: `${base}/no-obedece`, texto: 'Por qué no obedece', Icono: IconoNoObedece, color: '--seccion-porque' },
    { href: `${base}/telemetria`, texto: 'Telemetría', Icono: IconoTelemetria, color: '--seccion-telemetria' },
    // 🔴 El LIDAR va en su PROPIA pestaña, y eso no es organizacion: es coste.
    //    `/scan` es el 83 % del trafico de un robot, asi que su suscripcion
    //    tiene que morir al salir.
    { href: `${base}/lidar`, texto: 'LIDAR', Icono: IconoLidar, color: '--seccion-lidar' },
    { href: `${base}/diagnostico`, texto: 'Diagnóstico', Icono: IconoDiagnostico, color: '--seccion-diagnostico' },
  ]
}

/**
 * Los tres destinos que existen siempre, haya robot o no.
 *
 * 📝 Exportado para que `rail.test.ts` pueda comprobarlo. No lo usa ningún otro
 *    componente: la navegación se dibuja aquí y solo aquí.
 */
export const GENERALES: EntradaRail[] = [
  /*
    🔴 LA PORTADA VA PRIMERA. Estaba la ULTIMA de las tres, asi que la puerta de
       entrada de la aplicacion aparecia debajo de todo y su pastilla activa se
       pintaba al final de la lista. El logotipo de arriba tambien lleva a la
       portada, pero un enlace ROTULADO no puede estar por debajo de los sitios a
       los que se llega desde el.

    ⚠️ Y va UNA sola vez. Al subirla, la primera version la AÑADIO sin borrar la
       de abajo: el rail salio con «Portada» dos veces, arriba y al final. Se vio
       en la primera captura despues del cambio, no compilando — el HTML era
       correcto y las pruebas pasaban. Un menu de navegacion que repite un destino
       es de las cosas que un cliente ve antes que el contenido.

    📝 Y su tono es `--seccion-portada`, no `--seccion-flota`: llevaba el cobalto
       del muro, asi que desde que su cabecera tiene campo de color el rail decia
       COBALTO y la banda de la pantalla decia VIOLETA para el mismo sitio.
  */
  { href: '/', texto: 'Portada', Icono: IconoPortada, color: '--seccion-portada' },
  { href: '/flota', texto: 'Flota', Icono: IconoFlota, color: '--seccion-flota' },
  { href: '/cuaderno', texto: 'Cuaderno', Icono: IconoCuaderno, color: '--seccion-cuaderno' },
]

/**
 * La entrada del raíl que corresponde a la ruta actual, para que el marco pueda
 * llevar **su nombre y su tono**. `null` fuera de las rutas conocidas: sin tono
 * inventado y sin rótulo inventado.
 *
 * 📝 Devuelve la entrada entera y no solo el color -que es lo que hacía antes-
 *    porque el marco necesita las dos cosas y sacarlas de la misma fuente es lo
 *    que impide que el rótulo y el tono se desincronicen.
 */
export function entradaDeRuta(ruta: string | null): EntradaRail | null {
  if (ruta === null) return null
  const m = /^\/robot\/([^/]+)/.exec(ruta)
  const candidatas = m === null ? GENERALES : pestanasDeRobot(m[1])
  return candidatas.find((e) => e.href === ruta) ?? null
}

function Entrada({ e, activa }: { e: EntradaRail; activa: boolean }) {
  return (
    <Link
      href={e.href}
      aria-current={activa ? 'page' : undefined}
      /*
        La entrada activa se pinta con el tono de SU pantalla, no con un azul
        único: así el raíl deja de ser una lista gris y el color dice dónde
        estás. En reposo el icono ya lleva su tono a media tinta, que es lo que
        hace que la columna tenga color sin gritar.
      */
      style={
        activa
          ? { backgroundColor: `rgb(var(${e.color}))` }
          : { color: `rgb(var(${e.color}) / 0.85)` }
      }
      className={`pulsable focus-ring flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-[var(--t-estado)] ${
        activa ? 'text-white' : 'hover:bg-[rgb(var(--vidrio)/0.05)]'
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
      // El raíl es una SUPERFICIE PROPIA (`--rail`), no el fondo ni una barra: se
      // separa del contenido por su tono, sin necesitar una línea gruesa. Sobre
      // papel eso es blanco puro contra el papel más cálido del lienzo.
      className="relative z-20 flex shrink-0 flex-col gap-5 border-b border-[rgb(var(--filo)/0.08)] bg-[rgb(var(--rail))] px-4 py-4 lg:h-screen lg:w-[272px] lg:border-b-0 lg:border-r lg:px-5 lg:py-6"
    >
      <Link href="/" className="focus-ring shrink-0 rounded-md">
        {/* La marca en el azul de la identidad, no en el color del texto: es lo
            que hace que se lea como logotipo y no como un titular más. */}
        <span className="block text-[1.6rem] font-extrabold leading-[0.9] tracking-[-0.05em] text-[rgb(var(--marca))]">
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
