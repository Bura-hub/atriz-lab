'use client'

/**
 * EL MURO DEL PROFESOR: los 16 robots a la vez, para mirarlos de lejos.
 *
 * 🔴🔴 LO QUE ESTE MURO NO PUEDE HACER HOY, Y VA ESCRITO EN LA PANTALLA:
 * **no puede saber si un robot esta vivo.** Para eso haria falta el ritmo de
 * `/odom`, que cuesta 1,7 Mbit/s por los 16. `/motor_status` llega a 1 Hz
 * **republicado desde el estado cacheado del driver**, asi que sigue llegando con
 * el RVR apagado: distingue «la Raspberry Pi esta viva» de «no hay nadie», y nada
 * mas.
 *
 * → Por eso la baldosa dice «sin señal de vida» y NUNCA «averiado». Se cierra con
 *   una linea en el driver -un `/latido` a 1 Hz con un contador monotono, ~0,5
 *   kB/s los 16- que hoy no existe en la rama `ros2`.
 *
 * ⚠️ Y cuando exista: **la interfaz tendra que comparar DOS lecturas separadas en
 * el tiempo**, porque el latido va `TRANSIENT_LOCAL` y un suscriptor nuevo puede
 * recibir el ultimo valor latcheado. Una sola lectura no probaria nada. Lo que da
 * la garantia es la republicacion a 1 Hz, no el QoS.
 */

import { CSSProperties, useCallback, useMemo, useState } from 'react'
import { TOPICS_MURO, presupuestoMuro } from '@/lib/flota/presupuesto'
import { Baldosa } from '@/lib/flota/resumen'
import { EstadoRobot } from '@/lib/rosbridge/salud'
import { OrdenMuro, ordenarBaldosas } from '@/lib/flota/orden'
import { ControlesMuro } from './ControlesMuro'
import { ROBOTS, TOTAL_ROBOTS } from '@/lib/interfaz/identidad'
import { destinoDe } from '@/lib/interfaz/direcciones'
import { numero } from '@/lib/interfaz/formato'
import { Grupo } from '@/componentes/ui/Grupo'
import { AlResumir, BaldosaConectada } from './BaldosaConectada'
import { DondeBuscar, useDirecciones } from './DondeBuscar'
import { useSesion } from '@/hooks/ContextoSesion'
import { evaluarPrecondicion, hayQueAvisar } from '@/lib/rosbridge/precondicion'
import { TESTIGO_EXIGIDO } from '@/lib/rosbridge/proveedor_testigo'

