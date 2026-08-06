import { describe, expect, it } from 'vitest'
import { MINIMO_CONTRASENA, hashear, normalizar, revisarAlta, verificar } from './credenciales'

describe('hashear y verificar', () => {
  it('la contraseña no aparece en lo que se guarda', () => {
    // Lo único que de verdad hay que comprobar de un hash: que el fichero de
    // usuarios no se pueda leer como una lista de contraseñas.
    return hashear('naranja-tornillo-42').then((g) => {
      expect(g).not.toContain('naranja')
      expect(g).not.toContain('tornillo')
      expect(g.split(':')).toHaveLength(2)
    })
  })

  it('acepta la buena y rechaza la mala', async () => {
    const g = await hashear('naranja-tornillo-42')
    expect(await verificar('naranja-tornillo-42', g)).toBe(true)
    expect(await verificar('naranja-tornillo-43', g)).toBe(false)
    expect(await verificar('', g)).toBe(false)
  })

  it('🔴 dos cuentas con la MISMA contraseña dan hashes DISTINTOS', async () => {
    /*
     * La sal. Sin ella, dos entradas iguales en el fichero delatan que esas dos
     * personas comparten contraseña —sin romper nada, solo mirándolo—, y una
     * tabla precalculada valdría para las dos a la vez.
     */
    const a = await hashear('la-misma-de-siempre')
    const b = await hashear('la-misma-de-siempre')
    expect(a).not.toBe(b)
    // Y aun así las dos verifican, que es lo que hace útil a la sal.
    expect(await verificar('la-misma-de-siempre', a)).toBe(true)
    expect(await verificar('la-misma-de-siempre', b)).toBe(true)
  })

  it('🔴 un `clave` corrupto devuelve false, no una excepción', async () => {
    // El fichero lo edita una persona a mano. Un error de tecleo ahí no puede
    // tumbar el inicio de sesión de todo el mundo con un 500.
    for (const malo of ['', 'sinDosPuntos', ':', 'zz:zz', 'abc:', ':abc', 'abc:def']) {
      await expect(verificar('lo-que-sea', malo)).resolves.toBe(false)
    }
  })
})

describe('revisarAlta', () => {
  it('acepta un alta normal', () => {
    expect(revisarAlta('monitor.ana', 'cuatro-palabras-sueltas')).toBeNull()
  })

  it('rechaza contraseñas cortas y lo dice con el número', () => {
    const motivo = revisarAlta('ana', 'corta')
    expect(motivo).toContain(String(MINIMO_CONTRASENA))
  })

  it('🔴 rechaza la contraseña que contiene el nombre de usuario', () => {
    // Es lo primero que prueba quien adivina, y pasa cualquier regla de forma.
    expect(revisarAlta('ana', 'ana-ana-ana-ana')).not.toBeNull()
    expect(revisarAlta('ana', 'ANA-en-mayusculas')).not.toBeNull()
  })

  it('rechaza nombres que no valen, y dice qué se admite', () => {
    for (const malo of ['', 'ab', 'con espacio', 'Con-Mayúscula', 'ñandú', 'a'.repeat(33)]) {
      expect(revisarAlta(malo, 'una-contrasena-larga')).not.toBeNull()
    }
  })

  it('🔴 devuelve el MOTIVO, no un booleano', () => {
    // Quien da de alta a un monitor con la clase empezando no está para
    // adivinar qué campo falla.
    const motivo = revisarAlta('con espacio', 'una-contrasena-larga')
    expect(typeof motivo).toBe('string')
    expect((motivo ?? '').length).toBeGreaterThan(20)
  })
})

describe('normalizar', () => {
  it('recorta y baja a minúsculas, para que el nombre sea uno solo', () => {
    // Sin esto, «Ana» y «ana » serían dos cuentas distintas en el mismo fichero.
    expect(normalizar('  Ana  ')).toBe('ana')
    expect(normalizar('MONITOR.1')).toBe('monitor.1')
  })
})
