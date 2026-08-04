import { ReactNode } from 'react'

/**
 * El PORQUÉ de una medida, plegado. Abierto de un clic, cerrado por defecto.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA DISTINCIÓN QUE HAY QUE ACERTAR, PORQUE HAY UNA REGLA EN MEDIO
 * ═══════════════════════════════════════════════════════════════════════════
 * `CLAUDE.md` prohíbe esconder tras un desplegable **las causas de `SIN_DATOS` y
 * los motivos de una baldosa**, porque «el motivo ES la acción»: tapar por qué
 * algo está en ámbar deja el ámbar sin nada que hacer con él.
 *
 * Esto **no es eso**. Aquí va el contexto de fondo — cómo se midió, qué
 * significa un valor crudo, qué trampa tiene el sensor —, que es cierto siempre
 * y no cambia con el estado del robot.
 *
 * La prueba para saber en cuál estás: **¿el texto cambia según lo que hace el
 * robot ahora mismo?**
 *   · Sí  → es estado. Va en línea, siempre visible. NO se pliega.
 *   · No  → es contexto. Va aquí.
 *
 * Ejemplos de los dos, sacados de esta misma aplicación:
 *   estado   «no se sabe la batería: /battery_state no ha traído un voltaje
 *             válido» — depende de lo que llegó, y cambia.
 *   contexto «la deriva del rumbo es ~1000 veces mayor los primeros minutos
 *             tras encender el RVR» — es verdad siempre.
 *
 * ⚠️ Y el motivo para plegarlo no es estético: en la pantalla de telemetría
 *    estas notas sumaban más líneas que los propios datos. Un instrumento con
 *    más prosa que medidas ha dejado de ser un instrumento.
 */
export function Contexto({ children }: { children: ReactNode }) {
  return (
    <details className="group px-3 pb-2">
      <summary
        className="focus-ring inline-flex cursor-pointer list-none items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {/*
          El triángulo gira 90° al abrir: 200 ms con la curva de salida. Es
          «state indication» del marco de Emil —dice si está abierto o cerrado—,
          no decoración, y por eso se gana el movimiento.
        */}
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-90"
        >
          ▸
        </span>
        Por qué
      </summary>
      <div className="max-w-prose space-y-2 pt-1 text-xs text-muted-foreground">{children}</div>
    </details>
  )
}
