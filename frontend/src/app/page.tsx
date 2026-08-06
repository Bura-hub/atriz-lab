/**
 * LA PUERTA DE ENTRADA.
 *
 * 🔴 Antes esta ruta renderizaba `Dashboard` de `src/components/`, que son 1134
 *    lineas de MAQUETA con datos inventados: cero `fetch`, cero `WebSocket`, y
 *    un estado de robot fabricado. O sea que lo PRIMERO que veia cualquiera al
 *    abrir la aplicacion era la peor familia de fallos de este proyecto —una
 *    pantalla que parece sana sin haber hablado con nada— en la portada.
 *
 * → Esta pagina no inventa nada: solo enumera lo que existe y **dice lo que no
 *   funciona todavia**. No abre ninguna conexion: las conexiones viven bajo
 *   `/robot/[id]` y `/flota`, atadas a su ruta para que se cierren al salir.
 *
 * 📌 Las maquetas NO se han borrado: su destino esta sin decidir (duda A3 del
 *    plan). Al dejar de importarlas aqui quedan sin referenciar, que es
 *    justamente lo que hace la decision barata en los dos sentidos.
 */

import Link from 'next/link'
import { CSSProperties } from 'react'
import { ROBOTS, TOTAL_ROBOTS } from '@/lib/interfaz/identidad'
import { Grupo } from '@/componentes/ui/Grupo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

