import { describe, expect, it, vi } from 'vitest'
import { proveedorDeTestigo } from './proveedor_testigo'

const respuesta = (cuerpo: unknown, ok = true) =>
  ({ ok, json: async () => cuerpo }) as unknown as Response

describe('de donde saca el transporte el testigo', () => {
  describe('🔴 el interruptor, que es lo que decide el despliegue', () => {
    it('APAGADO: no hay proveedor, y el transporte abre como siempre', () => {
      // 🔴 Esto NO es un detalle: mandar el testigo a un robot sin parchear lo
      //    deja inalcanzable (1006 en bucle en el navegador, colgado en Node).
      expect(proveedorDeTestigo(1, false)).toBeUndefined()
    })

    it('ENCENDIDO: hay proveedor', () => {
      expect(proveedorDeTestigo(1, true)).toBeInstanceOf(Function)
    })

    it('🔴 `undefined` y «devuelve null» NO son lo mismo', async () => {
      // undefined = este despliegue no usa testigo.
      // () => null  = lo usa, y hoy no se ha podido conseguir.
      // Confundirlos haria que un fallo de sesion se viera como «aqui no hace
      // falta credencial», que es lo contrario de lo que pasa.
      expect(proveedorDeTestigo('192.168.1.200', false)).toBeUndefined()
      const p = proveedorDeTestigo('192.168.1.200', true)
      expect(p).toBeInstanceOf(Function)
      await expect(p!()).resolves.toBeNull()
    })
  })

  describe('a quien se le pide', () => {
    it('pide el testigo del robot que toca', async () => {
      const traer = vi.fn(async () => respuesta({ testigo: 'eyJ.abc.def' }))
      const p = proveedorDeTestigo(7, true, traer as unknown as typeof fetch)!
      await expect(p()).resolves.toBe('eyJ.abc.def')
      expect(traer).toHaveBeenCalledWith('/api/sesion/testigo?robot=7', { cache: 'no-store' })
    })

    it('🔴 sin cachear: un testigo cacheado se reutiliza caducado', async () => {
      // Se comprueba con `toHaveBeenCalledWith` y no indexando `mock.calls`:
      // indexar obliga a declarar el espia con parametros, y entonces eslint se
      // queja de que no se usan. La asercion es la misma.
      const traer = vi.fn(async () => respuesta({ testigo: 'x' }))
      await proveedorDeTestigo(1, true, traer as unknown as typeof fetch)!()
      expect(traer).toHaveBeenCalledWith('/api/sesion/testigo?robot=1', { cache: 'no-store' })
    })

    it('un robot por IP NO se pide: no hay numero que el robot pueda comparar', async () => {
      const traer = vi.fn(async () => respuesta({ testigo: 'x' }))
      const p = proveedorDeTestigo('10.14.7.7', true, traer as unknown as typeof fetch)!
      await expect(p()).resolves.toBeNull()
      expect(traer).not.toHaveBeenCalled()
    })

    it.each([0, 17, -1, 1.5, NaN])('%s no es un robot valido: no se pide nada', async (n) => {
      const traer = vi.fn(async () => respuesta({ testigo: 'x' }))
      const p = proveedorDeTestigo(n, true, traer as unknown as typeof fetch)!
      await expect(p()).resolves.toBeNull()
      expect(traer).not.toHaveBeenCalled()
    })

    it('✅ EL CONTROL: 1 y 16 SI son validos', async () => {
      // Sin esto, «rechaza los invalidos» pasaria con un proveedor que
      // rechazara todo.
      const traer = vi.fn(async () => respuesta({ testigo: 'x' }))
      for (const n of [1, 16]) {
        await expect(proveedorDeTestigo(n, true, traer as unknown as typeof fetch)!()).resolves.toBe('x')
      }
      expect(traer).toHaveBeenCalledTimes(2)
    })
  })

  describe('cuando el servidor no da testigo', () => {
    it('un 401 devuelve null, no lanza', async () => {
      // Lanzar dejaria el fallo en el `catch` del transporte con un mensaje de
      // excepcion; devolver null deja que diga lo suyo, que es mas util.
      const traer = vi.fn(async () => respuesta({ error: 'sin sesión' }, false))
      const p = proveedorDeTestigo(3, true, traer as unknown as typeof fetch)!
      await expect(p()).resolves.toBeNull()
    })

    it('un cuerpo sin `testigo` devuelve null', async () => {
      const traer = vi.fn(async () => respuesta({ otra: 'cosa' }))
      const p = proveedorDeTestigo(3, true, traer as unknown as typeof fetch)!
      await expect(p()).resolves.toBeNull()
    })

    it('🔴 y un `testigo` que no es cadena tampoco cuela', async () => {
      const traer = vi.fn(async () => respuesta({ testigo: 42 }))
      const p = proveedorDeTestigo(3, true, traer as unknown as typeof fetch)!
      await expect(p()).resolves.toBeNull()
    })
  })
})