export function MuroFlota() {
  /*
   * 🔴 SON UN MÍNIMO, no el total, y por eso llevan «≥» delante.
   *
   * El muro se suscribe a TRES topics y sólo DOS tienen caudal medido:
   * `/estado_robot` entró en la baldosa el 2026-08-04 y nunca entró en el
   * presupuesto, así que esta cifra llevaba desde entonces por debajo de lo
   * real. No se estima —el módulo se niega a sumar lo que nadie ha medido— pero
   * tampoco se calla: se enseña el suelo y se dice qué falta.
   */
  const { kbs: porRobot, sinMedir, completo } = presupuestoMuro(1)
  const { kbs: total } = presupuestoMuro(TOTAL_ROBOTS)
  const prefijo = completo ? '' : '≥ '
  const { direcciones, poner } = useDirecciones()
  const [proyeccion, setProyeccion] = useState(false)
  const [orden, setOrden] = useState<OrdenMuro>('NUMERO')

  /*
    EL TONO DE IDENTIDAD DE ESTA PANTALLA, Y ERA LA UNICA DE LAS NUEVE QUE NO LO
    USABA. La portada llega en violeta a sangre y el cuaderno en grafito; el muro
    salia en papel blanco con el titular flotando, mientras el rail —tres
    centimetros a la izquierda— pinta su pastilla activa en cobalto para ese
    mismo sitio.

    Va en dos sitios y hacen falta los dos: en la cabecera lo consume
    `.campo-seccion`, y en el `<main>` baja por herencia a la `.capucha` y al
    `.filete-titulo` de la tarjeta de la leyenda. Mismo mecanismo que
    `MarcoRobot`, no uno nuevo.
  */
  const tono = { '--tono-seccion': 'var(--seccion-flota)' } as CSSProperties

  /*
   * El estado de cada ficha, informado desde abajo. Solo se guardan la ATENCION
   * y el ESTADO: es lo unico que el orden y el aviso de flota entera necesitan, y
   * guardar la baldosa entera obligaria a re-renderizar el muro completo con cada
   * mensaje de cada robot.
   */
  const [atenciones, setAtenciones] = useState<Record<number, Baldosa['atencion']>>({})
  const [estados, setEstados] = useState<Record<number, EstadoRobot>>({})
  const alResumir = useCallback<AlResumir>((id, atencion, estado) => {
    setAtenciones((a) => (a[id] === atencion ? a : { ...a, [id]: atencion }))
    setEstados((e) => (e[id] === estado ? e : { ...e, [id]: estado }))
  }, [])

  /*
   * 🔴 EL HECHO SE DICE UNA VEZ, NO DIECISEIS.
   *
   * Con los robots apagados —el estado mas comun del laboratorio— cada ficha
   * repetia «no llego» y «ultimo dato: nunca», o sea el mismo hecho 32 veces
   * sobre 16 rectangulos casi vacios. Cuando fallan TODOS no hay 16 problemas:
   * hay uno, y es de red o de encendido. Se dice arriba, en una linea.
   *
   * ⚠️ Solo cuando fallan los DIECISEIS. Si cae uno, la ficha apagada entre
   *    quince vivas ya salta a la vista y esta frase mentiria.
   */
  /*
   * 🔴🔴 LA CAUSA SE COMPRUEBA ANTES DE ACUSAR AL LABORATORIO.
   *
   * El 2026-08-16 este muro pinto dieciseis «sin señal de vida» y remato con
   * «Ningún robot responde — comprueba que estén encendidos y en la red», con
   * los robots **perfectos**: lo que faltaba era la SESION de este navegador.
   * Sin ella no se firma testigo, y sin testigo el transporte ni siquiera abre
   * un socket — asi que en el robot no habia ni un cliente en el journal, que es
   * indistinguible de «nadie ha abierto la pagina».
   *
   * Esto se sabe **sin tocar la red y sin esperar los 10 s del plazo**, asi que
   * se pregunta primero. Y cuando falta, la frase que culpa a los robots **se
   * calla**: dejarla al lado seria seguir acusando, solo que con una nota.
   */
  const { usuario, cargando } = useSesion()
  const precondicion = evaluarPrecondicion({ exigido: TESTIGO_EXIGIDO, usuario, cargando })
  const faltaAlgoAqui = hayQueAvisar(precondicion)

  const nadieResponde = !faltaAlgoAqui && ROBOTS.every((id) => estados[id] === 'SIN_CONEXION')

  /*
   * 🔴 EL ORDEN SE APLICA CON `order` DE CSS, NO REORDENANDO EL ARRAY.
   *
   * Mover las fichas en el DOM las desmontaria, y con ellas sus dieciseis
   * WebSockets: el muro entero se reconectaria cada vez que un robot cruzara un
   * umbral. Con `order` cambia la posicion VISUAL y el arbol se queda quieto.
   */
  const posicion = useMemo(() => {
    const fichas = ROBOTS.map((id) => ({
      id,
      baldosa: { atencion: atenciones[id] ?? 'NINGUNA' } as Baldosa,
    }))
    const m: Record<number, number> = {}
    ordenarBaldosas(fichas, orden).forEach((f, i) => { m[f.id] = i })
    return m
  }, [atenciones, orden])

  return (
    <div className={`relative min-h-screen bg-background text-foreground ${proyeccion ? 'proyeccion' : ''}`}>
      {/*
        LA LUZ AMBIENTE. Dos orbes desenfocados y FIJOS que tiñen la pantalla
        entera: es lo que impide que el pozo oscuro se lea como «apagado» en vez
        de como «profundo». Fijos por rendimiento — ver `.luz-ambiente`.
      */}
      <div className="luz-ambiente" aria-hidden="true" />
      {/*
        LA BANDA DE IDENTIDAD, A SANGRE.

        🔴 EL COBALTO OCUPA UNA REGIÓN ENTERA —no es un acento— y es lo que hace
           que esta pantalla se reconozca a tres metros aunque no se lea una
           palabra. Y es el MISMO cobalto con el que el raíl pinta su pastilla
           «Flota»: sin él, el raíl anunciaba un sitio que la pantalla no era.

        📌 La mitad derecha lleva lo que antes flotaba sobre papel: los dos
           controles y las dos cifras de caudal. No es relleno — el caudal es la
           restricción que gobierna el diseño de este muro, así que va donde va
           el nombre de la pantalla.
      */}
      {/*
        📐 LA ANATOMIA COMUN DE LAS TRES BANDAS DE IDENTIDAD, y antes eran tres.
           Medido el 2026-08-06 a 1400 px: portada 235 px, flota 310 y cuaderno
           340. La portada ponia el parrafo AL LADO del titular y las otras dos
           debajo; solo el cuaderno llevaba microetiqueta encima. Cambiar de
           pantalla movia 105 px la linea donde empieza el contenido.

           Las tres llevan ahora las mismas cuatro ranuras -ante-titulo, titular,
           parrafo, columna de cifras y controles-, el mismo relleno
           (`pt-12 pb-10`) y la misma altura minima de columna izquierda
           (`min-h-[16rem]`). Con `justify-end` la holgura se va ARRIBA, asi que
           el parrafo de las tres acaba a la misma altura aunque una no use el
           ante-titulo.
      */}
      <header className="campo-seccion relative z-10" style={tono}>
        {/*
          🔴 `xl:flex-nowrap` Y LA COLUMNA IZQUIERDA `flex-1`, Y NO ES UN ADORNO
             RESPONSIVE: sin ello la unificacion de altura **solo valia a partir
             de ~1400 px**. Medido a 1280 y a 1366 -que es el portatil de aula-,
             esta banda salia de **498 px** contra 344 las otras dos, porque los
             controles y el caudal no cabian al lado del parrafo y saltaban de
             linea. Y en un contenedor que envuelve, un hijo **no se encoge
             antes de saltar**: se coloca a su tamaño maximo o se va abajo. Con
             `flex-1` la columna izquierda cede el ancho que haga falta y las
             tres bandas vuelven a medir lo mismo desde 1280.

          ⚠️ Por debajo de `xl` si envuelve, a proposito: en tableta y movil la
             banda entera pasa a una columna y estirar el parrafo a 250 px seria
             peor que una banda mas alta.
        */}
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-10 gap-y-6 px-4 pb-10 pt-12 sm:px-6 xl:flex-nowrap">
          <div className="flex min-h-[16rem] min-w-0 max-w-[56ch] flex-col justify-end xl:flex-1">
            {/*
              A QUIEN SIRVE ESTA PANTALLA, que es lo que ni el raíl ni el titular
              dicen: el raíl pone «Flota» y el titular «Flota Atriz». Corto, que
              es la regla de `.microetiqueta`.
            */}
            <p className="microetiqueta !text-white/75">El muro del administrador</p>
            {/*
              A DOS LINEAS, como lo compuso Stitch. No es capricho: proyectado, un
              titular de una sola linea se come el ancho que necesitan las cifras
              de caudal, y partirlo deja la columna izquierda libre.

              🔴 EL TITULAR VA EN BLANCO LISO, Y ANTES ERA UN DEGRADADO
                 TINTA→GRIS CON `bg-clip-text`. Ese degradado esta calculado para
                 leerse sobre papel; sobre un campo cobalto saturado la parada
                 gris se hunde en el fondo y la palabra se parte por la mitad. Es
                 la misma familia de fallo que las paradas de degradado con blanco
                 literal que dejaron tres titulares invisibles al cambiar el tema:
                 una tinta que no mira el fondo sobre el que cae.

              📝 Y desaparece de paso la rama de proyeccion del titular: blanco
                 sobre cobalto da 8,1:1, asi que aguanta el proyector sin
                 tratamiento aparte.

              📐 `clamp(2.5rem, 6vw, 4.5rem)` es el MISMO de la portada y el
                 cuaderno. Antes las tres cabeceras median 72, 78 y 60 px con
                 factores `vw` distintos — tres tamaños no son una escala.
            */}
            <h1
              className="mt-3 font-semibold leading-[0.94] tracking-[-0.05em] text-white"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
            >
              Flota<br />Atriz
            </h1>
            {/*
              📝 LOS NOMBRES DE LOS TOPICS SE VAN AL ROTULO DE SU GRUPO. Estaban
                 aqui **y** los volvia a decir el `fuente` de «Los 16 robots»,
                 tres centimetros mas abajo: el mismo hecho dos veces. Y su sitio
                 es el rotulo, que es lo que `Grupo` existe para hacer — decir de
                 donde sale lo que hay debajo, pegado a lo que hay debajo.
            */}
            <p className="mt-4 text-base leading-relaxed text-white/80">
              {TOTAL_ROBOTS} Sphero RVR en el aula. Los que están en color piden algo; los de
              vidrio, no. Cada ficha abre su propio WebSocket y lo cierra al salir.
            </p>
          </div>

          {/*
            El presupuesto de red. No es adorno: es el número que decide a qué
            topics puede suscribirse este muro.
          */}
          <div className="flex flex-col items-start gap-4 sm:items-end">
          <ControlesMuro
            proyeccion={proyeccion}
            alCambiarProyeccion={setProyeccion}
            orden={orden}
            alCambiarOrden={setOrden}
          />
          {/*
            🔴 LAS DOS DEL MISMO ANCHO, Y NO ES SIMETRÍA POR GUSTO: son la MISMA
               magnitud a dos escalas -lo que cuesta un robot y lo que cuestan los
               dieciséis-, así que tienen que leerse como pareja. Dimensionadas al
               contenido, «POR ROBOT» y «LOS 16» daban dos cajas distintas y la
               comparación se perdía. `grid-cols-2` iguala las dos columnas a la
               más ancha sin fijar ninguna medida a mano.

            📝 Y las cifras van en `.cifra-menor` con la unidad en `.unidad`, que
               es la escala que la aplicación ya define: antes eran un `text-[21px]`
               inventado con la unidad a 11 px, o sea la misma decisión tomada dos
               veces y con otros números.

            ⚠️ Sobre el campo dejan de ser `.vidrio`: una ficha de papel blanco
               encima del cobalto se lee como una tarjeta suelta, no como parte de
               la banda. El relleno lo pone el blanco al 10 % SOBRE UN CAMPO
               OPACO, así que vale lo mismo en cualquier punto de la pantalla — es
               la misma regla que hizo opacos los fondos de aviso.
          */}
          <dl className="grid grid-cols-2 gap-2.5">
            <div className="rounded-md border border-white/25 bg-white/10 px-[18px] py-[13px]">
              <dt className="microetiqueta !text-white/70">por robot</dt>
              <dd className="cifra-menor mt-1 text-white">
                {prefijo}{numero(porRobot, 2)}<span className="unidad !text-white/70">kB/s</span>
              </dd>
            </div>
            <div className="rounded-md border border-white/25 bg-white/10 px-[18px] py-[13px]">
              <dt className="microetiqueta !text-white/70">los {TOTAL_ROBOTS}</dt>
              <dd className="cifra-menor mt-1 text-white">
                {prefijo}{numero(total, 2)}<span className="unidad !text-white/70">kB/s</span>
              </dd>
            </div>
          </dl>
          {/*
            🔴 La nota que impide leer la cifra de arriba como un total. Sale
               SOLO cuando falta algo por medir: en cuanto el robot dé el caudal
               de `/estado_robot`, esto desaparece y el «≥» con ello.
          */}
          {!completo && (
            <p className="mt-2.5 text-[11px] leading-snug text-white/70">
              No incluye {sinMedir.join(' ni ')}, que el muro SÍ recibe: nadie ha medido su
              caudal todavía. La evidencia 68 midió seis topics y ése no existía aún.
            </p>
          )}
          </div>
        </div>
      </header>

      {/*
        🔴 `max-w-6xl` Y NO `max-w-7xl`. Es el ancho de la portada, del cuaderno
           y de las seis pestañas del robot; el muro se habia quedado atras. A
           1920 px la columna de la portada arrancaba en x=545 y la de aqui en
           x=483: **62 px de salto** al cambiar de pantalla, que el ojo lee como
           que la pagina se ha movido.
      */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6" style={tono}>
        {/*
          ── EL HECHO, UNA VEZ ────────────────────────────────────────────────
          🔴 FONDO OPACO. `--aviso-atencion` es ese mismo tinte ya resuelto
             sobre la ficha blanca. Con un `bg-warning/[0.08]` la franja pasaria
             por delante de los dos orbes de la luz ambiente, que son FIJOS y
             ocupan cuadrantes distintos: empezaria crema por la izquierda y
             acabaria verde por la derecha.

          ⚠️ Y NO dice «averiado» ni nada parecido: este muro no puede saber si
             un robot esta vivo. Dice el hecho -no llega ninguno- y las dos
             causas que estan al alcance de quien lo lee.
        */}
        {/*
          🔴 Y VA EL PRIMERO, ANTES DEL CUADRO DE DIRECCIONES. Estaba debajo:
             lo primero bajo la banda de un muro que se proyecta era un ajuste de
             red de ESTE navegador, y con el mismo alto y el mismo radio que la
             alarma. Dos barras iguales seguidas no tienen jerarquia, asi que la
             alarma no ganaba nada por ser una alarma.
        */}
        {/*
          🔴 VA ANTES QUE «ningún robot responde», Y LO SUSTITUYE. No son dos
             avisos que se acumulan: cuando falta la sesión, la otra frase es
             FALSA —los robots pueden estar perfectos— y dejarla sería seguir
             mandando a cruzar el laboratorio.
        */}
        {faltaAlgoAqui && precondicion.estado !== 'LISTO' && precondicion.estado !== 'NO_SE_SABE' && (
          <div className="rounded-ficha border border-warning/40 bg-[rgb(var(--aviso-atencion))] px-5 py-3.5 text-sm leading-relaxed text-foreground">
            <p className="font-semibold">{precondicion.titulo}</p>
            <p className="mt-1.5 max-w-prose">{precondicion.mensaje}</p>
            {precondicion.estado === 'SIN_SESION' && (
              <a
                href={precondicion.enlace}
                className="mt-2.5 inline-block border border-border bg-secondary px-3 py-1.5 text-secondary-foreground focus-ring hover:bg-muted transition-transform duration-150 active:scale-[0.97]"
              >
                Entrar
              </a>
            )}
          </div>
        )}

        {nadieResponde && (
          <p className="rounded-ficha border border-warning/40 bg-[rgb(var(--aviso-atencion))] px-5 py-3.5 text-sm leading-relaxed text-foreground">
            Ningún robot responde — comprueba que estén encendidos y en la red.
          </p>
        )}

        {/*
          🔴 EL CUADRO DE DIRECCIONES SALE DEL ANCHO COMPLETO. Era una barra de
             1080 px con 430 de texto y 640 de vacio, o sea que un ajuste de red
             pesaba en la pagina lo mismo que los dieciseis robots. A `max-w-md`
             y a la derecha se lee como lo que es -un control-, y queda debajo de
             los controles de la banda, que es donde ya vive el resto de lo que
             se toca en esta pantalla.

          ⚠️ Se queda ARRIBA y no al final: cuando el aviso de «ningún robot
             responde» tiene razon, esto es justo lo que hay que abrir. Enterrarlo
             bajo dieciseis fichas seria esconder el remedio debajo del sintoma.
        */}
        <div className={`${nadieResponde ? 'mt-3' : ''} mb-7 flex justify-end`}>
          <div className="w-full max-w-md">
            <DondeBuscar direcciones={direcciones} poner={poner} />
          </div>
        </div>

        <div className="space-y-11">
        {/*
          ── LOS DIECISEIS, CON SU ROTULO ────────────────────────────────────
          🔴 `Grupo` ESTABA APLICADO A MEDIAS EN LA APLICACION Y EL MURO NO LO
             USABA EN NINGUNA PARTE: la pantalla que mas se mira era la unica
             sin una sola division declarada. Aqui el rotulo no es adorno — dice
             de donde sale lo que hay debajo, que en este muro es la restriccion
             que lo gobierna: **solo dos topics baratos**, y por eso no puede
             saber si un robot esta vivo.
        */}
        {/*
          ⚠️ El `fuente` va CORTO: `.microetiqueta` es versalita espaciada, y una
             linea de 55 caracteres asi grita mas que el titulo que acompaña.
             Solo los dos topics, que es el dato que gobierna este muro.
        */}
        <Grupo titulo="Los 16 robots" fuente={TOPICS_MURO.join(' + ')}>
        {/*
          ── EL ÚNICO MOMENTO DE MOVIMIENTO ORQUESTADO DE LA APLICACIÓN ───────
          Las dieciséis fichas suben 20 px y aparecen al entrar, con 60 ms entre
          una y la siguiente. `craft-floor`: «one authored moment, not scattered
          effects».

          🔴 Y ES CSS, NO JAVASCRIPT, POR UNA RAZÓN QUE IMPORTA. Una entrada
             escalonada hecha con estado de React se repetiría en cada
             re-render, y aquí hay dieciséis WebSockets reconectándose por su
             cuenta: el muro se pondría a barajar sus fichas cada vez que un
             robot volviera. Una animación CSS corre **al montar y nunca más**,
             que es exactamente la garantía que hace falta.

          📌 `4x4` es la forma que pide el encargo: el administrador mira los
             dieciséis a la vez, a veces proyectados. Las columnas de móvil se
             conservan porque un teléfono no puede con cuatro.
        */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ROBOTS.map((id, i) => (
            <div
              key={id}
              // `h-full` en el envoltorio Y en la ficha: si no, el envoltorio de
              // la animacion no estira y las fichas de una misma fila quedan de
              // alturas distintas, con hueco muerto debajo de las cortas.
              className="animate-entrar h-full"
              style={{ animationDelay: `${i * 60}ms`, order: posicion[id] ?? id }}
            >
              <BaldosaConectada
                id={id}
                destino={destinoDe(id, direcciones)}
                alResumir={alResumir}
              />
            </div>
          ))}
        </div>
        </Grupo>

        {/*
          ── CÓMO SE LEE EL MURO, A DOS COLUMNAS ─────────────────────────────
          🔴 LA LEYENDA ESTABA FUERA Y DESCRIBÍA COLORES SIN ENSEÑAR NINGUNO:
             flotaba suelta encima de la tarjeta diciendo «bloque de color» en
             tinta negra. Y la tarjeta era una losa de 1080 px con el texto a
             `max-w-prose`, o sea con **la mitad derecha vacía**.

             Las dos cosas se arreglan a la vez: la leyenda entra en la columna
             derecha —que es el hueco que ya había— y trae sus muestras de color
             al lado de la palabra, que es lo único que la convierte en leyenda.

          ⚠️ Las tres muestras van juntas en «bloque de color» a propósito, y no
             una por tono: la regla del muro es **bloque = pide algo**, y cuál de
             los tres tonos sea lo dice la PALABRA de cada baldosa, no la
             leyenda. Repartirlas aquí sugeriría que el administrador tiene que
             distinguir lima de coral para entender el muro — que es exactamente
             lo que este proyecto evita, porque una de cada doce personas no
             puede y esto se proyecta.
        */}
        {/*
          🔴 EL TITULO LO PONE `Grupo`, NO UNA `Tarjeta`. Aqui habia una
             `Tarjeta titulo="Cómo leer este muro"`, y meterla dentro de un grupo
             habria apilado DOS cabeceras -el rotulo del grupo y la capucha de la
             tarjeta- diciendo lo mismo. Es el mismo defecto que el cuaderno ya
             evita con su tabla, y se resuelve igual: el rotulo de la division lo
             pone el grupo, y debajo va la superficie a secas.

          ⚠️ El cobalto no se pierde: el `<h2>` de `Grupo` lo lee de
             `--tono-seccion`, que baja del `<main>`.
        */}
        <Grupo titulo="Cómo se lee este muro" fuente="referencia · no cambia con los robots">
          {/* Las mismas tres clases con las que `Tarjeta` monta su superficie
              (`vidrio overflow-hidden rounded-ficha text-card-foreground`), para
              que en modo proyeccion se comporte igual que las demas cajas: es
              `.proyeccion .vidrio` quien le quita el desenfoque y le pone borde. */}
          <div className="vidrio overflow-hidden rounded-ficha text-card-foreground">
            <div className="grid gap-x-10 gap-y-7 px-5 pb-6 pt-5 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <strong>Rojo solo por un hecho</strong>: atasco confirmado por el firmware del RVR, o
                  batería por debajo de 6,5 V, y además con señal reciente. Nunca por un hueco.
                </li>
                <li>
                  <strong>«Sin señal de vida» no es una avería.</strong> Un robot cargando —RVR apagado
                  con la Raspberry Pi encendida— es el estado más común del laboratorio y se ve igual que
                  uno dormido.
                </li>
                <li>
                  <strong>La batería se lee en voltios.</strong> El porcentaje del firmware marcó 100 %
                  con la batería a 8,29 V, a 1,29 V del umbral de «baja».
                </li>
                <li>
                  Una baldosa se pone en «sin señal de vida» tras 5 s sin <code>/motor_status</code>.
                  Ese umbral es del muro y no se puede intercambiar con el de la ficha de un robot: son
                  dos topics de ritmos distintos.
                </li>
              </ul>

              {/*
                🔴 `self-start`, Y ESTO ES LO QUE ARREGLA EL FILETE. Un hijo de
                   rejilla se estira al alto de la fila por defecto, asi que el
                   borde izquierdo corria 310 px mientras su contenido acababa a
                   los 155: media linea vertical señalando el vacio. Con
                   `self-start` la caja mide lo que mide su contenido y el filete
                   acaba donde acaba lo que separa.
              */}
              <div className="self-start md:border-l md:border-border md:pl-8">
                <p className="microetiqueta">El idioma del muro</p>
                <dl className="mt-3 space-y-3 text-[12.5px] leading-snug text-muted-foreground">
                  <div>
                    <dt className="flex items-center gap-2 font-semibold text-foreground">
                      <span aria-hidden="true" className="flex gap-1">
                        <span className="block h-3 w-3 rounded-[3px] bg-bloque-ir" />
                        <span className="block h-3 w-3 rounded-[3px] bg-bloque-mirar" />
                        <span className="block h-3 w-3 rounded-[3px] bg-bloque-vivo" />
                      </span>
                      Bloque de color
                    </dt>
                    <dd className="mt-1">este robot pide algo, y su ficha dice qué</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 font-semibold text-foreground">
                      <span
                        aria-hidden="true"
                        className="block h-3 w-3 rounded-[3px] border border-border bg-card"
                      />
                      Vidrio
                    </dt>
                    <dd className="mt-1">sin novedad, o no se llega a él</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </Grupo>
        </div>
      </main>
    </div>
  )
}
