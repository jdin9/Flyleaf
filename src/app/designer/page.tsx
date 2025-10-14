"use client";

import { useMemo, useState } from "react";

type BookFormState = {
  id: number;
  label: string;
  heightCm: number;
  spineWidthCm: number;
  color: string;
};

type BookRect = {
  id: number;
  label: string;
  widthMm: number;
  heightMm: number;
  xMm: number;
  yMm: number;
  color: string;
};

type StackMetrics = {
  totalWidthMm: number;
  maxHeightMm: number;
  requiredWidthMm: number;
  requiredHeightMm: number;
  collectionWidthCm: number;
  fitsOnTabloid: boolean;
};

type StackLayout = {
  metrics: StackMetrics;
  rects: BookRect[];
};

const CM_TO_MM = 10;
const GAP_MM = 2;
const CLEARANCE_SIDE_MM = 20;
const CLEARANCE_TOP_MM = 2;
const CLEARANCE_BOTTOM_MM = 2;
const TABLOID_WIDTH_MM = 17 * 25.4;
const TABLOID_HEIGHT_MM = 11 * 25.4;
const PREVIEW_SCALE = 2.4; // pixels per millimetre for the preview canvas.

const DEFAULT_BOOKS: BookFormState[] = [
  { id: 1, label: "Book 1", heightCm: 23.5, spineWidthCm: 4.25, color: "#2563eb" },
  { id: 2, label: "Book 2", heightCm: 23.5, spineWidthCm: 4, color: "#10b981" },
  { id: 3, label: "Book 3", heightCm: 23.5, spineWidthCm: 4.75, color: "#f97316" },
  { id: 4, label: "Book 4", heightCm: 23.5, spineWidthCm: 2.25, color: "#6366f1" },
];

/**
 * Converts a numeric value in centimetres to millimetres so geometry rules can share a consistent unit.
 */
function cmToMm(valueCm: number): number {
  return valueCm * CM_TO_MM;
}

/**
 * Calculates stack metrics and per-book rectangles for the preview canvas while enforcing gap and clearance rules.
 */
function computeStackLayout(books: BookFormState[]): StackLayout {
  const heightsMm = books.map((book) => cmToMm(book.heightCm));
  const widthsMm = books.map((book) => cmToMm(book.spineWidthCm));
  const maxHeightMm = heightsMm.length ? Math.max(...heightsMm) : 0;
  const totalWidthMm = widthsMm.reduce((acc, width, index) => {
    const gap = index === 0 ? 0 : GAP_MM;
    return acc + width + gap;
  }, 0);

  const rects: BookRect[] = [];
  let cursorMm = CLEARANCE_SIDE_MM;
  books.forEach((book, index) => {
    const widthMm = cmToMm(book.spineWidthCm);
    const heightMm = cmToMm(book.heightCm);
    if (index > 0) {
      cursorMm += GAP_MM;
    }
    const xMm = cursorMm;
    const yMm = CLEARANCE_TOP_MM + (maxHeightMm - heightMm);
    rects.push({
      id: book.id,
      label: book.label,
      widthMm,
      heightMm,
      xMm,
      yMm,
      color: book.color,
    });
    cursorMm += widthMm;
  });

  const requiredWidthMm = totalWidthMm + CLEARANCE_SIDE_MM * 2;
  const requiredHeightMm = maxHeightMm + CLEARANCE_TOP_MM + CLEARANCE_BOTTOM_MM;
  const fitsOnTabloid = requiredWidthMm <= TABLOID_WIDTH_MM && requiredHeightMm <= TABLOID_HEIGHT_MM;

  return {
    metrics: {
      totalWidthMm,
      maxHeightMm,
      requiredWidthMm,
      requiredHeightMm,
      collectionWidthCm: totalWidthMm / CM_TO_MM,
      fitsOnTabloid,
    },
    rects,
  };
}

