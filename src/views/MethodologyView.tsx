import { lazy, Suspense } from 'react';

// The markdown renderer and METHODOLOGY.md are only needed on this route; keep them out of the main bundle.
const MethodologyPage = lazy(() => import('../components/methodology/MethodologyPage'));

export function MethodologyView() {
  return (
    <Suspense
      fallback={
        <section className="min-h-[100svh] py-8 md:py-12">
          <p className="eyebrow">Methodology</p>
          <h1 className="mt-2 text-[2rem] md:text-[2.6rem]">Where every number comes from</h1>
        </section>
      }
    >
      <MethodologyPage />
    </Suspense>
  );
}
