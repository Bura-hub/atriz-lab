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
  IconoConducir, IconoCuaderno, IconoDiagnostico, IconoEntrar, IconoFlota, IconoLidar,
  IconoNavegar, IconoNoObedece, IconoTaller, IconoTelemetria, IconoUsuarios,
  PropsIcono,
} from './Iconos'
import { useSesion } from '@/hooks/ContextoSesion'
import { RanuraParada } from './RanuraParada'

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

/** Las SIETE pestañas de un robot, en el orden del documento. */
export function pestanasDeRobot(segmento: string): EntradaRail[] {
  const base = `/robot/${segmento}`
  return [
    /*
     * ✅ SIN `bloqueada` DESDE EL 2026-08-14. Era la única entrada que la
     *    llevaba, y lo llevó desde que la pestaña se dibujó: el terminal no
     *    existía, y decirlo en el raíl era lo honesto.
     *
     * Ahora existe. Lo que queda por medir —el PTY contra un robot— no es «no
     * hay nada detrás»: es exactamente la distinción que este mismo fichero hace
     * dos entradas más abajo para Navegar. Dejar la coletilla diría que no hay
     * nada, y lo hay.
     */
    { href: base, texto: 'Taller', Icono: IconoTaller, color: '--seccion-taller' },
    { href: `${base}/conducir`, texto: 'Conducir', Icono: IconoConducir, color: '--seccion-conducir' },
    { href: `${base}/no-obedece`, texto: 'Por qué no obedece', Icono: IconoNoObedece, color: '--seccion-porque' },
    { href: `${base}/telemetria`, texto: 'Telemetría', Icono: IconoTelemetria, color: '--seccion-telemetria' },
    // 🔴 El LIDAR va en su PROPIA pestaña, y eso no es organizacion: es coste.
    //    `/scan` es el 83 % del trafico de un robot, asi que su suscripcion
    //    tiene que morir al salir.
    { href: `${base}/lidar`, texto: 'LIDAR', Icono: IconoLidar, color: '--seccion-lidar' },
    /*
     * 🔴 «Navegar» va DESPUES del LIDAR y ANTES del diagnostico, no al final.
     *    El orden de estas pestañas es el del documento: primero lo que se hace
     *    con el robot (conducir, navegar), luego lo que se mira (telemetria,
     *    LIDAR) y al final por que falla. Navegar es una ACCION, y ponerla tras
     *    «Diagnostico» la habria dejado leyendose como un apendice.
     *
     * ⚠️ Y NO lleva `bloqueada: true` aunque hoy Nav2 no arranque solo. La
     *    diferencia con el Taller es real: el Taller **no esta construido**, y
     *    esta pantalla si — funciona en cuanto alguien levante `atriz-nav`, y
     *    mientras tanto explica que falta. Marcarla como bloqueada diria que no
     *    hay nada detras, y lo hay.
     */
    { href: `${base}/navegar`, texto: 'Navegar', Icono: IconoNavegar, color: '--seccion-navegar' },
    { href: `${base}/diagnostico`, texto: 'Diagnóstico', Icono: IconoDiagnostico, color: '--seccion-diagnostico' },
  ]
}

/**
 * Los destinos que existen siempre, haya robot o no.
 *
 * 📝 Exportado para que `rail.test.ts` pueda comprobarlo. No lo usa ningún otro
 *    componente: la navegación se dibuja aquí y solo aquí.
 *
 * 📝 Eran TRES y ahora son dos: ver abajo por qué se fue «Inicio». La historia
 *    de aquella entrada se conserva porque su lección sigue viva —«un menú de
 *    navegación que repite un destino es de las cosas que un cliente ve antes
 *    que el contenido»— y porque un enlace que desaparece sin explicación es lo
 *    que hace que alguien lo vuelva a añadir dentro de seis meses:
 *
 *      · Nació la ÚLTIMA de las tres y se subió a la primera, con el argumento
 *        de que «la puerta de entrada no puede estar por debajo de los sitios a
 *        los que se llega desde ella».
 *      · Al subirla, la primera versión la AÑADIÓ sin borrar la de abajo: el
 *        raíl salió con «Portada» dos veces. Se vio en una captura, no
 *        compilando — el HTML era correcto y las pruebas pasaban.
 *      · Se llamó «Inicio» y no «Portada» por decisión del usuario (2026-08-06).
 *      · Y su tono era `--seccion-portada`, no `--seccion-flota`: llevaba el
 *        cobalto del muro, así que el raíl decía COBALTO y la banda de la
 *        pantalla decía VIOLETA para el mismo sitio.
 */