function formatMillimetres(valueMm: number): string {
  return `${(valueMm / CM_TO_MM).toFixed(1)} cm`;
}

function formatClearanceSummary(metrics: StackMetrics): string {
  const widthCm = (metrics.requiredWidthMm / CM_TO_MM).toFixed(2);
  const heightCm = (metrics.requiredHeightMm / CM_TO_MM).toFixed(2);
  return `${widthCm} cm × ${heightCm} cm required including clearances`;
}

export default function DesignerPage() {
  const [books, setBooks] = useState<BookFormState[]>(DEFAULT_BOOKS);
  const [nextId, setNextId] = useState<number>(DEFAULT_BOOKS.length + 1);
  const [artOffsetMm, setArtOffsetMm] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [artZoom, setArtZoom] = useState<number>(1);
  const layout = useMemo(() => computeStackLayout(books), [books]);

  const handleUpdateBook = (id: number, key: keyof BookFormState, value: string) => {
    setBooks((current) =>
      current.map((book) =>
        book.id === id
          ? {
              ...book,
              [key]: key === "label" || key === "color" ? value : Number(value),
            }
          : book,
      ),
    );
  };

  const handleAddBook = () => {
    setBooks((current) => [
      ...current,
      {
        id: nextId,
        label: `Book ${nextId}`,
        heightCm: current[current.length - 1]?.heightCm ?? 22,
        spineWidthCm: 3.5,
        color: "#0ea5e9",
      },
    ]);
    setNextId((value) => value + 1);
  };

  const handleRemoveBook = (id: number) => {
    setBooks((current) => (current.length > 1 ? current.filter((book) => book.id !== id) : current));
  };

  const artTransform = {
    transform: `translate(${artOffsetMm.x * PREVIEW_SCALE}px, ${artOffsetMm.y * PREVIEW_SCALE}px) scale(${artZoom})`,
    transformOrigin: "center",
  } as const;

  return (
    <main className="flex min-h-screen flex-col gap-12 bg-slate-50 px-6 pb-20 pt-16">
      <header className="mx-auto w-full max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Design workspace</p>
        <h1 className="mt-2 text-4xl font-semibold text-slate-900">Interactive spine designer prototype</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-600">
          Configure book spines, preview clearances, and test artwork positioning. Geometry stays local for
          now so we can iterate quickly before wiring server persistence or PDF export.
        </p>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Book stack</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter heights and spine widths in centimetres. We keep a fixed 2&nbsp;mm gap between each
              spine to match production rules.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {books.map((book) => (
              <div key={book.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <input
                    className="w-1/2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    value={book.label}
                    onChange={(event) => handleUpdateBook(book.id, "label", event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveBook(book.id)}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    disabled={books.length === 1}
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Height</span>
                    <input
                      type="number"
                      min={10}
                      max={26}
                      step={0.1}
                      value={book.heightCm}
                      onChange={(event) => handleUpdateBook(book.id, "heightCm", event.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Spine width</span>
                    <input
                      type="number"
                      min={0.3}
                      step={0.05}
                      value={book.spineWidthCm}
                      onChange={(event) => handleUpdateBook(book.id, "spineWidthCm", event.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Colour swatch</span>
                    <input
                      type="color"
                      value={book.color}
                      onChange={(event) => handleUpdateBook(book.id, "color", event.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-300"
                      aria-label={`${book.label} colour`}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddBook}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
          >
            Add another book
          </button>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Collection width:</span> {layout.metrics.collectionWidthCm.toFixed(2)} cm
            </p>
            <p className="mt-1">Gap between books: 2 mm (fixed)</p>
            <p className="mt-1">Top clearance: 2 mm • Bottom clearance: 2 mm • Side clearance: 20 mm</p>
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Artwork alignment</h2>
                <p className="text-sm text-slate-500">Adjust offsets to keep the design centred within safety margins.</p>
              </div>
              <div className="flex gap-3 text-xs text-slate-600">
                <div className="rounded-lg bg-slate-100 px-3 py-2">
                  <p className="font-semibold text-slate-900">{formatClearanceSummary(layout.metrics)}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide">
                    {layout.metrics.fitsOnTabloid ? "Fits 11×17 in sheet" : "Exceeds 11×17 in sheet"}
                  </p>
                </div>
              </div>
            </header>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horizontal offset (mm)</span>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={1}
                  value={artOffsetMm.x}
                  onChange={(event) => setArtOffsetMm((prev) => ({ ...prev, x: Number(event.target.value) }))}
                />
                <span className="text-xs text-slate-500">{artOffsetMm.x} mm</span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vertical offset (mm)</span>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={1}
                  value={artOffsetMm.y}
                  onChange={(event) => setArtOffsetMm((prev) => ({ ...prev, y: Number(event.target.value) }))}
                />
                <span className="text-xs text-slate-500">{artOffsetMm.y} mm</span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zoom</span>
                <input
                  type="range"
                  min={0.85}
                  max={1.25}
                  step={0.01}
                  value={artZoom}
                  onChange={(event) => setArtZoom(Number(event.target.value))}
                />
                <span className="text-xs text-slate-500">{(artZoom * 100).toFixed(0)}%</span>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Live preview</h2>
              <p className="text-xs uppercase tracking-wide text-slate-500">Scaled mockup • watermark for sample only</p>
            </div>

            <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
              <div
                className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-50"
                style={{
                  width: layout.metrics.requiredWidthMm * PREVIEW_SCALE,
                  height: layout.metrics.requiredHeightMm * PREVIEW_SCALE,
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 20%, rgba(14,165,233,0.3), rgba(37,99,235,0.6)), linear-gradient(135deg, rgba(99,102,241,0.25), rgba(14,165,233,0.25))",
                    backgroundSize: `${180 * artZoom}px`,
                    opacity: 0.85,
                    ...artTransform,
                  }}
                />

                <div
                  className="pointer-events-none absolute h-0 border-t-2 border-green-400"
                  style={{
                    left: CLEARANCE_SIDE_MM * PREVIEW_SCALE,
                    right: CLEARANCE_SIDE_MM * PREVIEW_SCALE,
                    top: CLEARANCE_TOP_MM * PREVIEW_SCALE,
                  }}
                />
                <div
                  className="pointer-events-none absolute h-0 border-t-2 border-green-400"
                  style={{
                    left: CLEARANCE_SIDE_MM * PREVIEW_SCALE,
                    right: CLEARANCE_SIDE_MM * PREVIEW_SCALE,
                    top: (CLEARANCE_TOP_MM + layout.metrics.maxHeightMm) * PREVIEW_SCALE,
                  }}
                />

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black tracking-[1em] text-slate-800/10">
                  SAMPLE
                </div>

                {layout.rects.map((rect) => (
                  <div
                    key={rect.id}
                    className="absolute rounded-md border border-slate-900/20 shadow-sm"
                    style={{
                      width: rect.widthMm * PREVIEW_SCALE,
                      height: rect.heightMm * PREVIEW_SCALE,
                      transform: `translate(${rect.xMm * PREVIEW_SCALE}px, ${rect.yMm * PREVIEW_SCALE}px)`,
                      backgroundColor: rect.color,
                    }}
                  >
                    <div className="pointer-events-none absolute bottom-2 left-1/2 w-[90%] -translate-x-1/2 rounded bg-white/80 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      {rect.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Total width (spines)</dt>
                <dd className="font-medium text-slate-900">{formatMillimetres(layout.metrics.totalWidthMm)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Tallest book</dt>
                <dd className="font-medium text-slate-900">{formatMillimetres(layout.metrics.maxHeightMm)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">11×17 in check</dt>
                <dd className="font-medium text-slate-900">
                  {layout.metrics.fitsOnTabloid ? "Within bounds" : "Needs larger sheet"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </section>
    </main>
  );
}
