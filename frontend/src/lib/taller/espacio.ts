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

export const ESPACIO: readonly EspacioPractica[] = [
  { fichero: '01_primer_movimiento.py', titulo: 'Primer movimiento', despejar: '1,5 m delante y ~1 m detrás' },
  { fichero: '02_giro.py', titulo: 'Giro', despejar: '40 cm alrededor' },
  { fichero: '03_cuadrado.py', titulo: 'Cuadrado', despejar: 'un cuadrado libre de ~1,5 m de lado' },
  { fichero: '04_giro_preciso.py', titulo: 'Giro preciso', despejar: '40 cm alrededor, y un transportador' },
  { fichero: '05_sensor_color.py', titulo: 'Sensor de color', despejar: 'el robot no se mueve' },
  { fichero: '10_navegacion.py', titulo: 'Navegación', despejar: '3 m en la dirección en que mire' },
  { fichero: '11_sensor_avanzado.py', titulo: 'Sensor avanzado', despejar: '1 m, cinta negra cruzando y 40 cm detrás' },
  { fichero: 'seguidor_linea.py', titulo: 'Seguidor de línea', despejar: 'una pista de 6 m o más' },
  { fichero: '90_practica_libre.py', titulo: 'Práctica libre', despejar: '1 m delante y 40 cm alrededor' },
  { fichero: '99_test_ctrl_c.py', titulo: 'Ctrl-C y señales', despejar: '1,5 m' },
  {
    fichero: null,
    titulo: 'Tu propio guion',
    // 🔴 `null` a proposito. Ver el comentario de `despejar`.
    despejar: null,
  },
]

/**
 * 🔴 LOS DOS AVISOS QUE NO PUEDEN FALTAR AL PIE DE LA TABLA.
 *
 * Los dos son medidas, y los dos contradicen lo que alguien supondría:
 *
 *   · «despejado» se mide **a la altura del plano de barrido**, 15,5 cm del
 *     suelo. El LIDAR pasa POR ENCIMA de zócalos y cajas bajas, así que un
 *     suelo despejado a ras no basta y el robot chocaría con algo que su
 *     sensor nunca vio.
 *   · **hacia atrás no hay capa de seguridad**: el polígono del
 *     `collision_monitor` se extiende hacia DELANTE. Retroceder no está
 *     protegido por nada.
 */
export const AVISOS_ESPACIO: readonly string[] = [
  'Despejado se mide a 15,5 cm del suelo, que es donde barre el LIDAR — no a ras de suelo. '
  + 'El barrido pasa por encima de zócalos y cajas bajas.',
  'Hacia atrás no hay capa de seguridad: el polígono de precaución se extiende hacia delante. '
  + 'Un retroceso no está protegido por nada.',
]

/** Las prácticas cuya fila lleva un número que alguien midió. */
export function conCuenta(t: readonly EspacioPractica[] = ESPACIO): EspacioPractica[] {
  return t.filter((p) => p.despejar !== null)
}
