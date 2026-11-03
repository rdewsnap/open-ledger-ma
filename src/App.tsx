import { Route, Routes } from 'react-router';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MetaProvider } from './state/meta';
import { FlowView } from './views/FlowView';
import { Placeholder } from './views/Placeholder';
import { ScaleView } from './views/ScaleView';
import { ChangesView } from './views/ChangesView';
import { MethodologyView } from './views/MethodologyView';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-paper focus:px-3 focus:py-1">
        Skip to content
      </a>
      {children}
    </div>
  );
}

function Status({ state }: { state: 'loading' | Error }) {
  return (
    <main className="mx-auto grid min-h-[60dvh] w-full max-w-[1120px] place-items-center px-6 text-center text-ink-2">
      {state === 'loading' ? <p>Loading…</p> : <p>The budget data could not be loaded. Try again in a moment.</p>}
    </main>
  );
}

export function App() {
  return (
    <Shell>
      <MetaProvider fallback={(s) => <Status state={s} />}>
        <Header />
        <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-4 sm:px-6 md:px-12">
          <Routes>
            <Route index element={<FlowView />} />
            <Route path="scale" element={<ScaleView />} />
            <Route path="changes" element={<ChangesView />} />
            <Route path="methodology" element={<MethodologyView />} />
            <Route path="*" element={<Placeholder eyebrow="Not found" title="This page is not in the ledger" dek="Try the Flow view from the navigation above." />} />
          </Routes>
        </main>
      </MetaProvider>
      <Footer />
    </Shell>
  );
}
