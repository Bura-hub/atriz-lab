/**
 * LOS DOS ESTADOS EN LOS QUE NO HAY MAPA QUE PINTAR — y por qué son distintos.
 *
 * 🔴 Un canvas vacío se lee como «la interfaz está rota», así que lo primero de
 *    esta pantalla es un diagnóstico y no un dibujo. Estas dos tarjetas son ese
 *    diagnóstico; salieron de `PanelNavegar`, que hacía 715 líneas.
 */

import { Aviso } from '@/componentes/ui/Aviso'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/** Ni `/map` ni `/amcl_pose`: Nav2 no está levantado. Y no es una avería. */
export function Nav2Parado() {
  return (
    <Tarjeta titulo="Nav2 no está corriendo" subtitulo="Y no es una avería: está así a propósito.">
      <Aviso nivel="NOTA" titulo="Qué falta para que esta pantalla haga algo">
        No llega ni <code>/map</code> ni <code>/amcl_pose</code>. El servicio de navegación
        está <strong>instalado y sin habilitar</strong> en los robots: Nav2 cuesta ~58 % de un
        núcleo y la Pi se alimenta de la batería del RVR, cuya autonomía (~2 h) ya no cubre
        una clase. Se arranca <strong>desde el panel de arriba</strong>, sin entrar al robot.
      </Aviso>
      <div className="mt-3">
        {/*
          🔴 «no existe todavía» ERA UNA AFIRMACIÓN ESTÁTICA, y quedó falsa el
             2026-08-07 en cuanto se mapeó un cuarto. Ahora se remite al panel
             de arriba, que lee `hay_mapa` DEL ROBOT en vez de recordarlo.

          🔴 AMPLIADO EL 2026-08-09 con el mecanismo, que es más útil que la
             regla. Antes decía «si has movido las mesas, vuelve a mapear» —
             correcto, pero da a entender que el problema es un mapa VIEJO. La
             evidencia 90 midió que basta con AÑADIR algo a un cuarto ya mapeado:
             con una puerta de dos cajas, la corrección `map→odom` se fue de 0,00
             a 1,68 m sobre un mapa de dos días antes. Una silla que un alumno
             deja donde no estaba lo reproduce.
        */}
        <Aviso nivel="ATENCION" titulo="Y aunque arranque, hace falta un mapa DE ESTE SITIO">
          AMCL localiza contra un mapa guardado, y el panel de arriba dice si el robot tiene
          alguno. <strong>Que exista uno no basta: tiene que ser de donde está el robot
          ahora.</strong> Con un mapa del sitio equivocado Nav2 navega, dice que llegó, y se
          queda a 41 cm — medido. Y <strong>no hace falta que el mapa sea viejo: basta con
          añadir algo</strong> — una silla que no estaba al mapear llevó la localización a{' '}
          <strong>1,68 m</strong> de error. Si has movido o añadido muebles, vuelve a mapear.
        </Aviso>
      </div>
    </Tarjeta>
  )
}

/**
 * Llega `/amcl_pose` y no llega `/map`.
 *
 * 🔴 ESTA TARJETA DECÍA «sospecha de la durabilidad», y se MIDIÓ que no era eso:
 *    cinco suscripciones nuevas a `/map` contra un mapa vivo dieron 38-48 ms las
 *    cinco. Descartar una causa con datos vale tanto como señalar la buena; lo
 *    que sobra es mandar a investigar lo ya refutado.
 */
export function MapaQueNoLlega() {
  return (
    <Tarjeta titulo="AMCL habla, pero el mapa no llega" subtitulo="Y hay una causa que ya se puede descartar.">
      <Aviso nivel="NOTA" titulo="No es la durabilidad de la suscripción: está medida">
        Se comprobó con cinco suscripciones nuevas a <code>/map</code> contra un mapa vivo, y
        el primer mensaje llegó en <strong>38-48 ms</strong> las cinco veces. Si el valor
        latcheado no se entregara habría que esperar segundos. Así que{' '}
        <strong>rosbridge sí recibe mapas ya publicados</strong>, y esa vía queda descartada.
      </Aviso>
      <div className="mt-3">
        <Aviso nivel="ATENCION" titulo="Dónde mirar entonces">
          Que <code>map_server</code> esté vivo y con un fichero de mapa que exista, y que el
          mapa se esté publicando de verdad. <strong>Nada de esto se ve desde aquí</strong>:
          hay que mirarlo en el robot.
          <br /><br />
          ⚠️ Y una diferencia sin medir: lo de arriba se comprobó contra{' '}
          <code>slam_toolbox</code>, que republica cada 5 s. Con AMCL el mapa lo emite{' '}
          <code>map_server</code> <strong>una sola vez</strong>. El mecanismo es el mismo, así
          que lo esperable es que también llegue — pero esperable no es medido.
        </Aviso>
      </div>
    </Tarjeta>
  )
}

/**
 * Hay `/map` pero no `/amcl_pose`: esto es SLAM, no Nav2.
 *
 * 🔴 Sin esta distinción la pantalla decía «pulsa en el mapa para mandar al
 *    robot» sobre un robot que no puede recibir el objetivo. Invitar a un gesto
 *    que va a fallar es peor que no ofrecerlo: quien lo pulsa busca el fallo en
 *    su clic.
 */
export function PareceSlamNoNav2() {
  return (
    <Aviso nivel="NOTA" titulo="Esto parece SLAM, no Nav2: hay mapa pero no navegación">
      Llega <code>/map</code> pero no <code>/amcl_pose</code>, y los dos salen del
      mismo arranque de Nav2. Así que el mapa se está dibujando —eso funciona— pero{' '}
      <strong>no hay servidor al que mandarle un objetivo</strong>: pulsar aquí
      contestaría «no hay servidor de acción». Es lo que pasa con{' '}
      <code>slam.launch.py</code> a solas, que es justo lo que hace falta para{' '}
      <strong>crear</strong> el mapa.
      <br /><br />
      Para navegar hace falta el mapa guardado y AMCL. Y esto se deduce de que no
      llegue <code>/amcl_pose</code>, no se pregunta: si crees que Nav2 sí está
      levantado, míralo en el robot.
    </Aviso>
  )
}
