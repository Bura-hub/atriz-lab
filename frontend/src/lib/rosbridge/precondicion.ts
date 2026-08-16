/**
 * LO QUE TIENE QUE PASAR **ANTES** DE QUE UN SOCKET PUEDA ABRIR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE EXISTE: EL 2026-08-16 LA WEB NO VEIA A rvr-01 Y CULPO AL ROBOT
 * ═══════════════════════════════════════════════════════════════════════════
 * El robot estaba **perfecto** —medido desde la Pi: servicios arriba, RVR
 * hablando, la puerta del testigo verificada en las dos direcciones— y la web no
 * lo enseñaba. La causa era de este lado y de las mas simples: **nadie habia
 * iniciado sesion**, asi que `/api/sesion/testigo` devolvia 401, el proveedor
 * devolvia `null`, y el transporte **ni siquiera abria un socket**.
 *
 * El transporte SI era honesto: emite «El servidor no ha dado una credencial
 * para este robot. Puede que se haya cerrado tu sesion». El fallo fue que ese
 * aviso **solo lo leia la pestaña Diagnostico**. El muro no lo mira: pintaba las
 * dieciseis baldosas como *«sin señal de vida»*.
 *
 * O sea que la pantalla **acusaba a los robots de un fallo del PC**, que es la
 * forma que este proyecto lleva contada desde `ros2 topic hz`: *el fallo estaba
 * en el medidor y se atribuyo a lo medido*. Y ademas nadie podia verlo desde el
 * robot: en su journal no habia **ni un cliente**, que es indistinguible de
 * «nadie ha abierto la pagina».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 SE COMPRUEBA ANTES, NO SE DEDUCE DEL FALLO
 * ═══════════════════════════════════════════════════════════════════════════
 * Se podria esperar a que los dieciseis sockets fallaran y leer sus avisos. No:
 *
 *   · **Son dieciseis mensajes identicos para UNA causa.** Un muro con dieciseis
 *     errores no dice «te falta la sesion»: dice «el laboratorio esta caido».
 *   · **Tarda.** El plazo de conexion son 10 s, y hasta entonces la pantalla no
 *     puede decir nada.
 *   · Y sobre todo: **no hace falta**. Que no hay sesion se sabe sin tocar la
 *     red. Preguntarselo a los robots es diagnosticar por sintoma teniendo la
 *     causa a mano.
 *
 * ⚠️ NO SUSTITUYE al aviso del transporte, lo precede. Una sesion que caduca **a
 *    mitad** de la clase no la ve esta funcion: eso sigue saliendo por
 *    `ultimoAviso`, y por eso se cablea tambien en `MarcoRobot`.
 */

/** A donde apunta una baldosa o una pestaña. Un numero es un robot de la flota. */
export type Destino = number | string

export type Precondicion =
  /**
   * 🔴 TODAVIA NO SE SABE, y no es lo mismo que «esta bien».
   *
   * Mientras la sesion carga no se puede afirmar que falte: acusar antes de
   * saber es lo que hace parpadear un aviso rojo en cada carga de pagina, y este
   * proyecto ya tiene la regla escrita para `/estado_robot` — **no saber no es
   * un no**.
   */
  | { estado: 'NO_SE_SABE' }
  | { estado: 'LISTO' }
  | { estado: 'SIN_SESION'; titulo: string; mensaje: string; enlace: string }
  | { estado: 'POR_DIRECCION'; titulo: string; mensaje: string }

export interface Observaciones {
  /** `NEXT_PUBLIC_ATRIZ_TESTIGO === '1'`: los robots de este despliegue lo exigen. */
  exigido: boolean
  /** De `useSesion()`. `null` = no hay. */
  usuario: string | null
  /** De `useSesion()`. Mientras es `true` no se sabe. */
  cargando: boolean
  /**
   * Opcional. Con un destino concreto se comprueba ademas si se puede FIRMAR
   * para el; sin el, solo se comprueba la sesion — que es lo que necesita el
   * muro para decirlo **una vez** en vez de dieciseis.
   */
  destino?: Destino
}

const ES_ROBOT = (d: Destino): boolean =>
  Number.isInteger(typeof d === 'number' ? d : Number(d))
  && Number(d) >= 1 && Number(d) <= 16

/**
 * ¿Puede este navegador abrir un socket con el robot, ahora mismo?
 *
 * Devuelve `LISTO` cuando no hay nada que impida intentarlo. **`LISTO` no
 * promete que el robot conteste**: eso solo lo dice el socket, y esta funcion no
 * toca la red a proposito.
 */
export function evaluarPrecondicion(o: Observaciones): Precondicion {
  // Sin interruptor, esto es exactamente lo de antes: el transporte abre y ya.
  if (!o.exigido) return { estado: 'LISTO' }

  if (o.cargando) return { estado: 'NO_SE_SABE' }

  /*
   * 🔴 EL DESTINO VA ANTES QUE LA SESION, y el orden importa.
   *
   * A un robot alcanzado por IP no se le puede firmar un testigo —lleva `rob`, y
   * una IP no tiene numero que comparar—, asi que **iniciar sesion no lo
   * arregla**. Al reves, mandar a alguien a entrar cuando entrar no sirve es el
   * consejo equivocado, y esta aplicacion tiene escrito que un remedio que no
   * remedia es peor que ninguno.
   */
  if (o.destino !== undefined && !ES_ROBOT(o.destino)) {
    return {
      estado: 'POR_DIRECCION',
      titulo: 'este robot está puesto por dirección, y así no se le puede dar credencial',
      mensaje: 'Los robots de este laboratorio exigen una credencial que lleva dentro el número '
        + 'del robot, y una dirección no tiene número que comparar. Quita la dirección de «dónde '
        + 'buscar» para que vuelva a entrar por su nombre, o comprueba en el robot por qué su '
        + 'nombre no responde.',
    }
  }

  if (o.usuario === null) {
    return {
      estado: 'SIN_SESION',
      titulo: 'no has iniciado sesión, y por eso no se ve ningún robot',
      mensaje: 'Los robots de este laboratorio exigen una credencial, y la credencial la firma '
        + 'este servidor solo para quien ha entrado. Sin sesión no se llega a abrir la conexión, '
        + 'así que esto NO dice nada sobre los robots: pueden estar perfectamente.',
      enlace: '/entrar',
    }
  }

  return { estado: 'LISTO' }
}

/**
 * ¿Hay que enseñar algo? Atajo para no repetir la comparacion en cada pantalla.
 *
 * 📝 `NO_SE_SABE` **no** se enseña: es el estado de medio segundo mientras la
 *    sesion carga, y pintarlo produciria un aviso que aparece y desaparece en
 *    cada carga de cada pagina.
 */
export const hayQueAvisar = (p: Precondicion): boolean =>
  p.estado === 'SIN_SESION' || p.estado === 'POR_DIRECCION'
