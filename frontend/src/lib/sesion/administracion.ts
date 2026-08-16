/**
 * QUIEN PUEDE HACER QUE CON LAS CUENTAS. Puro: sin `fs`, sin red, sin `crypto`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 SEPARADO DE LAS RUTAS A PROPOSITO
 * ═══════════════════════════════════════════════════════════════════════════
 * La comprobacion que impide dejar la instalacion sin administrador **no puede
 * vivir dentro de un `route.ts`**: ahi no hay forma de probarla sin levantar un
 * servidor, y este repositorio no renderiza ni monta nada en sus pruebas. Aqui
 * es una funcion que recibe una lista y devuelve un motivo, y se prueba en Node.
 *
 * Cada funcion devuelve **el motivo por el que NO se puede**, o `null`. Nunca un
 * booleano: la pantalla tiene que poder decir que falla, y «no autorizado» a
 * secas obliga a adivinar — el mismo criterio que `revisarAlta`.
 */

import { esProfesor, normalizar, type Cuenta } from './reglas'

/** Cuantos profesores quedan si se quita a `sin`. */
function profesoresSalvo(cuentas: readonly Cuenta[], sin: string): number {
  const fuera = normalizar(sin)
  return cuentas.filter((c) => esProfesor(c) && normalizar(c.usuario) !== fuera).length
}

/** La cuenta con ese nombre, o `undefined`. Compara normalizando. */
export function buscar(cuentas: readonly Cuenta[], usuario: string): Cuenta | undefined {
  const n = normalizar(usuario)
  return cuentas.find((c) => normalizar(c.usuario) === n)
}

/**
 * Por que `quien` NO puede borrar a `objetivo`, o `null`.
 *
 * Las tres reglas, y cada una cierra un agujero distinto:
 *
 *  1. **Solo un profesor administra.** Con dieciseis alumnos con cuenta, dejar
 *     que cualquiera borre cuentas es dejar que cualquiera borre la del profesor.
 *  2. **Nadie se borra a si mismo.** No es paternalismo: el borrado no cierra la
 *     sesion, asi que quien se borra se queda con una cookie firmada valida
 *     apuntando a una cuenta que ya no existe — y ahi el comportamiento depende
 *     de que haga cada endpoint al no encontrarla. Un estado que nadie ha
 *     probado.
 *  3. 🔴 **No se puede borrar al ULTIMO profesor.** Sin esta, una instalacion se
 *     queda sin nadie capaz de crear cuentas, y la unica salida es editar
 *     `usuarios.json` a mano en el portatil del aula — que es exactamente el
 *     estado del que esta pantalla existe para sacar. Es irreversible desde la
 *     interfaz, y por eso se comprueba aqui y no en la pantalla.
 */
export function porQueNoSePuedeBorrar(
  cuentas: readonly Cuenta[], quien: Cuenta | undefined, objetivo: string,
): string | null {
  if (!esProfesor(quien)) return 'Solo un profesor puede borrar cuentas.'

  const victima = buscar(cuentas, objetivo)
  if (victima === undefined) return 'Esa cuenta no existe.'

  if (normalizar(quien!.usuario) === normalizar(objetivo)) {
    return 'No puedes borrar tu propia cuenta: te quedarias con una sesion abierta sin cuenta detras.'
  }

  if (esProfesor(victima) && profesoresSalvo(cuentas, objetivo) === 0) {
    return 'Es el ultimo profesor. Si lo borras, nadie podra crear cuentas y habra que editar '
      + 'el fichero a mano en el portatil.'
  }

  return null
}

/**
 * Por que `quien` NO puede cambiar la contraseña de `objetivo`, o `null`.
 *
 * 🔴 Un profesor cambia la de cualquiera **sin saber la anterior** —para eso
 *    existe el reseteo: alguien perdio el papel—. Cualquiera cambia la SUYA, y
 *    entonces **si** hace falta la actual: sin ese requisito, una sesion olvidada
 *    en un portatil del aula permite cambiar la contraseña y quedarse la cuenta.
 */
export function porQueNoSePuedeCambiarClave(
  cuentas: readonly Cuenta[], quien: Cuenta | undefined, objetivo: string,
): { motivo: string | null; exigeLaActual: boolean } {
  if (quien === undefined) return { motivo: 'Hace falta una sesion.', exigeLaActual: false }

  const esElMismo = normalizar(quien.usuario) === normalizar(objetivo)
  if (buscar(cuentas, objetivo) === undefined) {
    return { motivo: 'Esa cuenta no existe.', exigeLaActual: false }
  }
  if (!esElMismo && !esProfesor(quien)) {
    return { motivo: 'Solo un profesor puede cambiar la contraseña de otra persona.', exigeLaActual: false }
  }
  return { motivo: null, exigeLaActual: esElMismo }
}

/**
 * Por que `quien` NO puede cambiar el rol de `objetivo`, o `null`.
 *
 * ⚠️ Degradarse a uno mismo **si** se permite —no rompe nada mientras quede otro
 *    profesor— pero **no si es el ultimo**: seria el mismo callejon que borrarlo,
 *    por otra puerta. Es el tipo de agujero que se abre cuando cada operacion
 *    comprueba lo suyo sin mirar la invariante compartida.
 */
export function porQueNoSePuedeCambiarRol(
  cuentas: readonly Cuenta[], quien: Cuenta | undefined, objetivo: string, nuevo: 'profesor' | 'alumno',
): string | null {
  if (!esProfesor(quien)) return 'Solo un profesor puede cambiar roles.'
  if (buscar(cuentas, objetivo) === undefined) return 'Esa cuenta no existe.'

  if (nuevo === 'alumno' && profesoresSalvo(cuentas, objetivo) === 0) {
    return 'Es el ultimo profesor. Si lo pasas a alumno, nadie podra administrar cuentas.'
  }
  return null
}
