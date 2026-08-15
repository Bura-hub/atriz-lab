/**
 * LA CUENTA DEL ESPACIO, POR PRÁCTICA. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ ESTO VA **ANTES** DE EJECUTAR, Y NO EN UNA AYUDA
 * ═══════════════════════════════════════════════════════════════════════════
 * En cuanto el guion construye `Robot()`, la biblioteca **enciende el barrido
 * del LIDAR**, y a partir de ese instante el robot ya obedece. La cuenta del
 * espacio no puede vivir detrás de un clic: para cuando alguien la busque, el
 * robot ya se está moviendo.
 *
 * ⚠️ Y el robot **no esquiva**: solo tiene el `collision_monitor`, que además
 *    necesita `/scan`. Esta tabla es lo único que hay entre una práctica y una
 *    caída de la mesa.
 */

export interface EspacioPractica {
  /** El fichero de `scripts/estudiantes/`, o `null` para el guion del alumno. */
  fichero: string | null
  titulo: string
  /**
   * Lo que hay que despejar. `null` cuando **no se puede saber**: un fichero
   * escrito por el alumno hace lo que diga su código, y poner un número ahí
   * sería inventarlo.
   */
  despejar: string | null
}

/*
 * 🔴🔴 LOS NOMBRES SE CORRIGIERON EL 2026-08-14, Y CINCO DE DIEZ ESTABAN MAL.
 *
 * Comparados con `Atriz_rvr/scripts/estudiantes/` no existían:
 *
 *     esta tabla decía        el robot tiene
 *     01_primer_movimiento →  01_avanzar.py
 *     02_giro              →  02_girar.py
 *     10_navegacion        →  10_movimiento_completo.py
 *     90_practica_libre    →  90_template.py
 *     seguidor_linea       →  seguidor_linea_pid_demo.py
 *
 * Mientras esta tabla solo decía cuánto despejar, un nombre equivocado era
 * cosmético. **Desde que el terminal ejecuta, un nombre equivocado es un botón
 * que falla.**
 *
 * → Y de ahí la decisión que lo impide para siempre: **la lista de prácticas la
 *   da el AGENTE**, leyendo el directorio del robot. Esta tabla ya no es la
 *   lista: es lo que alguien MIDIÓ sobre algunas de ellas, y se casa por nombre.
 *   Lo que el agente liste y esto no conozca sale con «no tengo la cuenta de
 *   este fichero», que es la verdad.
 */
export const ESPACIO: readonly EspacioPractica[] = [
  { fichero: '01_avanzar.py', titulo: 'Primer movimiento', despejar: '1,5 m delante y ~1 m detrás' },
  { fichero: '02_girar.py', titulo: 'Giro', despejar: '40 cm alrededor' },
  { fichero: '03_cuadrado.py', titulo: 'Cuadrado', despejar: 'un cuadrado libre de ~1,5 m de lado' },
  { fichero: '04_giro_preciso.py', titulo: 'Giro preciso', despejar: '40 cm alrededor, y un transportador' },
  { fichero: '05_sensor_color.py', titulo: 'Sensor de color', despejar: 'el robot no se mueve' },
  { fichero: '10_movimiento_completo.py', titulo: 'Movimiento completo', despejar: '3 m en la dirección en que mire' },
  { fichero: '11_sensor_avanzado.py', titulo: 'Sensor avanzado', despejar: '1 m, cinta negra cruzando y 40 cm detrás' },
  { fichero: 'seguidor_linea_pid_demo.py', titulo: 'Seguidor de línea', despejar: 'una pista de 6 m o más' },
  { fichero: '90_template.py', titulo: 'Plantilla para empezar', despejar: '1 m delante y 40 cm alrededor' },
  { fichero: '99_test_ctrl_c.py', titulo: 'Ctrl-C y señales', despejar: '1,5 m' },

  /*
   * Las cinco de infrarrojos, añadidas el 2026-08-14. **Necesitan DOS robots.**
   * Lo que dice cada fila sale de la cabecera de su propio fichero, no de una
   * estimación de aquí.
   *
   * 🔴 Y las dos últimas llevan un aviso que ninguna otra práctica lleva: el
   *    robot se mueve por FIRMWARE, y eso **no pasa por la capa de seguridad**.
   *    Ni el vigilante ni el `collision_monitor` lo ven.
   */
  { fichero: '20_identificarse.py', titulo: 'Identificarse por IR', despejar: 'el robot no se mueve' },
  { fichero: '21_mensajeria.py', titulo: 'Mensajería por IR', despejar: 'el robot no se mueve' },
  {
    fichero: '22_marco_polo.py',
    titulo: 'Marco Polo',
    despejar: 'dos robots; el que busca lo mueves tú a mano',
  },
  {
    fichero: '23_tren_de_robots.py',
    titulo: 'Tren de robots',
    despejar: 'dos robots, espacio despejado y suelo continuo — 🔴 se mueve SIN capa de seguridad, no te vayas',
  },
  {
    fichero: '24_dispersion.py',
    titulo: 'Dispersión',
    despejar: 'dos robots, espacio despejado, sin escalones — 🔴 se mueve SIN capa de seguridad, no te vayas',
  },

  {
    fichero: null,
    titulo: 'Tu propio guion',
    // 🔴 `null` a proposito. Ver el comentario de `despejar`.
    despejar: null,
  },
]

