'use client'

/**
 * Lo que el robot esta midiendo AHORA: bateria en voltios, motores con su
 * antiguedad, odometria, encoders y LEDs.
 *
 * ⚠️ `/odom` y `/encoders` van a 16,5 Hz, y aqui se leen MUESTREADOS cada 500 ms
 * (`useMuestreo`). No es solo por ahorrar re-renders: **un numero que parpadea
 * 16 veces por segundo no se puede leer**, y esta pantalla existe para mirarla.
 */

import { useRobot } from '@/hooks/ContextoRobot'
import { SIN_DATO, aGrados, grados, metros, metrosPorSegundo, numero, radianesPorSegundo, yawDeCuaternion } from '@/lib/interfaz/formato'
import { numeroValido } from '@/lib/interfaz/lecturas'
import { Dato } from '@/componentes/ui/Dato'
import { Contexto } from '@/componentes/ui/Contexto'
import { Grupo } from '@/componentes/ui/Grupo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Bateria } from './Bateria'
import { EstadoMotores } from './EstadoMotores'
import { PanelLeds } from './PanelLeds'
import { useMuestreo } from './useMuestreo'

/** 7792 ticks por metro, contrastados contra cinta metrica. */
const TICKS_POR_METRO = 7792

function Odometria() {
  const { transporte } = useRobot()
  const { ultimo } = useMuestreo(transporte, '/odom')

  const pos = ultimo?.pose?.pose?.position
  const yawRad = yawDeCuaternion(ultimo?.pose?.pose?.orientation)
  const lineal = ultimo?.twist?.twist?.linear
  const angular = ultimo?.twist?.twist?.angular

  return (
    <Tarjeta
      titulo="Odometría"
      subtitulo="Del locator del RVR, ya llevada al marco de ROS por el driver: rotación de −90° en posición y velocidad, y el yaw del arranque restado."
      // La prosa de cierre va al pie: colgando del cuerpo se leia como una fila
      // mas de datos, sin la regla que la separa de la rejilla.
      pie={ultimo === null ? (
        <p>Todavía no ha llegado ningún <code>/odom</code>.</p>
      ) : undefined}
    >
      {/*
        🔴 TRES COLUMNAS EN PANTALLA ANCHA, Y NO ES SOLO DENSIDAD. Con dos, los
           cinco datos ocupaban TRES filas y esta tarjeta sacaba dos cabezas a la
           de encoders que tiene al lado — el hueco de la columna derecha era de
           170 px. Con tres caben en dos filas y las dos columnas de la banda
           terminan casi a la misma altura. Es la maqueta de Stitch, que pinta la
           odometria en una malla de tres.

        🔴🔴 Y EL `col-span-2` DE LA VELOCIDAD ANGULAR SE RETIRA: PRODUCIA LA
             CELDA VACIA MAS GRANDE DE LA PANTALLA.

        Medido en una captura de 1400 px: la celda ocupaba dos tercios de la
        malla —unos 470 px— y dentro solo habia una etiqueta y **una raya de
        20 px**. Ademas, al no haber tercera celda en esa fila, **la linea
        vertical entre la segunda y la tercera columna se cortaba tras la primera
        fila**: la rejilla dejaba de ser una rejilla justo a la mitad.

        La malla se completa con una SEXTA celda de verdad, no con un relleno: el
        ORIGEN DEL YAW, que es un hueco declarado y ademas el que mas falta hace
        al lado de «Rumbo (yaw)» — un alumno que lee 0° tiene que saber que eso no
        es el norte.
      */}
      <div className="rejilla sm:grid-cols-2 xl:grid-cols-3">
        <Dato etiqueta="Posición X" valor={metros(numeroValido(pos?.x))}
          crudo={numeroValido(pos?.x) ?? undefined} />
        <Dato etiqueta="Posición Y" valor={metros(numeroValido(pos?.y))}
          crudo={numeroValido(pos?.y) ?? undefined} />
        <Dato
          etiqueta="Rumbo (yaw)"
          valor={yawRad === null ? SIN_DATO : grados(aGrados(yawRad))}
          crudo={yawRad === null ? undefined : aGrados(yawRad)}

        />
        <Dato
          etiqueta="Velocidad lineal"
          valor={metrosPorSegundo(numeroValido(lineal?.x))}
          crudo={numeroValido(lineal?.x) ?? undefined}
          referencia="meseta real 0,199 m/s pidiendo 0,20"
        />
        {/* 🔴 `nota` Y NO `referencia`, y la diferencia se vio en una captura:
            `Referencia` parte el texto por su primer número y lo pinta en
            `.cifra-menor` — con «99-102 %» eso daba un «99-102» de 22 px partido
            en dos renglones dentro de la celda, o sea una cifra enorme para un
            dato que ni siquiera es del robot. En una `.rejilla` las tres celdas de
            una fila comparten alto, así que lo que hace falta aquí es una línea
            subordinada, no una cifra. */}
        <Dato etiqueta="Velocidad angular" valor={radianesPorSegundo(numeroValido(angular?.z))}
          crudo={numeroValido(angular?.z) ?? undefined}
          nota="Alcanza el 99-102 % de lo pedido entre 0,5 y 2,0 rad/s." />
        {/*
          🔴 UN HUECO DECLARADO, Y SIEMPRE. Este no es un dato que falte por
             estar el robot apagado: **no llega por ningun topic y no va a
             llegar**. El driver resta el yaw del arranque antes de publicar
             `/odom`, asi que el origen se queda en su log y aqui no hay nada que
             leer. Y el RVR no tiene rumbo absoluto con el que reponerlo:
             `magnetometer_calibrate_to_north` se acepta sin error y es un no-op
             —ni gira el robot ni emite notificacion—, comprobado mirando el
             robot.

             Se pinta con la misma anatomia que los otros cinco -rotulo, raya,
             nota- para que la malla cierre sin una casilla de relleno, que es lo
             que este proyecto llama «un hueco callado».
        */}
        <Dato
          etiqueta="Origen del yaw"
          valor={SIN_DATO}
          nota="0° es «donde miraba al arrancar», nunca el norte."
        />
      </div>

      <Contexto>
      <p>
        La deriva del rumbo es ~1000 veces mayor los primeros minutos tras encender el RVR: se
        midieron 0,97 °/30 s con el robot recién encendido y 0,001 °/30 s siete minutos después.
        Sobre una práctica de 15 min eso son decenas de grados, y poner la odometría a cero no lo
        corrige: pone el origen a cero, no la deriva. Desaparece sola dejando el robot un rato en
        marcha.
      </p>
      <p>
        El origen del rumbo no se puede recuperar desde aquí, y por eso está declarado como hueco:
        el driver resta el yaw del arranque antes de publicar, así que ese valor se queda en su
        registro. Y el RVR tampoco tiene rumbo absoluto con el que reponerlo — la calibración al
        norte magnético se acepta sin dar error y no hace nada, comprobado mirando el robot.
      </p>
      </Contexto>
    </Tarjeta>
  )
}

