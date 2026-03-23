export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const wrapperClass = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
  const orbitClass = size === 'sm' ? 'h-5 w-5 border-[1.5px]' : size === 'lg' ? 'h-12 w-12 border-[2.5px]' : 'h-8 w-8 border-2';
  const coreClass = size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2';

  return (
    <span className={`loading-orb ${wrapperClass}`} aria-hidden="true">
      <span className={`loading-orb__ring ${orbitClass}`} />
      <span className={`loading-orb__ring loading-orb__ring--delayed ${orbitClass}`} />
      <span className={`loading-orb__core ${coreClass}`} />
    </span>
  );
}

export function PageLoading({
  message = 'Loading your workspace',
  description = 'Preparing data, layout, and the latest updates.',
}: {
  message?: string;
  description?: string;
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-lg text-center overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.32),transparent_38%),radial-gradient(circle_at_bottom,rgba(34,197,94,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.08),transparent_36%),radial-gradient(circle_at_bottom,rgba(34,197,94,0.1),transparent_28%)]" />
        <div className="relative flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-5 text-lg font-semibold text-gray-900 dark:text-slate-50">{message}</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-slate-400">{description}</p>
          <div className="mt-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-gray-400 dark:text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:240ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
