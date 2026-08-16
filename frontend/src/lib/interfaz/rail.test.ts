/**
 * LA NAVEGACIÓN, COMPROBADA COMO DATOS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTE FICHERO EXISTE: EL RAIL SALIO CON «PORTADA» DOS VECES
 * ═══════════════════════════════════════════════════════════════════════════
 * Al mover la portada al primer puesto, el cambio la AÑADIO arriba y no borro la
 * de abajo. El menu quedo con el mismo destino repetido, arriba y al final.
 *
 * Y no lo vio nada: el HTML era correcto, `tsc` limpio, `eslint` limpio y las
 * 410 pruebas en verde. Se vio en la primera captura despues del cambio — o sea
 * por casualidad, porque esa captura se tomo para mirar OTRA cosa.
 *
 * Un menu que repite un destino es de lo primero que ve alguien a quien le
 * enseñas la aplicacion, asi que merece una guardia y no un ojo atento.
 *
 * ⚠️ Vive en `lib/` y no al lado del componente porque `vitest.config.ts` solo
 *    recoge `src/lib/**` y `src/hooks/**`. Importar el `.tsx` desde aqui ya esta
 *    previsto en esa configuracion: su comentario explica que el transformador
 *    lleva `jsx` puesto justo para que una prueba pueda pedirle una funcion pura
 *    a un componente.
 */

import { describe, expect, it } from 'vitest'
// ⚠️ Ruta RELATIVA: `vitest.config.ts` no declara el alias `@/`, que solo existe
//    en el `tsconfig` que usa Next. Con `@/` la prueba ni siquiera carga.
import { GENERALES, entradaDeRuta, pestanasDeRobot } from '../../componentes/comun/RailNavegacion'

describe('el raíl', () => {
  it('🔴 no repite ningún destino', () => {
    const hrefs = GENERALES.map((e) => e.href)
    expect(new Set(hrefs).size, `destinos repetidos en el raíl: ${hrefs.join(' · ')}`)
      .toBe(hrefs.length)
  })

  it('🔴 tampoco entre las pestañas de un robot', () => {
    const hrefs = pestanasDeRobot('1').map((e) => e.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('🔴 y una pestaña de robot no puede chocar con un destino general', () => {
    // Si chocaran, `entradaDeRuta` devolveria una de las dos segun la rama que
    // tomase, y el rotulo y el tono de la cabecera dependerian de un detalle de
    // implementacion en vez de de la ruta.
    const generales = new Set(GENERALES.map((e) => e.href))
    for (const p of pestanasDeRobot('1')) {
      expect(generales.has(p.href), `«${p.href}» esta en los dos sitios`).toBe(false)
    }
  })

  it('🔴 cada entrada tiene rótulo y tono, y el tono es una variable CSS', () => {
    // Un `color` que no sea el nombre de una variable produce `rgb(var(azul))`,
    // que es invalido: el navegador lo ignora y la entrada sale sin tono, sin
    // error y sin aviso.
    for (const e of [...GENERALES, ...pestanasDeRobot('1')]) {
      expect(e.texto.length, `«${e.href}» sin rótulo`).toBeGreaterThan(0)
      expect(e.color, `«${e.href}» con un tono que no es variable`).toMatch(/^--seccion-/)
    }
  })

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 EL RAÍL NO PUEDE OFRECER LA PORTADA, Y ESTA PRUEBA DECÍA LO CONTRARIO
   * ═══════════════════════════════════════════════════════════════════════════
   * Exigía `GENERALES[0].href === '/'`, con el argumento de que «la puerta de
   * entrada no puede estar por debajo de los sitios a los que se llega desde
   * ella». Correcto mientras la portada fuera un destino para quien ya está
   * dentro. **No lo es.**
   *
   * 👤 Lo destapó el usuario el 2026-08-16: al pulsar «Inicio» perdía el raíl
   *    —la portada vive en `(publico)`, que no monta `Armazon`— y desde allí lo
   *    único que había era un «Entrar» que tampoco llevaba a ningún sitio.
   *
   * Este raíl SOLO se ve con sesión, y desde hoy la portada REDIRIGE al resumen
   * cuando hay sesión. Ofrecerla aquí sería un destino de menú que en silencio
   * te lleva a otro — peor que no tenerlo.
   *
   * La prueba se INVIERTE en vez de borrarse: sin ella, alguien vuelve a añadir
   * «Inicio» dentro de seis meses y nada se pone rojo.
   */
  it('🔴 el raíl NO ofrece la portada: con sesión, esa pantalla redirige', () => {
    const hrefs = GENERALES.map((e) => e.href)
    expect(hrefs, `el raíl ofrece «/»: ${hrefs.join(' · ')}`).not.toContain('/')
    // Control de tamaño: si `GENERALES` se vaciara, el `not.toContain` pasaría
    // solo. Cero entradas se leen igual que cero fallos.
    expect(hrefs.length).toBeGreaterThanOrEqual(2)
  })

  describe('entradaDeRuta', () => {
    it('encuentra la pestaña de un robot y la general', () => {
      expect(entradaDeRuta('/robot/1/lidar')?.texto).toBe('LIDAR')
      expect(entradaDeRuta('/flota')?.texto).toBe('Flota')
    })

    it('🔴 devuelve null fuera de las rutas conocidas, sin inventar tono', () => {
      // El marco pinta su campo de color con lo que devuelva esto. Un tono
      // inventado seria una identidad falsa para una pantalla que no existe.
      expect(entradaDeRuta('/robot/1/pestaña-que-no-existe')).toBeNull()
      expect(entradaDeRuta('/vete-a-saber')).toBeNull()
      expect(entradaDeRuta(null)).toBeNull()
    })

    it('🔴 el segmento del robot NO se valida aquí, y es correcto', () => {
      // Quien decide si un segmento nombra un robot es `interpretarIdRobot`, y
      // la ruta responde 404 antes de llegar a pintarse. Duplicar esa regla aqui
      // seria tener dos sitios donde cambiarla.
      expect(entradaDeRuta('/robot/999/lidar')?.texto).toBe('LIDAR')
    })
  })
})