export const GENERALES: EntradaRail[] = [
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 «INICIO» SE FUE DEL RAIL EL 2026-08-16, Y ERA UN CALLEJON SIN SALIDA
   * ═══════════════════════════════════════════════════════════════════════════
   * 👤 Lo reporto el usuario: «si le doy [a Inicio] me regresa al login aunque
   *    tenga cuenta, el rail se pierde, y si le doy entrar me deja en /entrar y
   *    no sigue al resto».
   *
   * Los tres sintomas son el mismo defecto de diseño, y es mio: **este rail solo
   * se ve CON sesion, y apuntaba a una pantalla que existe para quien NO la
   * tiene**. La portada vive en el grupo `(publico)`, que no monta `Armazon`,
   * asi que al pulsar aqui la navegacion desaparecia — y lo unico que ofrecia
   * esa pantalla era un boton «Entrar» que llevaba a otro sitio sin salida.
   *
   * Dos publicos opuestos en el mismo enlace. Desde hoy la portada REDIRIGE al
   * resumen cuando hay sesion, asi que dejar la entrada aqui seria un destino
   * del menu que en silencio te lleva a otro: peor que no tenerla.
   *
   * 📝 Y el logotipo de arriba sigue llevando a casa. Lo que se quita es el
   *    enlace ROTULADO, que era ademas un duplicado suyo.
   */
  { href: '/flota', texto: 'Flota', Icono: IconoFlota, color: '--seccion-flota' },
  { href: '/cuaderno', texto: 'Cuaderno', Icono: IconoCuaderno, color: '--seccion-cuaderno' },
]

/**
 * Administrar cuentas. Fuera de `GENERALES` a propósito: **no está siempre**, y
 * meterla ahí obligaría a filtrar la lista en dos sitios —al pintarla y en
 * `entradaDeRuta`—, con el riesgo de que uno de los dos se olvidara.
 *
 * 📝 `entradaDeRuta` SÍ la conoce (ver abajo): el rótulo y el tono de una
 *    pantalla no dependen de quién mire.
 */
const USUARIOS: EntradaRail = {
  href: '/usuarios', texto: 'Usuarios', Icono: IconoUsuarios, color: '--seccion-sesion',
}

/** La pantalla de entrar. Tampoco vive en el raíl: su enlace es el pie. */
const ENTRAR: EntradaRail = {
  href: '/entrar', texto: 'Entrar', Icono: IconoEntrar, color: '--seccion-sesion',
}

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
  /*
   * 🔴 `USUARIOS` y `ENTRAR` entran aquí AUNQUE no siempre se pinten en el raíl.
   *    El rótulo y el tono de una pantalla son suyos y no dependen de quién
   *    mire: si esta función las ignorara, sus cabeceras saldrían sin tono y sin
   *    nombre para la misma persona que las está usando.
   */
  const candidatas = m === null ? [...GENERALES, USUARIOS, ENTRAR] : pestanasDeRobot(m[1])
  return candidatas.find((e) => e.href === ruta) ?? null
}

