/**
 * DE QUE CLIENTE VIENE UNA PETICION, para poder limitarlo. Puro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE HACE FALTA: EL BLOQUEO POR USUARIO NO PROTEGE DE LO QUE PARECE
 * ═══════════════════════════════════════════════════════════════════════════
 * `bloqueo.ts` cuenta los fallos **por nombre de usuario**, y esta bien: es lo
 * que impide adivinar la contraseña de alguien concreto. Pero deja dos huecos:
 *
 *  1. **Quien ROTA nombres no se bloquea nunca.** Cada nombre tiene su propio
 *     cubo, asi que probar `alumno-01`, `alumno-02`… reinicia el contador en cada
 *     salto. Con dieciseis nombres predecibles —que es exactamente lo que el alta
 *     por lote crea— eso deja de ser teorico.
 *  2. 🔴 **Y el bloqueo por usuario es, en si mismo, un oraculo de existencia.**
 *     `entrar/route.ts` se esfuerza en no filtrar si una cuenta existe —verifica
 *     contra un hash de relleno cuando no existe, para que el tiempo no lo
 *     delate— y luego el 423 lo delata igual: **solo se bloquea lo que existe**.
 *
 * Un cubo por cliente cierra los dos: la rotacion de nombres cae en el mismo
 * contador, y el 429 llega antes de que el 423 pueda decir nada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LO QUE ESTO NO ES, Y HAY QUE DECIRLO ANTES DE QUE ALGUIEN LO SUPONGA
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sin un proxy delante, esto NO distingue clientes.** `next dev` en un portatil
 * del aula recibe las peticiones directamente, y sin `x-forwarded-for` todos los
 * clientes caen en la MISMA clave: el aula entera comparte cubo.
 *
 * Eso es **correcto para la escena real** —un aula, un punto de acceso, un
 * servidor sin proxy— y seria **falso** detras de uno. Por eso el tope por
 * cliente es alto (ver `FALLOS_POR_CLIENTE`): tiene que estorbar a quien prueba
 * cientos de veces sin dejar fuera a una clase entera por un alumno torpe.
 *
 * 🔴 Y la cabecera es FALSIFICABLE. Cualquiera puede mandar `x-forwarded-for`.
 *    Esto no es una defensa contra un atacante decidido: es un freno contra el
 *    barrido automatico y contra el oraculo de existencia. Decirlo evita que
 *    alguien lo tome por lo que no es.
 */

/** Fallos por cliente antes de castigar. Alto a proposito: ver la cabecera. */
export const FALLOS_POR_CLIENTE = 20

/**
 * La clave con la que se cuenta a un cliente.
 *
 * `x-forwarded-for` puede traer una cadena (`cliente, proxy1, proxy2`): el
 * primer salto es el cliente. Si no hay cabecera, todos comparten `'sin-ip'`, y
 * eso **se ve** en la clave — no se disfraza de identidad.
 */
export function claveDeCliente(cabeceras: Headers): string {
  const reenviado = cabeceras.get('x-forwarded-for')
  if (reenviado !== null && reenviado.trim() !== '') {
    const primero = reenviado.split(',')[0].trim()
    if (primero !== '') return `ip:${primero}`
  }
  const real = cabeceras.get('x-real-ip')
  if (real !== null && real.trim() !== '') return `ip:${real.trim()}`
  return 'sin-ip'
}

/** ¿Estamos contando a todo el mundo junto? La pantalla lo puede decir. */
export const esCuboCompartido = (clave: string): boolean => clave === 'sin-ip'