function Encoders() {
  const { transporte } = useRobot()
  const { ultimo } = useMuestreo(transporte, '/encoders')
  const izq = numeroValido(ultimo?.left_wheel_count)
  const der = numeroValido(ultimo?.right_wheel_count)

  return (
    <Tarjeta
      titulo="Encoders"
      subtitulo="La única fuente que no depende del marco de referencia. Calibrados contra cinta métrica: 7792 ticks/m."
    >
      {/*
        🔴 UNA COLUMNA, y no es por gusto: esta tarjeta vive en la columna
           estrecha de su banda, donde dos celdas dejarian ~170 px para «12 345
           ticks» en `.cifra`. Apiladas caben enteras y ademas la tarjeta gana la
           altura que le faltaba respecto a la odometria de al lado.
      */}
      <div className="rejilla">
        <Dato
          etiqueta="Rueda izquierda"
          valor={izq === null ? SIN_DATO : `${numero(izq, 0)} ticks`}
          nota={izq === null ? undefined : `${metros(izq / TICKS_POR_METRO)} recorridos`}
        />
        <Dato
          etiqueta="Rueda derecha"
          valor={der === null ? SIN_DATO : `${numero(der, 0)} ticks`}
          nota={der === null ? undefined : `${metros(der / TICKS_POR_METRO)} recorridos`}
        />
      </div>
      <Contexto><p>
        Los ticks llegan CON signo: el driver ya convierte los 32 bits sin signo del RVR, donde un
        retroceso se veía como 4294965940 en vez de −1356.
      </p></Contexto>
    </Tarjeta>
  )
}

