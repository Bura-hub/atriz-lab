import { describe, expect, it } from 'vitest'
import { mensajeDeFallo } from './entrada'

describe('mensajeDeFallo', () => {
  it('401 y 400 dicen lo mismo, y no revelan cuál de los dos campos falla', () => {
    // Decir «ese usuario no existe» regala la mitad del par a quien prueba.
    const m = mensajeDeFallo({ estado: 401 })
    expect(m).toBe(mensajeDeFallo({ estado: 400 }))
    expect(m).toMatch(/usuario o contraseña/i)
  })

  it('423 y 429 traen los segundos cuando el servidor los manda', () => {
    expect(mensajeDeFallo({ estado: 423, segundos: 30 })).toContain('30 s')
    expect(mensajeDeFallo({ estado: 429, segundos: 120 })).toContain('120 s')
  })

  it('y aguantan que no vengan', () => {
    // El servidor siempre los manda, pero un mensaje con «undefined s» dentro
    // es peor que uno sin la cifra.
    expect(mensajeDeFallo({ estado: 423 })).not.toContain('undefined')
    expect(mensajeDeFallo({ estado: 429 })).not.toContain('undefined')
  })

  it('el 500 nombra la variable que falta', () => {
    // Quien despliega tiene que leer qué le pasa, no deducirlo.
    expect(mensajeDeFallo({ estado: 500 })).toContain('ATRIZ_SECRETO')
  })

  it('🔴🔴 un estado DESCONOCIDO no se confunde con una contraseña mala', () => {
    /*
     * Es el caso que `SIVE_App` no tiene: su `LoginPage` manda cualquier estado
     * no contemplado al mismo mensaje que el 401, así que un 502 de un proxy mal
     * puesto se lee como «te has equivocado de contraseña» — y quien lo lee se
     * pasa diez minutos tecleando una contraseña que estaba bien.
     */
    for (const estado of [418, 502, 503, 0]) {
      const m = mensajeDeFallo({ estado })
      expect(m).not.toMatch(/usuario o contraseña/i)
      expect(m).toContain(String(estado))
      expect(m).toMatch(/no es tu contraseña/i)
    }
  })
})
