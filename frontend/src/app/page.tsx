/**
 * LA PUERTA DE ENTRADA.
 *
 * 🔴 Antes esta ruta renderizaba `Dashboard` de `src/components/`, que son 1134
 *    lineas de MAQUETA con datos inventados: cero `fetch`, cero `WebSocket`, y
 *    un estado de robot fabricado. O sea que lo PRIMERO que veia cualquiera al
 *    abrir la aplicacion era la peor familia de fallos de este proyecto —una
 *    pantalla que parece sana sin haber hablado con nada— en la portada.
 *
 * → Esta pagina no inventa nada: solo enumera lo que existe y **dice lo que no
 *   funciona todavia**. No abre ninguna conexion: las conexiones viven bajo
 *   `/robot/[id]` y `/flota`, atadas a su ruta para que se cierren al salir.
 *
 * 📌 Las maquetas NO se han borrado: su destino esta sin decidir (duda A3 del
 *    plan). Al dejar de importarlas aqui quedan sin referenciar, que es
 *    justamente lo que hace la decision barata en los dos sentidos.
 */

import Link from 'next/link'
import { ROBOTS, TOTAL_ROBOTS } from '@/lib/interfaz/identidad'

export default function Portada() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Laboratorio Atriz</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {TOTAL_ROBOTS} robots Sphero RVR, cada uno con su Raspberry Pi y su LIDAR. Esta
          aplicación habla con ellos por rosbridge, un WebSocket por robot.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Para el profesor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Los {TOTAL_ROBOTS} de un vistazo: batería en voltios y estado de motores. Solo se suscribe
          a los dos topics baratos, así que cuesta unos 7,7 kB/s en total.
        </p>
        <Link
          href="/flota"
          className="mt-3 inline-block rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Ver el muro de flota →
        </Link>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Un robot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Abre <strong>una</strong> conexión con ese robot, y la cierra al salir. Cada uno se busca
          por su nombre <code>rvr-NN.local</code>; también vale escribir una IP en la URL.
        </p>
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ROBOTS.map((n) => (
            <li key={n}>
              <Link
                href={`/robot/${n}`}
                className="block rounded-md border border-border py-2 text-center text-sm hover:bg-accent"
              >
                {String(n).padStart(2, '0')}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/*
        🔴 Este bloque es el que impide que esta portada se convierta en otra
           maqueta optimista. Si algo se desbloquea, se quita de aqui — y si
           algo se rompe, se añade.
      */}
      <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
        <h2 className="text-base font-semibold">Lo que todavía no funciona</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>El terminal</strong> —escribir y ejecutar código en el robot desde aquí— no
            existe. Va por otro canal, un agente de sesión que aún no está escrito, y ese diseño
            depende de medir primero el punto de acceso del aula.
          </li>
          <li>
            <strong>No hay autenticación.</strong> rosbridge no la trae, así que cualquiera en la
            misma red puede hablar con cualquier robot. Es un taller presencial y está asumido, pero
            no se disimula con un inicio de sesión que no protegería nada.
          </li>
          <li>
            <strong>Nada de esta aplicación confirma un efecto físico.</strong> Cuando mandas una
            orden, la interfaz dice que se envió — nunca que el robot la haya cumplido, porque
            ningún servicio del robot devuelve esa información.
          </li>
        </ul>
      </section>
    </main>
  )
}
