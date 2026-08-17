/**
 * EN CUÁNTOS ROBOTS EXIGE CREDENCIAL EL PROPIO ROBOT. Puro: sin React, sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUÉ EXISTE: LA PORTADA AFIRMABA DE LOS DIECISÉIS LO QUE HACE UNO
 * ═══════════════════════════════════════════════════════════════════════════
 * Decía, en presente y sin matices: *«al entrar, este servidor te firma una
 * credencial para ese robot en concreto, **y el robot la comprueba**. Sin ella
 * te cierra la puerta»*. La Fase B está cerrada **en rvr-01** — el propio
 * repositorio de migración lo anota al lado: *«lo que la Fase B no cierra: TLS
 * y los otros 15 robots»*. O sea que **quince de dieciséis aceptaban hoy una
 * conexión sin credencial** mientras la única pantalla pública decía lo
 * contrario.
 *
 * Es el defecto que esa pantalla existe para no cometer: es la superficie que
 * lee un tribunal, y su argumento entero es que no afirma lo que no ha medido.
 *
 * 👤 Decisión del usuario (2026-08-17): **corregir la frase**, no desplegar la
 *    Fase B a los quince ahora — la recibirán con la imagen dorada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ ESTE NÚMERO SE MANTIENE A MANO, Y HAY QUE SABER POR QUÉ
 * ═══════════════════════════════════════════════════════════════════════════
 * No se puede derivar: la portada **no abre un socket con ningún robot, a
 * propósito** —hacerlo sería contar por fuera lo que la puerta guarda por
 * dentro—, así que aquí no hay forma de preguntárselo a la flota. La verdad
 * vive en los robots, y su registro en `atriz_migracion`
 * (`03_operacion/SEGURIDAD_ROSBRIDGE.md`).
 *
 * 🔴 **Si envejece, envejece hacia el lado seguro.** Quien despliegue la Fase B
 *    a más robots y olvide subir este número deja la página diciendo que la
 *    exigen MENOS de los que la exigen: **infra-afirmar la seguridad no hace
 *    daño; sobre-afirmarla es justo el fallo que esto arregla.** Por eso el
 *    valor por defecto es el conservador y no `TOTAL_ROBOTS`.
 */

/**
 * Cuántos robots EXIGEN hoy el testigo firmado para dejar entrar.
 *
 * `1` = rvr-01, desde el 2026-08-15 (Fase B, evidencia 124).
 */
export const ROBOTS_QUE_EXIGEN_CREDENCIAL = 1

/** Qué se puede afirmar de la flota entera. */
export type AlcanceCredencial = 'NINGUNO' | 'ALGUNOS' | 'TODOS'

/**
 * @throws si los números no pueden describir una flota. Es deliberado y ruidoso:
 *         estos valores son constantes de código, así que un valor imposible es
 *         un fallo de programación que tiene que salir **al compilar o en la
 *         primera carga en desarrollo**, nunca convertirse en una afirmación de
 *         seguridad equivocada en la única pantalla pública. Devolver algo
 *         plausible aquí sería exactamente el `getattr(v, 'valido', False)` que
 *         este proyecto ya pagó en el robot.
 */
export function alcanceDeCredencial(exigen: number, total: number): AlcanceCredencial {
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`una flota no puede tener ${total} robots`)
  }
  if (!Number.isInteger(exigen) || exigen < 0 || exigen > total) {
    throw new Error(`no pueden exigir credencial ${exigen} robots de ${total}`)
  }
  if (exigen === 0) return 'NINGUNO'
  if (exigen === total) return 'TODOS'
  return 'ALGUNOS'
}

/** Las formas verbales que cambian con el número, para la portada. */
export interface Concordancia {
  /** «la exige» · «la exigen» */
  exige: string
  /** «ese robot» · «esos robots» */
  ese: string
  /** «cierra» · «cierran» */
  cierra: string
  /** «hace» · «hacen» */
  hace: string
}

/**
 * La concordancia de número para la frase de la portada.
 *
 * 🔴 EXISTE PORQUE EL NÚMERO VA A CAMBIAR. Hoy vale `1` y la frase se lee «la
 *    exige 1 de los 16»; el día que la imagen dorada llegue a la flota valdrá
 *    `16` y tendría que leerse «la exigen». Escrito a mano, ese día la única
 *    pantalla pública queda mal redactada — y una pantalla cuyo argumento es la
 *    precisión no puede permitirse una concordancia rota justo en la frase que
 *    habla de seguridad.
 *
 * 📝 Es el mismo problema que los números escritos a mano en los encabezados de
 *    este proyecto («Dos trampas», «las CINCO causas»): un dato duplicado que
 *    envejece solo. Aquí no se puede quitar el número —es la información—, así
 *    que se deriva lo que depende de él.
 */
export function concordancia(exigen: number): Concordancia {
  const uno = exigen === 1
  return {
    exige: uno ? 'la exige' : 'la exigen',
    ese: uno ? 'ese robot' : 'esos robots',
    cierra: uno ? 'cierra' : 'cierran',
    hace: uno ? 'hace' : 'hacen',
  }
}