/**
 * 🔴🔴 LA PANTALLA SE PARTE POR EL RITMO DE LOS DATOS, NO POR EL ORDEN EN QUE SE
 *      ESCRIBIERON LAS TARJETAS.
 *
 * Esto eran cinco fichas iguales en dos filas de dos columnas mas una suelta, con
 * `items-start`, asi que cada columna acababa donde le tocaba y quedaban huecos de
 * 170 px. Y ninguna decia lo unico que hay que saber para leer estos numeros: que
 * **bateria y motores son un SONDEO cada 30 s** y **odometria y encoders son un
 * FLUJO a 16,5 Hz**. Confundirlos es lo que hace que alguien lea una temperatura
 * de hace medio minuto como si fuera de ahora — y eso ya paso en este proyecto.
 *
 * `Grupo` pone el rotulo y la fuente, que es donde esa diferencia se vuelve
 * visible sin gastar una tarjeta en explicarla.
 *
 * 🔴🔴 Y LA BATERIA ABRE LA PANTALLA, EN SU PROPIA BANDA Y A ANCHO COMPLETO.
 *
 * Estaba dentro de la banda de sondeo, en una malla de dos columnas, EMPATADA
 * con la de motores y en la SEGUNDA banda de la pagina. Con el robot apagado
 * —el estado mas frecuente del laboratorio— eso dejaba la pantalla **sin un solo
 * elemento que dominara**: cinco tarjetas del mismo rango, todas llenas de
 * rayas. El voltaje es el signo vital de este robot y el unico valido por regla
 * del proyecto (el porcentaje dijo 100 % con la bateria a 8,29 V), asi que abre.
 *
 * 📝 Va en su propia banda y no suelta encima de la primera: `/battery_state`
 *    llega cada 30,0 s y ese dato -de donde sale y cada cuanto- es lo que impide
 *    leer un voltaje de hace medio minuto como si fuera de ahora. Sin banda, la
 *    unica tarjeta de la pagina sin procedencia seria justo la que manda.
 *
 * 📝 El resto del orden sigue siendo el de la maqueta de Stitch: flujo, sondeo,
 *    salidas. Y `VoltajeDelMarco` sigue llevando el voltaje a la franja de las
 *    seis pestañas, que responde a la misma pregunta sin cambiar de pantalla.
 */
export function PanelTelemetria() {
  /*
    Las columnas son `flex flex-col`, no celdas de rejilla: asi una tarjeta corta
    se apila bajo la de arriba en vez de estirarse, y el dia que una banda gane
    una tarjeta nueva no hay que tocar el reparto.

    🔴 `[&>section]:flex-1`: sin esto las dos tarjetas de la banda **cerraban a
       alturas distintas** —la de encoders acababa 46 px antes que la de
       odometria— y la banda se leia rota por abajo. Con el, las dos llegan a la
       misma linea.
  */
  const columna = 'flex flex-col gap-4 [&>section]:flex-1'

  return (
    <div className="space-y-8">
      <Grupo
        titulo="Signo vital"
        fuente="/battery_state · cada 30,0 s exactos, es el latido del keepalive"
      >
        <Bateria />
      </Grupo>

      {/*
        📝 LA `fuente` ES UNA LINEA, NO UNA EXPLICACION. La primera version metia
           aqui el porque del muestreo entero y cruzaba la pantalla de lado a
           lado: al lado de un rotulo de dos palabras, eso deja de ser el pie del
           grupo y se convierte en el texto que se lee. El motivo largo ya vive en
           el subtitulo de la tarjeta y en su «Por qué».
      */}
      <Grupo
        titulo="Flujo continuo del RVR"
        fuente="/odom y /encoders · ~16,5 Hz, leídos cada 500 ms"
      >
        {/*
          🔴 2fr/1fr Y NO MITADES. La odometria son cinco medidas y los encoders
             dos: partir el ancho por la mitad daba una tarjeta de tres filas al
             lado de una de una sola, que es de donde salia el hueco. Con la malla
             de tres de la odometria y los encoders apilados, las dos columnas
             cierran casi a la misma altura.
        */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className={columna}><Odometria /></div>
          <div className={columna}><Encoders /></div>
        </div>
      </Grupo>

      {/*
        Motores se queda SOLO en su banda y a ancho completo: la bateria se fue a
        abrir la pantalla, y media tarjeta vacia al lado habria sido peor que una
        entera. Sus cuatro medidas pasan a una malla de cuatro en pantalla ancha
        (ver `EstadoMotores`).
      */}
      <Grupo
        titulo="Sondeo del driver"
        fuente="/motor_status · cada 30 s, así que un valor puede tener medio minuto"
      >
        <EstadoMotores />
      </Grupo>

      {/*
        La tercera banda no es una medida: es lo unico de esta pantalla que SALE
        hacia el robot. Separarla con su rotulo dice de un vistazo que ahi se
        pulsa, no se lee.
      */}
      <Grupo
        titulo="Salidas directas"
        fuente="aquí no se lee: sale cuando pulsas, y enciende luces de verdad"
      >
        <PanelLeds />
      </Grupo>
    </div>
  )
}