export default function Portada() {
  /*
    🔴 EL TONO DE IDENTIDAD DE ESTA PANTALLA, Y ANTES NO SE USABA EN NINGUNA
       PARTE. `--seccion-portada` existe en `globals.css` desde que se escribio
       el eje de identidad —«violeta: la portada no es el muro»— y ni la
       cabecera ni las tarjetas lo leian: la portada era papel blanco sobre
       papel blanco con un titular flotando, mientras las seis pestañas del
       robot llegan con su campo de color a sangre.

    Va en dos sitios y hacen falta los dos: en la cabecera lo consume
    `.campo-seccion`, y en el `<main>` baja por herencia a la `.capucha` y al
    `.filete-titulo` de cada `Tarjeta` y al rotulo de cada `Grupo`. Es el mismo
    mecanismo que usa `MarcoRobot`, no uno nuevo.
  */
  const tono = { '--tono-seccion': 'var(--seccion-portada)' } as CSSProperties

  return (
    <div className="relative min-h-screen">
    {/* La misma luz que el resto: continuidad de mundo. */}
    <div className="luz-ambiente" aria-hidden="true" />

    {/*
      LA BANDA DE IDENTIDAD, A SANGRE.

      🔴 EL TITULAR VA EN BLANCO LISO, NO EN EL DEGRADADO TINTA→GRIS QUE TENIA.
         Ese degradado esta calculado para leerse sobre papel; sobre un campo
         violeta saturado la parada gris se hunde en el fondo y la palabra se
         parte por la mitad. Es la misma familia de fallo que las paradas de
         degradado con blanco literal que dejaron tres titulares invisibles al
         cambiar el tema: una tinta que no mira el fondo sobre el que cae.
    */}
    {/*
      📐 LA MISMA ANATOMIA QUE LA FLOTA Y EL CUADERNO, y antes eran tres
         distintas. Medido el 2026-08-06 a 1400 px: esta banda media 235 px, la
         de flota 310 y la del cuaderno 340 — o sea que cambiar de pantalla movia
         **105 px** la linea donde empieza el contenido. Y las anatomias tampoco
         coincidian: aqui el parrafo iba AL LADO del titular y en las otras dos
         debajo.

         Cuatro ranuras iguales en las tres —ante-titulo, titular, parrafo,
         columna de cifras—, el mismo `pt-12 pb-10` y la misma
         `min-h-[16rem]` en la columna izquierda. `justify-end` manda la holgura
         ARRIBA, asi que el parrafo de las tres acaba a la misma altura aunque
         esta no use el ante-titulo.

      📝 SIN ANTE-TITULO, y la razon sigue en pie: iba a llevar «Laboratorio de
         robótica presencial», que es **literalmente** lo que ya dice el raíl
         bajo la marca, tres centímetros a la izquierda y en la misma caja alta
         monoespaciada. Una repetición así no informa: enseña a saltarse las
         microetiquetas. La ranura existe y se queda vacia a proposito — con
         `justify-end` eso no descuadra nada.

      🔴 Y AQUI HABIA UNA `.cifra-fantasma` CON EL 16. Se va: la columna derecha
         pasa a decir ese mismo 16 como DATO, y el fantasma lo habria repetido a
         un tercer tamaño en la misma banda. Lo que sostenia al fantasma era que
         la mitad derecha estaba vacia; ya no lo esta.
    */}
    <header className="campo-seccion relative z-10" style={tono}>
      {/* `xl:flex-nowrap` + `xl:flex-1`: el mismo mecanismo que la flota y el
          cuaderno, para que la altura unificada aguante tambien a 1280 y 1366.
          Ver el comentario largo en `MuroFlota`, que es donde se midio. */}
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-10 gap-y-6 px-4 pb-10 pt-12 sm:px-6 xl:flex-nowrap">
        <div className="flex min-h-[16rem] min-w-0 max-w-[56ch] flex-col justify-end xl:flex-1">
          <h1
            className="font-semibold leading-[0.94] tracking-[-0.05em] text-white"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
          >
            Laboratorio<br />Atriz
          </h1>
          {/* Sin el «16» al principio: lo dice la cifra de la derecha, y
              repetirlo a dos tamaños en la misma banda es el mismo hecho dos
              veces. */}
          <p className="mt-4 text-base leading-relaxed text-white/80">
            Robots Sphero RVR, cada uno con su Raspberry Pi y su LIDAR. Esta aplicación habla
            con ellos por rosbridge, un WebSocket por robot.
          </p>
        </div>

        {/*
          LA CUARTA RANURA, la misma que la flota llena con el caudal y el
          cuaderno con las medidas anotadas: la cifra que define la pantalla,
          dentro de la misma pastilla. Sale de `TOTAL_ROBOTS`, no de un literal.
        */}
        <dl className="grid">
          <div className="rounded-md border border-white/25 bg-white/10 px-[18px] py-[13px]">
            <dt className="microetiqueta !text-white/70">robots en el aula</dt>
            <dd className="cifra mt-1.5 text-white">{TOTAL_ROBOTS}</dd>
          </div>
        </dl>
      </div>
    </header>

    {/*
      🔴 `max-w-6xl` Y NO `max-w-4xl`. Es el ancho de las seis pestañas del
         robot; con el 4xl que tenia, el texto SALTABA 116 px al pasar de esta
         pantalla a cualquier otra. Un ancho por pantalla no es composicion, es
         una diferencia que el ojo lee como que la pagina se ha movido.
    */}
    <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-9 sm:px-6" style={tono}>
      {/*
        🔴 LA REJILLA DE ROBOTS SUBE A BANDA PROPIA, Y ESO ERA EL DEFECTO DE
           ESTRUCTURA DE ESTA PANTALLA.

        Antes habia cuatro `vidrio rounded-ficha p-6` identicas apiladas con un
        `space-y-6` uniforme: «los 16 robots» pesaba exactamente lo mismo que un
        aviso de que algo no esta escrito. Con todas las cajas iguales la unica
        jerarquia posible es el ORDEN, y el orden no se ve.

        Aqui el destino principal —entrar en un robot— deja de ser una caja y
        pasa a ser una banda a ancho completo con su rotulo de seccion. Las dos
        secundarias van en dos columnas, y el aviso se separa con aire en vez de
        con otra caja del mismo peso.
      */}
      <Grupo titulo="Los 16 robots" fuente="una conexión por robot, y se cierra al salir">
        {/*
          🔴 FONDO OPACO, Y ANTES ERA `--vidrio` AL 4 %. Los dieciseis destinos
             son la MISMA cosa dieciseis veces, asi que tienen que verse iguales.
             Con el fondo translucido pasaban por delante de los dos orbes de la
             luz ambiente, que son FIJOS: medido en captura a 1920 px, las seis
             primeras pastillas salian `237 236 234` -gris calido- y la 08 y la
             16 `229 235 234`, o sea con el tono girado a frio. Dos pastillas
             identicas de distinto color parecen decir cosas distintas.

          📝 El hover tambien es opaco: `--aviso-nota` es el azul de la luz
             ambiente **ya resuelto sobre la ficha blanca**, asi que vale lo
             mismo en cualquier punto de la pantalla.
        */}
        <ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
          {ROBOTS.map((n) => (
            <li key={n}>
              <Link
                href={`/robot/${n}`}
                className="pulsable focus-ring block rounded-md border border-[rgb(var(--filo)/0.12)] bg-[rgb(var(--card))] py-3.5 text-center font-mono text-base transition-colors duration-[var(--t-estado)] hover:border-[rgb(var(--filo)/0.28)] hover:bg-[rgb(var(--aviso-nota))]"
              >
                {String(n).padStart(2, '0')}
              </Link>
            </li>
          ))}
        </ul>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Cada uno se busca por su nombre <code>rvr-NN.local</code>; también vale escribir una IP
          en la URL.
        </p>
      </Grupo>

      {/*
        🔴 Y ESTAS DOS TAMBIEN VAN EN UN `Grupo`. `Grupo` estaba aplicado a
           medias: de las tres divisiones de esta pantalla solo la primera lo
           usaba, asi que las dos tarjetas hermanas y el bloque ambar flotaban
           sin rotulo — y una pantalla con una seccion nombrada y dos sin nombrar
           no tiene estructura declarada, tiene una excepcion.

        📝 Igual alto por la rejilla: los dos destinos secundarios son hermanos,
           no una pila.
      */}
      <div className="mt-12">
      {/* ⚠️ El `fuente` corto: `.microetiqueta` es versalita espaciada y una
             linea larga ahi grita mas que el titulo al que acompaña. */}
      <Grupo titulo="Las otras dos pantallas" fuente="una para mirar · otra para anotar">
      <div className="grid gap-5 sm:grid-cols-2">
        <Tarjeta titulo="Para el administrador" subtitulo="El muro dice a cuál hay que levantarse.">
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Los {TOTAL_ROBOTS} de un vistazo: batería en voltios y estado de motores. Solo se
            suscribe a los dos topics baratos, así que cuesta unos 7,7 kB/s en total.
          </p>
          <div className="px-5 pb-5 pt-4">
            <Link
              href="/flota"
              className="pulsable focus-ring inline-flex items-center gap-2.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Ver el muro de flota →
            </Link>
          </div>
        </Tarjeta>

        <Tarjeta
          titulo="Cuaderno de medidas"
          subtitulo="Lo que dijo el robot al lado de lo que mediste con la cinta."
        >
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Es lo único que funciona con los robots apagados: se guarda en este navegador, no en
            ningún servidor.
          </p>
          <div className="px-5 pb-5 pt-4">
            <Link
              href="/cuaderno"
              className="pulsable focus-ring inline-flex items-center gap-2.5 rounded-full border border-[rgb(var(--filo)/0.16)] px-5 py-2.5 text-sm font-semibold"
            >
              Abrir el cuaderno
            </Link>
          </div>
        </Tarjeta>
      </div>
      </Grupo>
      </div>

      {/*
        🔴 EL BLOQUE AMBAR ES PERMANENTE, NO UN AVISO TEMPORAL.
        La portada dice lo que la aplicacion NO sabe hacer, porque la version
        anterior decia «Sistema operacional» sin haber hablado con un robot.

        🔴 Y SU `<h2>` SE HA MUDADO AL ROTULO DEL `Grupo`. Tenia titulo propio de
           19 px dentro de la caja ambar, asi que esta pagina llegaba a usar TRES
           dispositivos distintos para decir «esto es una seccion»: el rotulo de
           `Grupo` arriba, la capucha de `Tarjeta` en medio, y un `<h2>` suelto
           aqui. Con el titulo fuera, la caja ambar es solo lo que dice —el
           contenido— y quien la nombra es el mismo mecanismo que nombra a las
           otras dos divisiones.

        📝 Y la linea de «permanente, no un aviso de paso» pasa a `fuente`, que
           es exactamente su papel: decir de que naturaleza es lo de dentro.
      */}
      {/*
        🔴 FONDO OPACO, por lo mismo que las pastillas de arriba: un `warning` al
           8 % deja que los orbes de la luz ambiente atraviesen la caja, y el
           color que porta el nivel del aviso solo existe en un trozo de su
           propia caja. `--aviso-atencion` es ese tinte ya resuelto sobre la
           ficha blanca — el mismo que usa `Aviso`.
      */}
      <div className="mt-12">
      <Grupo titulo="Lo que todavía no funciona" fuente="permanente, no un aviso de paso">
      <section className="rounded-ficha border border-warning/40 bg-[rgb(var(--aviso-atencion))] p-6 sm:p-7">
        {/*
          🔴 TRES COLUMNAS, UNA POR CARENCIA, Y ANTES ERAN DOS BLOQUES. La
             primera columna la ocupaba el titulo; al mudarse al rotulo del
             grupo, dejar la lista en dos tercios habria devuelto los ~450 px de
             ámbar vacío que la ronda anterior quito. Y las tres carencias son
             hermanas —ninguna manda sobre las otras—, asi que se leen mejor a la
             par que apiladas.
        */}
        <ul className="grid gap-x-10 gap-y-5 text-sm leading-relaxed text-muted-foreground sm:grid-cols-3">
          <li>
            <strong className="text-foreground">El terminal</strong> —escribir y ejecutar código en
            el robot desde aquí— no existe. Va por otro canal, un agente de sesión que aún no está
            escrito, y ese diseño depende de medir primero el punto de acceso del aula.
          </li>
          <li>
            <strong className="text-foreground">La sesión protege esta interfaz, no el
            robot.</strong> Entrar identifica a quien libera una parada de emergencia, y para eso
            sirve. Pero rosbridge no trae autenticación, así que cualquiera en la misma red sigue
            pudiendo hablar con cualquier robot sin pasar por aquí. Es un taller presencial y está
            asumido; se dice, no se disimula.
          </li>
          <li>
            <strong className="text-foreground">Nada de esta aplicación confirma un efecto
            físico.</strong> Cuando mandas una orden, la interfaz dice que se envió — nunca que el
            robot la haya cumplido, porque ningún servicio del robot devuelve esa información.
          </li>
        </ul>
      </section>
      </Grupo>
      </div>
    </main>
    </div>
  )
}
