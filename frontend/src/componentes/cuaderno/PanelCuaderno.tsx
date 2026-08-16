'use client'

/**
 * EL CUADERNO DE MEDIDAS: lo que dijo el robot contra lo que midió la persona.
 *
 * 🔴 DOS MARCAS DECIMALES EN LA MISMA PANTALLA, Y AQUI ERA PEOR QUE EN NINGUN
 *    SITIO. El campo decia `30,2` y la tabla, una fila mas abajo, `30.2`, y la
 *    diferencia `-0.20` con punto — mientras el resto de la aplicacion escribe
 *    `0,48 kB/s` y `8,29 V` con coma, y `formato.ts` lleva la regla escrita
 *    («coma decimal: es una interfaz en español»). En la pantalla cuyo asunto es
 *    comparar dos numeros, los dos numeros se escribian de dos maneras.
 *    Ahora todo pasa por `numero()` o por `conComa()`.
 *
 * La aritmética y el formato viven en `lib/cuaderno/medidas.ts`, que es puro y
 * tiene 8 pruebas. Aquí solo se pinta y se guarda.
 *
 * ⚠️ Ruta propuesta por el análisis multiagente: el alumno mide con cinta y
 *    transportador, y esas medidas vivían en papel. La pareja robot/persona es
 *    el corazón del laboratorio — la odometría de este robot está contrastada
 *    contra cinta, y eso solo se sabe porque alguien anotó las dos columnas.
 */

import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AVISO_ALMACENAMIENTO, CLAVE_CUADERNO, Medida, aCSV, diferencia, leerMedidas,
} from '@/lib/cuaderno/medidas'
import { numero } from '@/lib/interfaz/formato'
import { ROBOTS } from '@/lib/interfaz/identidad'
import { MAGNITUDES } from '@/lib/cuaderno/lecturas_robot'
import { LecturaDelRobot } from './LecturaDelRobot'
import { Grupo } from '@/componentes/ui/Grupo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

const VACIA = { robot: 'rvr-01', que: '', robotValor: '', personaValor: '', unidad: 'cm', nota: '' }

/**
 * De `rvr-07` al numero 7, que es lo que `ProveedorRobot` necesita para resolver
 * `rvr-07.local`.
 *
 * 🔴 PASARLE LA CADENA DIRECTAMENTE NO VALE, y falla de la peor manera: el
 *    proveedor acepta `number | string`, y con una cadena la usa **tal cual**
 *    como anfitrion. `rvr-01` sin `.local` no resuelve por mDNS, asi que el
 *    socket se queda colgado ~21 s sin error — la firma exacta del fallo que
 *    este proyecto ya pago cuando el nombre resolvia a cuatro direcciones.
 *
 * ⚠️ Y ademas, un destino que no es un numero **no puede recibir testigo**: el
 *    testigo lleva dentro el numero del robot. Con la cadena, la lectura del
 *    cuaderno no habria funcionado nunca en un despliegue con la Fase B puesta.
 */
function numeroDeRobot(id: string): number {
  const n = Number(id.replace(/^rvr-/, ''))
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : 1
}

/**
 * Lo que TECLEO el alumno, con coma decimal.
 *
 * ⚠️ NO pasa por `numero()` de `formato`: aquel FUERZA dos decimales, y aqui el
 *    valor es del alumno — si escribio «30», la tabla no puede enseñar «30,00»
 *    como si hubiera medido con esa precision. Solo se traduce el separador.
 */
function conComa(v: number): string {
  return String(v).replace('.', ',')
}

/**
 * Lo TECLEADO, convertido a numero.
 *
 * 📝 Se llamaba `numero()` y chocaba de frente con el `numero()` de `formato`,
 *    que hace lo contrario -formatea un numero como texto-. Dos funciones con el
 *    mismo nombre y sentidos opuestos en el mismo fichero es una trampa.
 */
