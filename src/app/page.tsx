const checklistItems = [
  {
    title: "Artwork quality",
    description:
      "Start with clear imagery that looks good on screen; we will introduce print DPI checks in a later milestone."
  },
  {
    title: "Book text limit",
    description:
      "Large spine text is capped at 500 characters so layouts stay legible while we collect feedback."
  },
  {
    title: "Guided tour",
    description:
      "A first-time helper overlay is planned after the prototype becomes interactive."
  },
  {
    title: "Shopify integration",
    description:
      "Payment and fulfillment hooks will come after the core designer experience feels solid."
  }
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-white/60 px-6 pb-16 pt-20">
      <section className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1 text-sm font-medium text-brand">
          Prototype Phase
        </span>
        <h1 className="mt-6 text-4xl font-semibold text-slate-900">
          Flyleaf customer designer scaffold
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          This Next.js foundation gives us routing, styling, and type safety so we can begin
          implementing the interactive spine designer. The page outlines the early decisions that
          unblock engineering while highlighting upcoming tasks like DPI validation and the guided tour.
        </p>
      </section>

      <section className="mt-10 grid w-full max-w-4xl gap-6 md:grid-cols-2">
        {checklistItems.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-base text-slate-600">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 w-full max-w-4xl rounded-3xl bg-slate-900 px-10 py-8 text-slate-100">
        <h2 className="text-2xl font-semibold">What comes next?</h2>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-200">
          We will add the interactive canvas, geometry utilities, and validation rules described in the
          planning docs. This prototype intentionally keeps data local and leaves room for future API
          work, Shopify integration, and PDF generation. With the scaffold ready, we can now focus on
          modeling book stacks and rendering the live preview experience.
        </p>
      </section>
    </main>
  );
}