/**
 * 🔴 LOS AVISOS QUE NO PUEDEN FALTAR AL PIE DE LA TABLA.
 *
 * Todos son medidas, y todos contradicen lo que alguien supondría:
 *
 *   · «despejado» se mide **a la altura del plano de barrido**, 15,5 cm del
 *     suelo. El LIDAR pasa POR ENCIMA de zócalos y cajas bajas, así que un
 *     suelo despejado a ras no basta y el robot chocaría con algo que su
 *     sensor nunca vio.
 *   · un obstáculo **a menos de 15 cm en cualquier dirección** no frena al
 *     robot: lo **inmoviliza**, y no puede salir ni alejándose.
 *   · hay **~1 cm ciego** pegado al chasis que ningún parámetro cubre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 RETIRADO EL 2026-08-09: «hacia atrás no hay capa de seguridad»
 * ═══════════════════════════════════════════════════════════════════════════
 * Aquí decía, al alumno y al pie de la tabla de prácticas, que *«el polígono
 * del `collision_monitor` se extiende hacia DELANTE; un retroceso no está
 * protegido por nada»*. **Es falso por dos vías independientes, las dos
 * medidas:**
 *
 *   1. El círculo de aproximación es un CÍRCULO. El barrido de pared del
 *      2026-08-09 (24 estaciones, cuatro direcciones) dio el mismo umbral en
 *      las cuatro: DETRÁS 17,8 · DELANTE 16,1 · IZQUIERDA 17,9 · DERECHA 17,9.
 *      Hacia atrás protege **igual** que hacia delante.
 *   2. `Precaucion` tampoco acaba en el robot: va de −0,24 a +0,36 m, o sea
 *      **24 cm por detrás**. Ya estaba medido —un retroceso pedido de 30 cm
 *      recorrió 14 porque frenaba— y esta frase lo contradecía en el mismo
 *      repositorio.
 *
 * 📝 El aviso no era «prudente de más»: enseñaba a desconfiar de una protección
 *    que sí existe, y de paso dejaba sin contar la que de verdad muerde, que es
 *    quedarse clavado sin poder salir.
 */
export const AVISOS_ESPACIO: readonly string[] = [
  'Despejado se mide a 15,5 cm del suelo, que es donde barre el LIDAR — no a ras de suelo. '
  + 'El barrido pasa por encima de zócalos y cajas bajas.',
  'Un obstáculo a menos de 15 cm deja al robot INMÓVIL, no lento: no avanza, no gira y no puede '
  + 'alejarse. Pasa en las cuatro direcciones por igual, y solo se sale retirando el obstáculo '
  + 'o moviendo el robot con la mano.',
  'El LIDAR no ve nada a menos de 10 cm de su eje, y el borde del robot está a 9: hay ~1 cm '
  + 'pegado al chasis que la capa de seguridad no puede ver. No dejes nada tocando el robot.',
]

/** Las prácticas cuya fila lleva un número que alguien midió. */
export function conCuenta(t: readonly EspacioPractica[] = ESPACIO): EspacioPractica[] {
  return t.filter((p) => p.despejar !== null)
}
