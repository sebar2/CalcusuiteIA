import React, { Profiler, Suspense, lazy, useEffect, useState } from 'react';
import type { ProfilerOnRenderCallback, ReactNode } from 'react';

/**
 * Carga diferida del motor 3D: el chunk de Three.js (~1 MB) se descarga y parsea
 * fuera del handler de clic, y solo cuando el usuario abre el Gemelo Digital.
 */
export const LazyUniversalWarehouseTwin3D = lazy(() =>
  import('./UniversalWarehouseTwin3D').then((m) => ({ default: m.UniversalWarehouseTwin3D }))
);

const SLOW_COMMIT_MS = 50;

/** Registra en consola (solo en desarrollo) los commits de React que superan 50 ms. */
const logSlowCommit: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  if (actualDuration > SLOW_COMMIT_MS) {
    console.info(`[Perf] ${id} (${phase}) tardó ${actualDuration.toFixed(1)} ms`);
  }
};

export const DevRenderProfiler: React.FC<{ id: string; children: ReactNode }> = ({ id, children }) =>
  import.meta.env.DEV ? (
    <Profiler id={id} onRender={logSlowCommit}>
      {children}
    </Profiler>
  ) : (
    <>{children}</>
  );

/**
 * Keep-alive: monta el contenido la primera vez que se activa y luego lo conserva
 * oculto en lugar de destruirlo. Evita recrear el contexto WebGL, recompilar shaders
 * y re-ejecutar los fetch iniciales en cada cambio de pestaña.
 */
export const KeepAlive: React.FC<{
  active: boolean;
  className?: string;
  children: ReactNode;
}> = ({ active, className = '', children }) => {
  const [hasBeenActive, setHasBeenActive] = useState(active);

  useEffect(() => {
    if (active) setHasBeenActive(true);
  }, [active]);

  if (!hasBeenActive) return null;

  return (
    <div className={active ? className : 'hidden'} aria-hidden={!active}>
      <Suspense
        fallback={
          <div className="flex h-[480px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-400">
            Cargando Gemelo Digital 3D…
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
};