function aNumero(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function PanelCuaderno() {
  const [medidas, setMedidas] = useState<Medida[]>([])
  const [f, setF] = useState(VACIA)

  /*
   * 🔴 Arranca VACIO y carga en un efecto: el servidor no tiene
   *    `localStorage`, y leerlo durante el render daria un HTML distinto del
   *    del cliente. React abortaria la hidratacion sin avisar de nada.
   */
  useEffect(() => {
    try {
      setMedidas(leerMedidas(window.localStorage.getItem(CLAVE_CUADERNO)))
    } catch { /* modo privado, cuota, politica del navegador */ }
  }, [])

  const guardar = useCallback((nuevas: Medida[]) => {
    setMedidas(nuevas)
    try {
      window.localStorage.setItem(CLAVE_CUADERNO, JSON.stringify(nuevas))
    } catch { /* ver arriba */ }
  }, [])

  const anotar = () => {
    if (f.que.trim() === '') return
    guardar([...medidas, {
      id: `${Date.now()}-${medidas.length}`,
      cuando: Date.now(),
      robot: f.robot,
      que: f.que.trim(),
      robotValor: aNumero(f.robotValor),
      personaValor: aNumero(f.personaValor),
      unidad: f.unidad.trim() || 'cm',
      nota: f.nota.trim(),
    }])
    setF({ ...VACIA, robot: f.robot, unidad: f.unidad })
  }

  /*
   * 🔴 LA RESTA, ANTES DE ANOTAR. La cabecera de esta pantalla promete que «la
   *    resta la hace la página» y hasta ahora no habia ni un hueco donde verla:
   *    aparecia solo despues de pulsar Anotar, en una tabla que ademas no
   *    existia hasta la primera fila.
   *
   * 📝 Sale de `diferencia()`, la misma funcion pura que usa la tabla y el CSV
   *    -no una resta escrita otra vez aqui-: si algun dia hay que cambiar el
   *    signo o el redondeo, se cambia en un sitio y las tres vistas coinciden.
   */
  const dPrevia = useMemo(() => {
    const r = aNumero(f.robotValor)
    const p = aNumero(f.personaValor)
    if (r === null || p === null) return null
    return diferencia({
      id: '', cuando: 0, robot: f.robot, que: f.que,
      robotValor: r, personaValor: p, unidad: f.unidad, nota: '',
    })
  }, [f.robotValor, f.personaValor, f.robot, f.que, f.unidad])

  const csv = useMemo(() => aCSV(medidas), [medidas])
  const descargar = () => {
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const u = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = u
    a.download = 'cuaderno-atriz.csv'
    a.click()
    URL.revokeObjectURL(u)
  }

  const campo = 'focus-ring w-full rounded-md border border-[rgb(var(--filo)/0.12)] '
    + 'bg-[rgb(var(--vidrio)/0.05)] px-3 py-2 text-sm placeholder:text-muted-foreground/60'

  /*
   * 🔴 LOS DOS CAMPOS QUE DAN NOMBRE A LA PANTALLA NO PUEDEN SER DEL TAMAÑO DE
   *    «unidad». Eran dos cajas de 14 px entre otras tres iguales: nada decia
   *    que fueran una pareja, ni que de ellas saliera la unica cifra que este
   *    cuaderno calcula. Van en mono a 18 px, que es el tamaño con el que se
   *    leen sus valores en el resto de la aplicacion.
   */
  const campoPar = 'focus-ring w-full rounded-md border border-[rgb(var(--filo)/0.12)] '
    + 'bg-[rgb(var(--vidrio)/0.05)] px-3 py-2.5 font-mono text-lg '
    + 'placeholder:text-muted-foreground/50'

  /*
    El tono de identidad de esta pantalla. `--seccion-cuaderno` es grafito
    —«no habla con ningún robot»— y estaba declarado en `globals.css` sin que
    nadie lo leyera: el cuaderno era papel blanco sobre papel blanco con un
    titular flotando, mientras las seis pestañas del robot llegan con su campo
    de color a sangre.

    Va en la cabecera (lo consume `.campo-seccion`) y en el `<main>`, desde
    donde baja por herencia a la `.capucha` y al `.filete-titulo` de las dos
    tarjetas. Mismo mecanismo que `MarcoRobot`.
  */
  const tono = { '--tono-seccion': 'var(--seccion-cuaderno)' } as CSSProperties

  return (
    <div className="relative min-h-screen">
      <div className="luz-ambiente" aria-hidden="true" />

      {/*
        🔴 EL TITULAR VA EN BLANCO LISO. Tenia un degradado tinta→gris con
           `bg-clip-text`, que esta calculado para leerse sobre papel; sobre el
           campo de color la parada gris se hunde en el fondo. Misma familia que
           las paradas de degradado con blanco literal que dejaron tres
           titulares invisibles al cambiar el tema.
      */}
      {/*
        🔴 LA MITAD DERECHA DE LA BANDA ESTABA VACIA, y lo que tenia que ir ahi
           flotaba en papel: el contador de medidas iba escondido en el titulo de
           una tarjeta («3 medidas», 19 px) y Exportar en su esquina. El contador
           es la unica cifra que esta pantalla produce por si misma — va en
           `.cifra`, que es la escala que la aplicacion ya define para un valor.

        📐 Y el titular pasa a `clamp(2.5rem, 6vw, 4.5rem)`, el MISMO de la
           portada y la flota. Media 60 px contra 72 y 78, con otro factor `vw`:
           tres tamaños no son una escala.
      */}
      {/*
        📐 LA MISMA ANATOMIA QUE LA PORTADA Y LA FLOTA. Medido el 2026-08-06 a
           1400 px, las tres bandas median 235, 310 y 340 px con tres
           composiciones distintas. Ahora las tres llevan las mismas cuatro
           ranuras, el mismo `pt-12 pb-10` y la misma `min-h-[16rem]` en la
           columna izquierda, asi que la linea donde empieza el contenido no se
           mueve al cambiar de pantalla.

           ⚠️ Esta es la que fijaba el alto: su columna izquierda es la unica que
              llena las cuatro ranuras, y `min-h-[16rem]` es su altura natural.
              O sea que la unificacion no la estira a ella — sube a las otras dos.
      */}
      <header className="campo-seccion relative z-10" style={tono}>
        {/* `xl:flex-nowrap` + `xl:flex-1`: el mismo mecanismo que la portada y
            la flota, para que la altura unificada aguante tambien a 1280 y 1366.
            Ver el comentario largo en `MuroFlota`, que es donde se midio. */}
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-10 gap-y-6 px-4 pb-10 pt-12 sm:px-6 xl:flex-nowrap">
          <div className="flex min-h-[16rem] min-w-0 max-w-[56ch] flex-col justify-end xl:flex-1">
            {/* Lo que esta pantalla NO hace, y es su rasgo definitorio: es lo
                unico que funciona con los 16 robots apagados. */}
            <p className="microetiqueta !text-white/80">No abre ninguna conexión</p>
            <h1
              className="mt-3 font-semibold leading-[0.94] tracking-[-0.05em] text-white"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
            >
              Cuaderno<br />de medidas
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              Lo que dijo el robot, al lado de lo que mediste con la cinta. La resta la hace la
              página; <strong className="font-semibold text-white">si una medida está bien o no, lo
              decides tú</strong> — aquí no hay tolerancias inventadas.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 sm:items-end">
            {/*
              🔴 EN PASTILLA, COMO EL CAUDAL DE LA FLOTA. Iba suelto sobre el
                 campo: `justify-between` lo empujaba al canto derecho y dejaba
                 ~450 px de pizarra muerta en medio, con la etiqueta y la cifra
                 flotando sin caja. Es el MISMO papel que «POR ROBOT / LOS 16» en
                 el muro —la cifra que define la pantalla— y ahora tiene la misma
                 forma: mismo radio, mismo borde al 25 %, mismo relleno al 10 %,
                 misma pareja microetiqueta + cifra.

              📝 El valor se queda en `.cifra` y no baja a `.cifra-menor`: en el
                 muro son dos pastillas comparandose entre si, aqui es la unica
                 cifra que esta pantalla produce.
            */}
            <dl className="grid">
              <div className="rounded-md border border-white/25 bg-white/10 px-[18px] py-[13px]">
                <dt className="microetiqueta !text-white/70">anotadas</dt>
                {/* Un cero es un VALOR, no un hueco: la pantalla arranca vacia a
                    proposito y decirlo con una cifra es exacto. */}
                <dd className="cifra mt-1.5 text-white">{medidas.length}</dd>
              </div>
            </dl>
            {medidas.length > 0 && (
              <button
                type="button" onClick={descargar}
                className="pulsable focus-ring rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Exportar CSV
              </button>
            )}
          </div>
        </div>
      </header>

      {/*
        🔴 `max-w-6xl` Y NO `max-w-5xl`: es el ancho de las seis pestañas del
           robot y de la portada. Con el 5xl que tenia, el texto saltaba al
           cambiar de pantalla.
      */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-9 sm:px-6" style={tono}>
        {/*
          🔴 EL AVISO DE ALMACENAMIENTO VA ARRIBA Y SIEMPRE VISIBLE.
          Un alumno que crea que sus medidas están «en la nube» las perderá al
          cambiar de portátil, y eso es una práctica entera tirada.

          🔴 Y CON FONDO OPACO. Con `bg-warning/[0.08]` la franja pasaba por
             delante de los dos orbes FIJOS de la luz ambiente: medido en captura
             a 1920 px, esta misma caja iba de `238 232 225` por la izquierda a
             `231 231 224` por la derecha, o sea que el tinte que porta el nivel
             del aviso solo existia en un trozo de su propia caja.
             `--aviso-atencion` es ese tinte ya resuelto sobre la ficha blanca.
        */}
        <p className="rounded-ficha border border-warning/40 bg-[rgb(var(--aviso-atencion))] px-5 py-3.5 text-sm leading-relaxed text-foreground">
          {AVISO_ALMACENAMIENTO}
        </p>

        {/*
          ── LA PAGINA SE PARTE EN DOS ────────────────────────────────────────
          🔴 ERA LA PANTALLA MENOS TOCADA DE LAS NUEVE: tres cajas apiladas del
             mismo peso y ni una division de pagina. Con todas las cajas iguales
             la unica jerarquia posible es el ORDEN, y el orden no se ve.

          Son dos trabajos distintos y ahora se llaman: **anotar** una medida, y
          mirar **lo anotado**. El rotulo de `Grupo` lleva el grafito de esta
          pantalla, que es lo que ata la division a la banda de arriba.
        */}
        <div className="mt-9 space-y-10">
        <Grupo titulo="Anotar" fuente="la resta la hace la página">
          <Tarjeta titulo="Una medida nueva">
            {/*
              Fila de contexto: de qué robot, qué se midió y en qué unidad.

              🔴 TRES COLUMNAS, Y ANTES ERAN CUATRO. La rejilla de dentro del pozo
                 es de tres, así que las dos no compartían **ni una sola vertical**:
                 medido a 1920 px, `ROBOT` empezaba 15 px a la izquierda de `DIJO
                 EL ROBOT` y `UNIDAD` 93 px a la derecha de `DIFERENCIA`. Dos
                 rejillas desalineadas dentro de la misma tarjeta se leen como dos
                 cosas que no tienen que ver.
            */}
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
              <label>
                <span className="microetiqueta mb-1.5 block">robot</span>
                <select
                  className={campo}
                  value={f.robot}
                  onChange={(e) => setF({ ...f, robot: e.target.value })}
                >
                  {ROBOTS.map((n) => {
                    const r = `rvr-${String(n).padStart(2, '0')}`
                    return <option key={r} value={r}>{r}</option>
                  })}
                </select>
              </label>
              <label>
                {/* «obligatorio» escrito, no un asterisco: es el unico campo que
                    bloquea el boton y nada lo decia. */}
                <span className="microetiqueta mb-1.5 block">
                  qué mediste <span className="opacity-60">· obligatorio</span>
                </span>
                <input
                  className={campo} value={f.que} placeholder="avance de 30 cm"
                  onChange={(e) => setF({ ...f, que: e.target.value })}
                />
              </label>
              <label>
                <span className="microetiqueta mb-1.5 block">unidad</span>
                <input
                  className={campo} value={f.unidad}
                  onChange={(e) => setF({ ...f, unidad: e.target.value })}
                />
              </label>
            </div>

            {/*
              LA PAREJA, EN SU PROPIO RECINTO. Los tres van juntos porque son una
              sola operación: dos lecturas y su resta. Repartidos entre «robot» y
              «unidad» no habia nada que los emparejara.

              🔴 EL RECINTO VA A SANGRE Y SU RELLENO ES EL MISMO `px-5` DE LA FILA
                 DE ARRIBA. Antes era un `px-5` exterior MAS el `px-4` del pozo, o
                 sea 16 px de desfase entre las dos rejillas — el desalineamiento
                 medido. Con el pozo llegando a los cantos de la tarjeta (que ya va
                 a sangre), las dos rejillas parten del mismo sitio y comparten sus
                 tres verticales.
            */}
            <div className="pozo-interior rounded-none border-x-0 px-5 pb-4 pt-3.5">
                {/*
                  🔴 EL ROTULO DEL RECINTO NO PUEDE SER UNA `.microetiqueta`, QUE
                     ES LO MISMO QUE SUS PROPIOS CAMPOS. «la pareja que importa»
                     nombra a un grupo de tres cosas; «dijo el robot» nombra a
                     una. Las dos iban en versalitas monoespaciadas de 11,5 px:
                     el contenedor se leia igual que su contenido, asi que la
                     unica pista de que uno agrupa al otro era su posicion.

                     Mismo tratamiento que el rotulo de `Grupo` —13 px semibold,
                     caja baja, tono de la pantalla—, un peldaño por debajo de
                     sus 17 porque esto agrupa TRES CAMPOS, no una seccion de
                     pagina. La escalera queda: pantalla > grupo > tarjeta >
                     recinto > rotulo de dato.
                */}
                <p
                  className="text-[13px] font-semibold leading-none tracking-tight"
                  style={{ color: 'rgb(var(--tono-seccion))' }}
                >
                  La pareja que importa
                </p>
                <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label>
                    <span className="microetiqueta mb-1.5 block">dijo el robot</span>
                    <input
                      className={campoPar} value={f.robotValor} inputMode="decimal" placeholder="30,2"
                      onChange={(e) => setF({ ...f, robotValor: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className="microetiqueta mb-1.5 block">mediste tú</span>
                    <input
                      className={campoPar} value={f.personaValor} inputMode="decimal" placeholder="30"
                      onChange={(e) => setF({ ...f, personaValor: e.target.value })}
                    />
                  </label>
                  {/*
                    🔴 SOLO LECTURA, y sin color. La diferencia no se pinta de
                       verde ni de rojo: sin una tolerancia medida por practica,
                       un semaforo aqui seria un juicio que esta pantalla no puede
                       emitir. Es la misma regla que ya cumple la tabla.
                  */}
                  <div>
                    <span className="microetiqueta mb-1.5 block">diferencia</span>
                    <output
                      className="block w-full rounded-md border border-dashed border-[rgb(var(--filo)/0.14)] px-3 py-2.5 font-mono text-lg"
                    >
                      {dPrevia === null
                        /* `.hueco` y no un guion del tamaño del valor: falta un
                           lado, y la ausencia no se pinta con el peso del dato. */
                        ? <span className="hueco text-sm" title="falta un lado">—</span>
                        /* La unidad al mismo tamaño que la de la tabla de abajo
                           y no con `.unidad` (0,42 em): sobre 18 px saldría a
                           7,5 px, que ya no se lee a 50 cm de la pantalla. */
                        : <>{dPrevia > 0 ? '+' : ''}{numero(dPrevia, 2)}
                          <span className="ml-1 text-[11px] text-muted-foreground">{f.unidad}</span></>}
                    </output>
                  </div>
                </div>
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                  diferencia = mediste tú − dijo el robot
                </p>

                {/*
                  ═══════════════════════════════════════════════════════════════
                  🔴 EL DEFECTO Nº8, CERRADO (2026-08-16): «el cuaderno no lee ni
                     un número del robot»
                  ═══════════════════════════════════════════════════════════════
                  Esta pantalla existe para comparar lo que dijo el robot con lo
                  que mide una cinta, y el campo «dijo el robot» se tecleaba a
                  mano: abrir otra pestaña, leer, memorizar, volver. Con una
                  cinta métrica en la otra mano.

                  Y la copia a mano no es solo incómoda: **es donde entran los
                  errores que esta pantalla existe para cazar**. Un dígito mal
                  copiado se convierte en una discrepancia que no ocurrió.

                  ⚠️ Rellena el campo del ROBOT, nunca el tuyo. Si escribiera los
                     dos, la comparación no compararía nada — y esa tentación
                     existe porque técnicamente se podría.
                */}
                <div className="mt-4 border-t border-[rgb(var(--filo)/0.10)] pt-3.5">
                  <LecturaDelRobot
                    robot={numeroDeRobot(f.robot)}
                    alLeer={(valor, m) => setF((v) => ({
                      ...v,
                      robotValor: valor,
                      unidad: MAGNITUDES[m].unidad,
                      // 🔴 Solo si estaba VACÍO: si alguien ya escribió qué mide,
                      //    pisarlo sería decidir por él.
                      que: v.que.trim() === '' ? MAGNITUDES[m].que : v.que,
                    }))}
                  />
                  <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-muted-foreground">
                    Deja el ratón encima de cada botón: dice <strong>contra qué</strong> se compara
                    esa magnitud, que es lo que hace útil la lectura.
                  </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[rgb(var(--filo)/0.09)] px-5 py-3.5">
              {/*
                🔴 EL DESHABILITADO TIENE FORMA PROPIA, NO ES EL PRIMARIO
                   TRANSPARENTADO. Con `opacity-40` el unico boton de la pantalla
                   salia al cargar como un lila lavado, que no se lee como
                   «todavia no» sino como «esto esta sin terminar». Ahora pierde
                   el relleno y se queda en un contorno: la diferencia con el
                   estado activo es de CATEGORIA, no de intensidad.

                📝 El borde transparente esta SIEMPRE, no solo deshabilitado: si
                   apareciera con el `disabled:`, el boton crecería 2 px al
                   escribir la primera letra y daría un salto en el sitio donde
                   esta el ojo.
              */}
              <button
                type="button"
                onClick={anotar}
                disabled={f.que.trim() === ''}
                className="pulsable focus-ring rounded-full border border-transparent bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:border-[rgb(var(--filo)/0.16)] disabled:bg-transparent disabled:text-muted-foreground"
              >
                Anotar
              </button>
              {/*
                🔴 LA AYUDA DECIA LO CONTRARIO DE LO QUE HACIA EL BOTON. Con el
                   formulario vacío, «Anotar» está desactivado —«qué mediste» es
                   el único campo obligatorio— y a su lado se leía «puedes dejar
                   un lado vacío y completarlo después». Quien llega no tiene
                   forma de saber qué le falta: el botón no responde y el texto
                   le dice que no hace falta nada.

                Las dos frases son ciertas, pero en momentos distintos: una
                explica por qué NO se puede anotar todavía, la otra qué se puede
                dejar a medias una vez se puede. Ahora sale la que toca.
              */}
              <span className="text-xs text-muted-foreground">
                {f.que.trim() === ''
                  ? 'Escribe qué mediste para poder anotar.'
                  : 'Puedes dejar un lado vacío y completarlo después.'}
              </span>
            </div>
          </Tarjeta>
        </Grupo>

        {/*
          🔴 AQUI NO VA UNA `Tarjeta`, Y ES DELIBERADO: su capucha caia justo
             encima del `<thead>` de la tabla, o sea **dos cabeceras apiladas**
             —«Todavía no hay medidas» y luego ROBOT · QUÉ · DIJO EL ROBOT…—.
             El rotulo de la division lo pone ahora `Grupo`, y la cabecera de la
             tabla es la cabecera de la tabla.

          📝 Y el contador ya no vive en un titulo de 19 px: esta en la banda, en
             `.cifra`. Repetirlo aqui seria decir el mismo hecho dos veces, que
             es justo lo que esta ronda esta quitando del muro.
        */}
        <Grupo titulo="Lo anotado" fuente="una fila por medida · se exporta desde la cabecera">
          <div className="vidrio overflow-hidden rounded-ficha">
            {/*
              🔴🔴 LA TABLA NO DESAPARECE CUANDO ESTA VACIA, Y ESE ERA EL ESTADO
                 POR DEFECTO DE ESTA PANTALLA.

              Antes el estado vacio BORRABA la tabla entera y la sustituia por una
              franja de 120 px con una frase centrada: mas de media pantalla en
              gris muerto, y el alumno no veia que se le iba a pedir hasta
              escribir la primera fila. Y al anotarla la pagina cambiaba de forma
              debajo del cursor.

              Con el `<thead>` siempre montado, la pagina conserva su forma y las
              cinco columnas —robot · qué · dijo el robot · mediste tú ·
              diferencia— dicen de antemano cual es el trabajo. Es lo que hace la
              maqueta de Stitch de esta pantalla, que deja la cabecera puesta y
              mete la frase en una fila con `colspan` y `py-16`.
            */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* La línea bajo la cabecera es lo que hace que una tabla vacía
                      siga leyéndose como una tabla: sin ella los rótulos flotan
                      sobre el hueco. */}
                  <tr className="border-b border-[rgb(var(--filo)/0.09)] text-left text-muted-foreground">
                    <th scope="col" className="microetiqueta px-5 py-3">robot</th>
                    <th scope="col" className="microetiqueta px-3 py-3">qué</th>
                    <th scope="col" className="microetiqueta px-3 py-3 text-right">dijo el robot</th>
                    <th scope="col" className="microetiqueta px-3 py-3 text-right">mediste tú</th>
                    <th scope="col" className="microetiqueta px-3 py-3 text-right">diferencia</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">quitar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--filo)/0.08)]">
                  {medidas.length === 0 ? (
                    /*
                      El estado vacio de PRIMER USO, que no es lo mismo que «sin
                      resultados» ni que «fallo». Dice como se llena.
                    */
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">
                        Anota la primera arriba. La pareja que importa es{' '}
                        <strong className="text-foreground/85">lo que dijo el robot</strong> junto a{' '}
                        <strong className="text-foreground/85">lo que mediste tú</strong>.
                      </td>
                    </tr>
                  ) : medidas.map((m) => {
                    const d = diferencia(m)
                    return (
                      <tr key={m.id}>
                        <td className="px-5 py-3 font-mono text-[13px] text-muted-foreground">{m.robot}</td>
                        <td className="px-3 py-3">{m.que}</td>
                        <td className="px-3 py-3 text-right font-mono text-[15px]">
                          {m.robotValor === null
                            ? <span className="hueco" title="no se sabe">—</span>
                            : <>{conComa(m.robotValor)}<span className="ml-1 text-[11px] text-muted-foreground">{m.unidad}</span></>}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[15px]">
                          {m.personaValor === null
                            ? <span className="hueco" title="no se sabe">—</span>
                            : <>{conComa(m.personaValor)}<span className="ml-1 text-[11px] text-muted-foreground">{m.unidad}</span></>}
                        </td>
                        {/*
                          🔴 La diferencia NO se colorea. Sin una tolerancia
                             medida por práctica, un verde o un rojo aquí serían
                             un juicio que esta pantalla no puede emitir.
                        */}
                        <td className="px-3 py-3 text-right font-mono text-[15px]">
                          {d === null
                            ? <span className="hueco" title="falta un lado">—</span>
                            : <>{d > 0 ? '+' : ''}{numero(d, 2)}<span className="ml-1 text-[11px] text-muted-foreground">{m.unidad}</span></>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => guardar(medidas.filter((x) => x.id !== m.id))}
                            className="focus-ring rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            quitar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Grupo>
        </div>
      </main>
    </div>
  )
}
