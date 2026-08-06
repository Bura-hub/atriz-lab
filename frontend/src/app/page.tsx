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
    <header className="campo-seccion relative z-10" style={tono}>
      {/* Textura, no contenido —de ahi el `aria-hidden`—, y el numero no es
          decorativo: es el mismo 16 que dice el parrafo de debajo. */}
      <span aria-hidden="true" className="cifra-fantasma">{TOTAL_ROBOTS}</span>
      {/*
        📝 SIN ANTE-TITULO. Iba a llevar «Laboratorio de robótica presencial»,
           que es **literalmente** lo que ya dice el raíl bajo la marca, tres
           centímetros a la izquierda y en la misma caja alta monoespaciada. Una
           repetición así no informa: enseña a saltarse las microetiquetas.
      */}
      {/*
        🔴 A DOS COLUMNAS, Y NO POR ADORNO: medido a 1920 px, con el titular y el
           parrafo apilados a la izquierda la banda dejaba ~740 px de violeta
           vacio a su derecha. La banda es lo mas grande de la pantalla y estaba
           medio sin usar.

        📐 Y el tamaño del titular es `clamp(2.5rem, 6vw, 4.5rem)`, el MISMO de
           la flota y del cuaderno. Antes las tres cabeceras median 72, 78 y 60 px
           con factores `vw` distintos — tres tamaños no son una escala.
      */}
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-10 gap-y-5 px-4 pb-10 pt-14 sm:px-6">
        <h1
          className="font-semibold leading-[0.94] tracking-[-0.05em] text-white"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
        >
          Laboratorio<br />Atriz
        </h1>
        <p className="max-w-[46ch] pb-1.5 text-base leading-relaxed text-white/80">
          {TOTAL_ROBOTS} robots Sphero RVR, cada uno con su Raspberry Pi y su LIDAR. Esta
          aplicación habla con ellos por rosbridge, un WebSocket por robot.
        </p>
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

      {/* Igual alto por la rejilla: los dos destinos secundarios son hermanos,
          no una pila. */}
      <div className="mt-11 grid gap-5 sm:grid-cols-2">
        <Tarjeta titulo="Para el profesor" subtitulo="El muro dice a cuál hay que levantarse.">
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

      {/*
        🔴 EL BLOQUE AMBAR ES PERMANENTE, NO UN AVISO TEMPORAL.
        La portada dice lo que la aplicacion NO sabe hacer, porque la version
        anterior decia «Sistema operacional» sin haber hablado con un robot.

        📝 Se separa con `mt-14` y no con otra caja igual: lo que lo distingue
           de lo de arriba es que NO es un destino. Si algo se desbloquea, se
           quita de aqui — y si algo se rompe, se añade.
      */}
      {/*
        🔴 FONDO OPACO, por lo mismo que las pastillas de arriba: un `warning` al
           8 % deja que los orbes de la luz ambiente atraviesen la caja, y el
           color que porta el nivel del aviso solo existe en un trozo de su
           propia caja. `--aviso-atencion` es ese tinte ya resuelto sobre la
           ficha blanca — el mismo que usa `Aviso`.
      */}
      <section className="mt-14 rounded-ficha border border-warning/40 bg-[rgb(var(--aviso-atencion))] p-6 sm:p-7">
        {/*
          Dos columnas y no una: `max-w-prose` a ancho completo dejaba 450 px de
          ámbar vacío a la derecha. Con el título en su propia columna el texto
          cae en su medida **y** el bloque ocupa el ancho que tiene.
        */}
        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-3">
          <div>
            <h2 className="text-[19px] font-semibold leading-tight tracking-tight">
              Lo que todavía no funciona
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Permanente, no un aviso de paso: si algo se desbloquea, se quita de aquí.
            </p>
          </div>
          {/* `max-w-prose` y no libre: a ancho completo estas tres lineas corrian
              a ~120 caracteres, justo en el texto que mas importa de la pagina. */}
          <ul className="max-w-prose space-y-3 text-sm leading-relaxed text-muted-foreground sm:col-span-2">
            <li>
              <strong>El terminal</strong> —escribir y ejecutar código en el robot desde aquí— no
              existe. Va por otro canal, un agente de sesión que aún no está escrito, y ese diseño
              depende de medir primero el punto de acceso del aula.
            </li>
            <li>
              <strong>No hay autenticación.</strong> rosbridge no la trae, así que cualquiera en la
              misma red puede hablar con cualquier robot. Es un taller presencial y está asumido,
              pero no se disimula con un inicio de sesión que no protegería nada.
            </li>
            <li>
              <strong>Nada de esta aplicación confirma un efecto físico.</strong> Cuando mandas una
              orden, la interfaz dice que se envió — nunca que el robot la haya cumplido, porque
              ningún servicio del robot devuelve esa información.
            </li>
          </ul>
        </div>
      </section>
    </main>
    </div>
  )
}
