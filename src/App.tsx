import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MetaProvider } from './state/meta';
import { FlowView } from './views/FlowView';
import { Placeholder } from './views/Placeholder';

// Flow is the landing view and ships in the main bundle; the others load on demand.
const ScaleView = lazy(() => import('./views/ScaleView'));
const ChangesView = lazy(() => import('./views/ChangesView'));
// react-markdown and METHODOLOGY.md are only needed on this route.
const MethodologyPage = lazy(() => import('./components/methodology/MethodologyPage'));
const SourceView = lazy(() => import('./views/SourceView'));
const TownView = lazy(() => import('./views/TownView'));

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[6px] focus:bg-paper focus:px-3 focus:py-1">
        Skip to content
      </a>
      {children}
    </div>
  );
}

function Status({ state }: { state: 'loading' | Error }) {
  return (
    <main className="mx-auto grid min-h-[100svh] w-full max-w-[1120px] place-items-center px-6 text-center text-ink-2">
      {state === 'loading' ? <p>Loading…</p> : <p>The budget data could not be loaded. Try again in a moment.</p>}
    </main>
  );
}

/** Holds the page open (no footer jump) while a route chunk loads. */
function RouteFallback({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <section className="min-h-[100svh] py-8 md:py-12">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 max-w-[24ch]">{title}</h1>
    </section>
  );
}

function Lazy({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
  return <Suspense fallback={<RouteFallback eyebrow={eyebrow} title={title} />}>{children}</Suspense>;
}

export function App() {
  return (
    <Shell>
      <MetaProvider fallback={(s) => <Status state={s} />}>
        <Header />
        <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-4 sm:px-6 md:px-12">
          <Routes>
            <Route index element={<FlowView />} />
            <Route
              path="scale"
              element={
                <Lazy eyebrow="Scale" title="Every program, drawn to scale">
                  <ScaleView />
                </Lazy>
              }
            />
            <Route
              path="changes"
              element={
                <Lazy eyebrow="Changes" title="What changed, program by program">
                  <ChangesView />
                </Lazy>
              }
            />
            <Route
              path="town"
              element={
                <Lazy eyebrow="Your town" title="What the state sends your city or town">
                  <TownView />
                </Lazy>
              }
            />
            <Route
              path="methodology"
              element={
                <Lazy eyebrow="Methodology" title="Where every number comes from">
                  <MethodologyPage />
                </Lazy>
              }
            />
            <Route
              path="source"
              element={
                <Lazy eyebrow="Source rows" title="The state's rows behind a number">
                  <SourceView />
                </Lazy>
              }
            />
            <Route path="*" element={<Placeholder eyebrow="Not found" title="This page is not in the ledger" dek="Try the Flow view from the navigation above." />} />
          </Routes>
        </main>
      </MetaProvider>
      <Footer />
    </Shell>
  );
}