function Entrada({ e, activa }: { e: EntradaRail; activa: boolean }) {
  return (
    <Link
      href={e.href}
      aria-current={activa ? 'page' : undefined}
      /*
        ═══════════════════════════════════════════════════════════════════════
        🔴🔴 EL RAÍL ERA UN ARCOÍRIS, Y ESO SE ACABÓ (2026-08-16)
        ═══════════════════════════════════════════════════════════════════════
        Aquí ponía: *«en reposo el icono ya lleva su tono a media tinta, que es
        lo que hace que la columna tenga color sin gritar»*. En una entrada,
        cierto. En **once** —siete pestañas de robot más Inicio, Flota, Cuaderno
        y Usuarios—, la columna entera salía en once hues distintos: violeta,
        teal, ámbar, verde, azul, magenta, ciruela, morado, cobalto, pizarra y
        tinta. Eso no es «color sin gritar»: es una lista de colores donde el
        color **ya no distingue nada**, porque todo lo tiene.

        Y choca de frente con la dirección: en un frontal de instrumento la
        nomenclatura va **grabada en una sola tinta**. La serigrafía de un panel
        no cambia de color por cada conector.

        → TODAS en tinta. El color aparece **una vez**, en la activa, y es el
          tono de la pantalla a la que lleva — así el raíl sigue diciendo «dónde
          estás» y sigue enganchando con la banda de esa pantalla, que es la
          continuidad que este proyecto ya construyó. Escaso otra vez, y por eso
          otra vez significa algo.

        📝 `rounded-none`: la píldora era la firma del «cualquier dashboard» que
           el encargo nombra como la primera forma de fallar, y en un panel nada
           es una cápsula.
      */
      style={activa ? { backgroundColor: `rgb(var(${e.color}))` } : undefined}
      className={`pulsable focus-ring flex items-center gap-3 rounded-none px-4 py-2.5 text-sm font-medium transition-colors duration-[var(--t-estado)] ${
        activa
          ? 'text-white'
          : 'text-muted-foreground hover:bg-[rgb(var(--vidrio)/0.05)] hover:text-foreground'
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
  /*
   * 📝 AQUÍ VIVÍA `parada?: ReactNode`, Y SE FUE CON EL PORTAL (2026-08-16).
   *
   * Era la ranura por la que el marco del robot iba a inyectar la parada, y su
   * comentario tenía el diagnóstico entero: *«necesita el `Transporte`, que solo
   * existe dentro de `ProveedorRobot`; el raíl vive por encima»*. Correcto — y
   * por eso **nadie podía pasarla nunca**. Una prop que solo puede rellenar
   * alguien que está por debajo de ti es una promesa que no se puede cumplir.
   *
   * La llena ahora un portal (`RanuraParada` / `EnLaRanuraDeParada`), que
   * atraviesa el DOM sin mover nada en el árbol de React.
   */
}

export function RailNavegacion({ pestanas = [] }: PropsRail) {
  const ruta = usePathname()
  const { usuario, cargando, caduco, refrescar } = useSesion()

  const salir = async () => {
    await fetch('/api/sesion/salir', { method: 'POST' })
    /*
     * 🔴 SE REFRESCA LA SESIÓN, NO SE PONE `usuario` A `null` A MANO. La verdad
     *    la tiene el servidor: si el borrado de la cookie fallara, poner `null`
     *    aquí enseñaría «has salido» con la sesión todavía viva — un estado
     *    engañoso sobre lo único que abre la liberación de una parada.
     *
     * 🔴 Y `'salida'` NO es decoración: sin él, salir a propósito encendería el
     *    aviso de «se acabó sola». Un aviso que también sale cuando no hay nada
     *    que avisar deja de leerse, y este proyecto lleva media docena de casos
     *    pagando exactamente eso.
     */
    await refrescar('salida')
  }

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

        {/*
          🔴 SOLO CON SESIÓN, Y SEPARADA POR UNA LÍNEA. `/usuarios` es otra clase
             de destino —administrar, no operar— y se lee como tal.

          ⚠️ Y esto es un filtro de INTERFAZ, no una autorización: quien no la ve
             igualmente recibe **401** si llama a `/api/sesion/usuarios` con
             `curl`. Ahí sí manda el servidor. Ocultar una entrada del menú no
             cierra nada por sí solo, y conviene tenerlo escrito para que nadie
             se apoye en ello.
        */}
        {usuario !== null && (
          <>
            <hr className="my-2 hidden border-[rgb(var(--filo)/0.08)] lg:block" />
            <Entrada key={USUARIOS.href} e={USUARIOS} activa={ruta === USUARIOS.href} />
          </>
        )}
      </div>

      {/*
        EL PIE DE SESIÓN. Quién eres y cómo salir, o el camino de entrar.

        📝 Mientras `cargando` no se pinta ninguna de las dos: no saber todavía
           no es «no hay sesión», y sin este tercer estado el raíl parpadearía
           en cada carga enseñando «entrar» a quien ya está dentro.
      */}
      {!cargando && (
        <div className="shrink-0 border-t border-[rgb(var(--filo)/0.08)] pt-3">
          {/*
            ═══════════════════════════════════════════════════════════════════
            🔴🔴 LA CADUCIDAD SE DICE, NO SE DEDUCE DE QUE EL BOTÓN CAMBIE
            ═══════════════════════════════════════════════════════════════════
            Sin esto, una sesión que vence a mitad de práctica solo se nota en
            que este pie pasa de tu nombre a «Entrar» — idéntico a haber salido
            tú. Y lo que la persona ve NO es el raíl: ve un robot que deja de
            contestar, y va a mirar el robot.

            🔴 NO es un diálogo que bloquee la pantalla, a propósito. Debajo de
               este raíl vive la parada de emergencia, y un modal encima de ella
               convertiría un problema de sesión en un problema de seguridad.
               Avisa, no secuestra.
          */}
          {caduco && (
            <p
              role="status"
              className="mb-3 border border-warning/40 bg-[rgb(var(--aviso-atencion))] px-3 py-2 text-[13px] leading-relaxed text-foreground"
            >
              <strong>Tu sesión se ha acabado.</strong> No la has cerrado tú: ha vencido sola. Los
              robots dejan de aceptar este navegador hasta que vuelvas a entrar —{' '}
              <strong>no es que estén apagados</strong>.
            </p>
          )}

          {usuario === null ? (
            <Link
              href="/entrar"
              className="pulsable focus-ring flex items-center gap-2 rounded-none px-4 py-2 text-sm text-muted-foreground hover:bg-[rgb(var(--vidrio)/0.05)]"
            >
              {caduco ? 'Volver a entrar' : 'Entrar'}
            </Link>
          ) : (
            <div className="px-4">
              <p className="microetiqueta">Sesión</p>
              <p className="mt-1 truncate text-sm font-medium">{usuario}</p>
              {/*
                ═══════════════════════════════════════════════════════════════
                🔴 UN BOTÓN, NO UN ENLACE SUBRAYADO DE 13 px
                ═══════════════════════════════════════════════════════════════
                👤 El usuario pidió el 2026-08-16 «un botón de cerrar sesión».
                   Lo había —esto mismo— y era un `Salir` subrayado, del tamaño
                   de un pie de foto, debajo del nombre: lo bastante discreto
                   como para que quien lo buscaba no lo encontrara. Que exista
                   no basta si no se ve; es la misma regla que este proyecto
                   aplica a la parada de emergencia.

                🔴 Y desde hoy es **el único camino para cambiar de cuenta**:
                   con sesión abierta, `/entrar` redirige al resumen. Si el
                   botón no se ve, el aula se queda con la cuenta del anterior.

                📝 «Cerrar sesión» y no «Salir». `Salir` es ambiguo en una
                   pantalla llena de destinos —¿salir de dónde, del robot?— y
                   fue justo lo que el usuario no encontró.
              */}
              <button
                type="button"
                onClick={() => { void salir() }}
                className="pulsable focus-ring mt-2.5 w-full rounded-none border border-[rgb(var(--filo)/0.22)] px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:border-[rgb(var(--filo)/0.4)] hover:text-foreground"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      )}

      {/*
        ═══════════════════════════════════════════════════════════════════════
        🔴🔴 LA PARADA DE EMERGENCIA, AL FIN EN SU RANURA (2026-08-16)
        ═══════════════════════════════════════════════════════════════════════
        Esta ranura existía desde que existe el raíl, con su párrafo explicando
        por qué hace falta, y **nunca se rellenó**: `BotonParada` necesita el
        `Transporte`, que vive por debajo del armazón. Era el defecto nº1 de la
        auditoría, y su consecuencia estaba medida — la parada vivía en la franja
        del marco, la franja hace scroll, y en seis de las siete pestañas el
        botón que para el robot **desaparecía de la pantalla** justo cuando
        alguien mira los datos de abajo con el robot en marcha.

        Lo llena `EnLaRanuraDeParada` con un portal desde dentro de
        `ProveedorRobot`. Un portal no mueve nada en el árbol de React: el
        contexto sigue llegando igual.

        🔴 `RanuraParada` va SIEMPRE, aunque no haya robot. Si se pintara solo en
           rutas de robot, el nodo no existiría cuando `MarcoRobot` monta —el
           raíl está por encima— y el portal caería en el vacío **sin decir
           nada**. `empty:hidden` se encarga de que no ocupe cuando está vacía.

        📝 Y la prop `parada` se ha ido con esto: era una ranura por props que
           nadie podía llenar, o sea la promesa de una pieza que no existía.
      */}
      <RanuraParada />
    </nav>
  )
}
