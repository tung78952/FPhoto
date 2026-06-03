function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">FPhoto</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Photo Filter Workspace</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Filter image files by code, collect the matches, and copy them safely for client delivery.
            </p>
          </div>
          <div className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm text-cyan-200">
            Phase 1
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-cyan-950/20">
            <h2 className="text-lg font-medium">Workflow</h2>
            <ol className="mt-5 space-y-4 text-sm text-slate-300">
              <li className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-100">1. Choose photo folder</li>
              <li className="rounded-2xl bg-slate-800/70 p-4">2. Enter image codes</li>
              <li className="rounded-2xl bg-slate-800/70 p-4">3. Review matched files</li>
              <li className="rounded-2xl bg-slate-800/70 p-4">4. Copy safely</li>
            </ol>
          </aside>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/40">
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
              <p className="text-2xl font-semibold">Foundation is ready.</p>
              <p className="mt-3 text-slate-400">
                Next phase will connect Electron IPC for folder picking and file scanning.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
