"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const PDF_RENDER_SCALE = 5; // pixels per millimetre for high-res PDF previews.

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
  minHeightMm: number;
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
const CLEARANCE_SIDE_MM = 10;
const CLEARANCE_TOP_MM = 2;
const CLEARANCE_BOTTOM_MM = 2;
const ART_SAFE_MARGIN_SIDE_MM = 10;
const ART_SAFE_MARGIN_VERTICAL_MM = 2;
const TABLOID_WIDTH_MM = 17 * 25.4;
const TABLOID_HEIGHT_MM = 11 * 25.4;
const PREVIEW_SCALE = 2; // pixels per millimetre for the preview canvas.
const DEFAULT_ARTWORK_SRC = "/desert-sunrise-plateau.svg";

const DEFAULT_BOOKS: BookFormState[] = [
  { id: 1, label: "Book 1", heightCm: 23.5, spineWidthCm: 4.25, color: "#2563eb" },
  { id: 2, label: "Book 2", heightCm: 23.5, spineWidthCm: 4, color: "#10b981" },
  { id: 3, label: "Book 3", heightCm: 23.5, spineWidthCm: 4.75, color: "#f97316" },
  { id: 4, label: "Book 4", heightCm: 23.5, spineWidthCm: 2.25, color: "#6366f1" },
];

const FONT_OPTIONS = [
  { label: "Inter", value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', 'Times New Roman', serif" },
  { label: "Crimson Text", value: "'Crimson Text', Georgia, serif" },
  { label: "Montserrat", value: "'Montserrat', 'Helvetica Neue', sans-serif" },
  { label: "Libre Baskerville", value: "'Libre Baskerville', 'Times New Roman', serif" },
] as const;

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
  const minHeightMm = heightsMm.length ? Math.min(...heightsMm) : 0;
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
      minHeightMm,
      requiredWidthMm,
      requiredHeightMm,
      collectionWidthCm: totalWidthMm / CM_TO_MM,
      fitsOnTabloid,
    },
    rects,
  };
}

const DEFAULT_LAYOUT = computeStackLayout(DEFAULT_BOOKS);

function formatMillimetres(valueMm: number): string {
  return `${(valueMm / CM_TO_MM).toFixed(1)} cm`;
}

function formatClearanceSummary(metrics: StackMetrics): string {
  const widthCm = (metrics.requiredWidthMm / CM_TO_MM).toFixed(2);
  const heightCm = (metrics.requiredHeightMm / CM_TO_MM).toFixed(2);
  return `${widthCm} cm × ${heightCm} cm required including clearances`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type ArtworkDimensionsMm = {
  widthMm: number;
  heightMm: number;
};

function computeArtworkBounds(metrics: StackMetrics, artworkDimensions: ArtworkDimensionsMm) {
  const safeWidthMm = metrics.totalWidthMm + ART_SAFE_MARGIN_SIDE_MM * 2;
  const safeHeightMm = metrics.maxHeightMm + ART_SAFE_MARGIN_VERTICAL_MM * 2;
  const fallbackWidthMm = metrics.requiredWidthMm || safeWidthMm;
  const fallbackHeightMm = metrics.requiredHeightMm || safeHeightMm;
  const baseWidthMm = artworkDimensions.widthMm || fallbackWidthMm;
  const baseHeightMm = artworkDimensions.heightMm || fallbackHeightMm;
  const minZoomRaw = Math.max(safeWidthMm / baseWidthMm, safeHeightMm / baseHeightMm);
  const minZoom = Number.isFinite(minZoomRaw) && minZoomRaw > 0 ? minZoomRaw : 1;

  return {
    safeWidthMm,
    safeHeightMm,
    containerWidthMm: metrics.requiredWidthMm,
    containerHeightMm: metrics.requiredHeightMm,
    minZoom,
  } as const;
}

function computeOffsetLimits(
  bounds: ReturnType<typeof computeArtworkBounds>,
  artworkDimensions: ArtworkDimensionsMm,
  zoom: number,
) {
  const baseWidthMm = artworkDimensions.widthMm || bounds.safeWidthMm;
  const baseHeightMm = artworkDimensions.heightMm || bounds.safeHeightMm;
  const artWidthMm = baseWidthMm * zoom;
  const artHeightMm = baseHeightMm * zoom;
  const horizontalRoomMm = Math.max((artWidthMm - bounds.safeWidthMm) / 2, 0);
  const verticalRoomMm = Math.max((artHeightMm - bounds.safeHeightMm) / 2, 0);

  return {
    minX: -horizontalRoomMm,
    maxX: horizontalRoomMm,
    minY: -verticalRoomMm,
    maxY: verticalRoomMm,
  } as const;
}

/**
 * Converts a millimetre measurement to PDF points (1/72 in) for PDF page metadata.
 */
function mmToPoints(valueMm: number): number {
  return (valueMm / 25.4) * 72;
}

/**
 * Converts a millimetre measurement to pixels for the high-resolution PDF rendering canvas.
 */
function mmToPdfPixels(valueMm: number): number {
  return valueMm * PDF_RENDER_SCALE;
}

/**
 * Converts a data URL string to a Uint8Array so it can be embedded into a manually constructed PDF.
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binaryString = typeof window === "undefined" ? "" : window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}

/**
 * Pads a numeric value with leading zeros so it can be written into the PDF cross-reference table.
 */
function padPdfOffset(value: number): string {
  return value.toString().padStart(10, "0");
}

type PdfPageImage = {
  jpegBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
};

/**
 * Builds a minimalist multi-page PDF binary that fills each sheet with the supplied JPEG artwork.
 */
function buildMultiPagePdf(
  pages: PdfPageImage[],
  pageWidthMm: number,
  pageHeightMm: number,
): Blob {
  const textEncoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let currentOffset = 0;

  const write = (value: string | Uint8Array) => {
    const chunk = typeof value === "string" ? textEncoder.encode(value) : value;
    chunks.push(chunk);
    currentOffset += chunk.length;
  };

  const beginObject = (objectNumber: number) => {
    offsets[objectNumber] = currentOffset;
    write(`${objectNumber} 0 obj\n`);
  };

  write("%PDF-1.4\n");

  beginObject(1);
  write("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const mediaBox = `[0 0 ${mmToPoints(pageWidthMm).toFixed(2)} ${mmToPoints(pageHeightMm).toFixed(2)}]`;
  const pageCount = pages.length;
  const basePageObject = 3;

  beginObject(2);
  const kids = Array.from({ length: pageCount }, (_, index) => `${basePageObject + index * 3} 0 R`).join(" ");
  write(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);

  pages.forEach((page, index) => {
    const pageObjectNumber = basePageObject + index * 3;
    const imageObjectNumber = pageObjectNumber + 1;
    const contentObjectNumber = pageObjectNumber + 2;

    beginObject(pageObjectNumber);
    write(
      `<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBox} /Resources << /XObject << /Im0 ${imageObjectNumber} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contentObjectNumber} 0 R >>\nendobj\n`,
    );

    beginObject(imageObjectNumber);
    write(
      `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`,
    );
    write(page.jpegBytes);
    write("\nendstream\nendobj\n");

    const pageWidthPoints = mmToPoints(pageWidthMm).toFixed(2);
    const pageHeightPoints = mmToPoints(pageHeightMm).toFixed(2);
    const contentStream = `q\n${pageWidthPoints} 0 0 ${pageHeightPoints} 0 0 cm\n/Im0 Do\nQ\n`;
    beginObject(contentObjectNumber);
    write(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);
  });

  const totalObjects = 2 + pageCount * 3;
  const startXref = currentOffset;
  write(`xref\n0 ${totalObjects + 1}\n`);
  write("0000000000 65535 f \n");
  for (let index = 1; index <= totalObjects; index += 1) {
    write(`${padPdfOffset(offsets[index] ?? 0)} 00000 n \n`);
  }

  write(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

/**
 * Breaks a block of text into multiple lines that respect manual line breaks and a maximum width.
 */
function wrapTextIntoLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const trimmed = paragraph.trim();
    if (trimmed.length === 0) {
      if (paragraphIndex < paragraphs.length - 1) {
        lines.push("");
      }
      return;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = words.shift() ?? "";
    words.forEach((word) => {
      const testLine = `${currentLine} ${word}`.trim();
      if (context.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    lines.push(currentLine);
  });

  return lines;
}

type PdfRenderOptions = {
  layout: StackLayout;
  artOffsetMm: { x: number; y: number };
  artZoom: number;
  artworkImage: HTMLImageElement;
  artworkDimensionsMm: ArtworkDimensionsMm;
  showLargeText: boolean;
  largeText: string;
  largeTextFont: string;
  largeTextSizePx: number;
};

type PdfRenderResult = {
  pdfBlob: Blob;
  pageImageDataUrls: string[];
};

/**
 * Renders the current mockup state to high-resolution canvases before packing them into a multi-page PDF.
 */
async function renderPdfPreview({
  layout,
  artOffsetMm,
  artZoom,
  artworkImage,
  artworkDimensionsMm,
  showLargeText,
  largeText,
  largeTextFont,
  largeTextSizePx,
}: PdfRenderOptions): Promise<PdfRenderResult> {
  const pageWidthPx = Math.round(mmToPdfPixels(TABLOID_WIDTH_MM));
  const pageHeightPx = Math.round(mmToPdfPixels(TABLOID_HEIGHT_MM));

  const containerLeftMm = (TABLOID_WIDTH_MM - layout.metrics.requiredWidthMm) / 2;
  const containerTopMm = (TABLOID_HEIGHT_MM - layout.metrics.requiredHeightMm) / 2;
  const containerWidthMm = layout.metrics.requiredWidthMm;
  const containerHeightMm = layout.metrics.requiredHeightMm;
  const previewToPdfScale = PDF_RENDER_SCALE / PREVIEW_SCALE;

  const artBaseWidthMm = artworkDimensionsMm.widthMm || containerWidthMm;
  const artBaseHeightMm = artworkDimensionsMm.heightMm || containerHeightMm;
  const artDrawWidthMm = artBaseWidthMm * artZoom;
  const artDrawHeightMm = artBaseHeightMm * artZoom;
  const artCenterXmm = containerLeftMm + containerWidthMm / 2 + artOffsetMm.x;
  const artCenterYmm = containerTopMm + containerHeightMm / 2 + artOffsetMm.y;

  const largeTextAreaLeftMm = containerLeftMm + CLEARANCE_SIDE_MM;
  const largeTextAreaTopMm =
    containerTopMm + CLEARANCE_TOP_MM + (layout.metrics.maxHeightMm - layout.metrics.minHeightMm) / 2;
  const largeTextAreaWidthMm = layout.metrics.totalWidthMm;
  const largeTextAreaHeightMm = layout.metrics.minHeightMm;
  const largeTextCenterXStack = largeTextAreaLeftMm + largeTextAreaWidthMm / 2;
  const largeTextCenterYStack = largeTextAreaTopMm + largeTextAreaHeightMm / 2;

  const pageRenders = layout.rects.map((rect) => {
    const canvas = document.createElement("canvas");
    canvas.width = pageWidthPx;
    canvas.height = pageHeightPx;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to acquire 2D context for PDF preview rendering.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageWidthPx, pageHeightPx);

    const bookCenterXStack = containerLeftMm + rect.xMm + rect.widthMm / 2;
    const bookCenterYStack = containerTopMm + rect.yMm + rect.heightMm / 2;
    const artDeltaX = artCenterXmm - bookCenterXStack;
    const artDeltaY = artCenterYmm - bookCenterYStack;

    const bookLeftMm = TABLOID_WIDTH_MM / 2 - rect.widthMm / 2;
    const bookTopMm = TABLOID_HEIGHT_MM / 2 - rect.heightMm / 2;
    const bookRightMm = bookLeftMm + rect.widthMm;
    const bookBottomMm = bookTopMm + rect.heightMm;

    const artCenterPageX = TABLOID_WIDTH_MM / 2 + artDeltaX;
    const artCenterPageY = TABLOID_HEIGHT_MM / 2 + artDeltaY;
    const artDrawXmm = artCenterPageX - artDrawWidthMm / 2;
    const artDrawYmm = artCenterPageY - artDrawHeightMm / 2;

    const clipLeftMm = Math.max(bookLeftMm, 0);
    const clipTopMm = Math.max(bookTopMm - 2, 0);
    const clipRightMm = Math.min(bookRightMm, TABLOID_WIDTH_MM);
    const clipBottomMm = Math.min(bookBottomMm, TABLOID_HEIGHT_MM);
    const clipWidthMm = Math.max(clipRightMm - clipLeftMm, 0);
    const clipHeightMm = Math.max(clipBottomMm - clipTopMm, 0);

    if (clipWidthMm > 0 && clipHeightMm > 0 && artDrawWidthMm > 0 && artDrawHeightMm > 0) {
      context.save();
      context.beginPath();
      context.rect(
        mmToPdfPixels(clipLeftMm),
        mmToPdfPixels(clipTopMm),
        mmToPdfPixels(clipWidthMm),
        mmToPdfPixels(clipHeightMm),
      );
      context.clip();
      context.drawImage(
        artworkImage,
        mmToPdfPixels(artDrawXmm),
        mmToPdfPixels(artDrawYmm),
        mmToPdfPixels(artDrawWidthMm),
        mmToPdfPixels(artDrawHeightMm),
      );
      context.restore();
    }

    context.save();
    context.translate(pageWidthPx / 2, pageHeightPx / 2);
    context.rotate((-12 * Math.PI) / 180);
    context.globalAlpha = 0.1;
    context.fillStyle = "#0f172a";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${120 * previewToPdfScale}px 'Inter', sans-serif`;
    context.fillText("SAMPLE", 0, 0);
    context.restore();

    if (showLargeText && largeText.trim().length > 0) {
      const largeTextDeltaX = largeTextCenterXStack - bookCenterXStack;
      const largeTextDeltaY = largeTextCenterYStack - bookCenterYStack;
      const largeTextAreaCenterX = TABLOID_WIDTH_MM / 2 + largeTextDeltaX;
      const largeTextAreaCenterY = TABLOID_HEIGHT_MM / 2 + largeTextDeltaY;
      const fontSizePx = largeTextSizePx * previewToPdfScale;
      const maxTextWidthPx = mmToPdfPixels(largeTextAreaWidthMm) * 0.92;

      context.save();
      context.fillStyle = "#f8fafc";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `${fontSizePx}px ${largeTextFont}`;
      context.shadowColor = "rgba(15, 23, 42, 0.35)";
      context.shadowBlur = 8 * previewToPdfScale;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;

      const lines = wrapTextIntoLines(context, largeText.trim(), maxTextWidthPx);
      const lineHeightPx = fontSizePx * 1.1;
      const totalBlockHeightPx = lineHeightPx * lines.length;
      const areaCenterX = mmToPdfPixels(largeTextAreaCenterX);
      const areaCenterY = mmToPdfPixels(largeTextAreaCenterY);

      lines.forEach((line, index) => {
        const lineOffset = index * lineHeightPx - (totalBlockHeightPx - lineHeightPx) / 2;
        context.fillText(line, areaCenterX, areaCenterY + lineOffset);
      });

      context.restore();
    }

    const rectLeftPx = mmToPdfPixels(bookLeftMm);
    const rectTopPx = mmToPdfPixels(bookTopMm);
    const rectWidthPx = mmToPdfPixels(rect.widthMm);
    const rectHeightPx = mmToPdfPixels(rect.heightMm);

    context.save();
    context.lineWidth = Math.max(1, PDF_RENDER_SCALE * 0.4);
    context.strokeStyle = rect.color;
    context.strokeRect(rectLeftPx, rectTopPx, rectWidthPx, rectHeightPx);
    context.restore();

    const labelWidthPx = rectWidthPx * 0.9;
    const labelHeightPx = 14 * previewToPdfScale;
    const labelCenterX = rectLeftPx + rectWidthPx / 2;
    const labelCenterY = rectTopPx + rectHeightPx - labelHeightPx / 2 - 4 * previewToPdfScale;
    context.save();
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.fillRect(labelCenterX - labelWidthPx / 2, labelCenterY - labelHeightPx / 2, labelWidthPx, labelHeightPx);
    context.fillStyle = "rgba(15, 23, 42, 0.75)";
    context.font = `${Math.max(10 * previewToPdfScale, 11 * previewToPdfScale)}px 'Inter', sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(rect.label, labelCenterX, labelCenterY);
    context.restore();

    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
    return {
      canvas,
      jpegDataUrl,
    };
  });

  const pdfBlob = buildMultiPagePdf(
    pageRenders.map((render) => ({
      jpegBytes: dataUrlToUint8Array(render.jpegDataUrl),
      widthPx: render.canvas.width,
      heightPx: render.canvas.height,
    })),
    TABLOID_WIDTH_MM,
    TABLOID_HEIGHT_MM,
  );

  return { pdfBlob, pageImageDataUrls: pageRenders.map((render) => render.jpegDataUrl) };
}

export default function DesignerPage() {
  const [books, setBooks] = useState<BookFormState[]>(DEFAULT_BOOKS);
  const [nextId, setNextId] = useState<number>(DEFAULT_BOOKS.length + 1);
  const [artOffsetMm, setArtOffsetMm] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [artZoom, setArtZoom] = useState<number>(1);
  const [artworkSrc, setArtworkSrc] = useState<string>(DEFAULT_ARTWORK_SRC);
  const uploadedArtworkRef = useRef<string | null>(null);
  const [hasManualZoom, setHasManualZoom] = useState<boolean>(false);
  const [hasManualOffset, setHasManualOffset] = useState<boolean>(false);
  const [showLargeText, setShowLargeText] = useState<boolean>(false);
  const [largeText, setLargeText] = useState<string>("Collection Title");
  const [largeTextFont, setLargeTextFont] = useState<string>(FONT_OPTIONS[0]?.value ?? "sans-serif");
  const [largeTextSizePx, setLargeTextSizePx] = useState<number>(72);
  const [artworkDimensionsMm, setArtworkDimensionsMm] = useState<ArtworkDimensionsMm>({
    widthMm: DEFAULT_LAYOUT.metrics.requiredWidthMm,
    heightMm: DEFAULT_LAYOUT.metrics.requiredHeightMm,
  });
  const [artworkImage, setArtworkImage] = useState<HTMLImageElement | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ pdfUrl: string; pageImages: string[] } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const pdfUrlRef = useRef<string | null>(null);
  const layout = useMemo(() => computeStackLayout(books), [books]);
  const artworkBounds = useMemo(
    () => computeArtworkBounds(layout.metrics, artworkDimensionsMm),
    [layout.metrics, artworkDimensionsMm],
  );
  const offsetLimits = useMemo(
    () => computeOffsetLimits(artworkBounds, artworkDimensionsMm, artZoom),
    [artworkBounds, artworkDimensionsMm, artZoom],
  );
  const maxLargeTextSizePx = useMemo(() => {
    const availableHeightPx = layout.metrics.minHeightMm * PREVIEW_SCALE;
    return availableHeightPx > 0 ? Math.max(24, availableHeightPx * 0.8) : 72;
  }, [layout.metrics.minHeightMm]);

  useEffect(() => {
    return () => {
      if (uploadedArtworkRef.current) {
        URL.revokeObjectURL(uploadedArtworkRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const image = new Image();
    setArtworkImage(null);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      if (isCancelled) {
        return;
      }
      const width = image.naturalWidth || DEFAULT_LAYOUT.metrics.requiredWidthMm * PREVIEW_SCALE;
      const height = image.naturalHeight || DEFAULT_LAYOUT.metrics.requiredHeightMm * PREVIEW_SCALE;
      setArtworkDimensionsMm({
        widthMm: width / PREVIEW_SCALE,
        heightMm: height / PREVIEW_SCALE,
      });
      setArtworkImage(image);
    };
    image.onerror = () => {
      if (isCancelled) {
        return;
      }
      setArtworkImage(null);
    };
    image.src = artworkSrc;

    return () => {
      isCancelled = true;
    };
  }, [artworkSrc]);

  useEffect(() => {
    setArtZoom((current) => {
      const desiredZoom = hasManualZoom && current >= artworkBounds.minZoom ? current : artworkBounds.minZoom;
      return current === desiredZoom ? current : desiredZoom;
    });
  }, [artworkBounds.minZoom, hasManualZoom]);

  useEffect(() => {
    setArtOffsetMm((current) => {
      const clamped = {
        x: clamp(current.x, offsetLimits.minX, offsetLimits.maxX),
        y: clamp(current.y, offsetLimits.minY, offsetLimits.maxY),
      } as const;
      if (hasManualOffset) {
        return clamped;
      }
      const centered = {
        x: clamp(0, offsetLimits.minX, offsetLimits.maxX),
        y: clamp(0, offsetLimits.minY, offsetLimits.maxY),
      } as const;
      return clamped.x === centered.x && clamped.y === centered.y ? clamped : centered;
    });
  }, [offsetLimits, hasManualOffset]);

  useEffect(() => {
    setLargeTextSizePx((current) => clamp(current, 24, maxLargeTextSizePx));
  }, [maxLargeTextSizePx]);

  useEffect(() => {
    if (!artworkImage) {
      setPdfPreview(null);
      setIsGeneratingPdf(false);
      return;
    }

    let isCancelled = false;
    setIsGeneratingPdf(true);

    const generatePreview = async () => {
      try {
        const result = await renderPdfPreview({
          layout,
          artOffsetMm,
          artZoom,
          artworkImage,
          artworkDimensionsMm,
          showLargeText,
          largeText,
          largeTextFont,
          largeTextSizePx,
        });

        if (isCancelled) {
          return;
        }

        if (pdfUrlRef.current) {
          URL.revokeObjectURL(pdfUrlRef.current);
        }

        const pdfUrl = URL.createObjectURL(result.pdfBlob);
        pdfUrlRef.current = pdfUrl;
        setPdfPreview({ pdfUrl, pageImages: result.pageImageDataUrls });
      } catch (error) {
        if (!isCancelled) {
          // eslint-disable-next-line no-console
          console.error("Failed to render PDF preview", error);
          setPdfPreview(null);
        }
      } finally {
        if (!isCancelled) {
          setIsGeneratingPdf(false);
        }
      }
    };

    generatePreview();

    return () => {
      isCancelled = true;
    };
  }, [
    artOffsetMm,
    artZoom,
    artworkDimensionsMm,
    artworkImage,
    largeText,
    largeTextFont,
    largeTextSizePx,
    layout,
    showLargeText,
  ]);

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

  const artWrapperStyle = {
    transform: `translate(-50%, -50%) translate(${artOffsetMm.x * PREVIEW_SCALE}px, ${artOffsetMm.y * PREVIEW_SCALE}px)`,
  } as const;

  const artImageStyle = {
    width: artworkDimensionsMm.widthMm * PREVIEW_SCALE,
    height: artworkDimensionsMm.heightMm * PREVIEW_SCALE,
    transform: `translate(-50%, -50%) scale(${artZoom})`,
    transformOrigin: "center",
  } as const;

  const largeTextWrapperStyle = useMemo(() => {
    const availableWidthPx = layout.metrics.totalWidthMm * PREVIEW_SCALE;
    const topOffsetMm = CLEARANCE_TOP_MM + (layout.metrics.maxHeightMm - layout.metrics.minHeightMm) / 2;
    const topPx = topOffsetMm * PREVIEW_SCALE;
    return {
      left: CLEARANCE_SIDE_MM * PREVIEW_SCALE,
      top: topPx,
      width: availableWidthPx,
      height: layout.metrics.minHeightMm * PREVIEW_SCALE,
      fontFamily: largeTextFont,
      fontSize: `${largeTextSizePx}px`,
    } as const;
  }, [largeTextFont, largeTextSizePx, layout.metrics.maxHeightMm, layout.metrics.minHeightMm, layout.metrics.totalWidthMm]);

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
            <p className="mt-1">Top clearance: 2 mm • Bottom clearance: 2 mm • Side clearance: 10 mm</p>
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
              <label className="flex flex-col gap-1 text-sm md:col-span-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Artwork image</span>
                <input
                  type="file"
                  accept="image/jpeg"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    if (file.type !== "image/jpeg" && file.type !== "image/pjpeg") {
                      return;
                    }
                    if (uploadedArtworkRef.current) {
                      URL.revokeObjectURL(uploadedArtworkRef.current);
                    }
                    const objectUrl = URL.createObjectURL(file);
                    uploadedArtworkRef.current = objectUrl;
                    setArtworkSrc(objectUrl);
                    setArtOffsetMm({ x: 0, y: 0 });
                    setArtZoom(1);
                    setHasManualOffset(false);
                    setHasManualZoom(false);
                    event.target.value = "";
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand"
                />
                <span className="text-xs text-slate-500">Upload a JPEG to replace the default artwork.</span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horizontal offset (mm)</span>
                <input
                  type="range"
                  min={offsetLimits.minX}
                  max={offsetLimits.maxX}
                  step={0.5}
                  value={artOffsetMm.x}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setArtOffsetMm((prev) => ({
                      ...prev,
                      x: clamp(value, offsetLimits.minX, offsetLimits.maxX),
                    }));
                    setHasManualOffset(true);
                  }}
                />
                <span className="text-xs text-slate-500">{artOffsetMm.x.toFixed(1)} mm</span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vertical offset (mm)</span>
                <input
                  type="range"
                  min={offsetLimits.minY}
                  max={offsetLimits.maxY}
                  step={0.5}
                  value={artOffsetMm.y}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setArtOffsetMm((prev) => ({
                      ...prev,
                      y: clamp(value, offsetLimits.minY, offsetLimits.maxY),
                    }));
                    setHasManualOffset(true);
                  }}
                />
                <span className="text-xs text-slate-500">{artOffsetMm.y.toFixed(1)} mm</span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zoom</span>
                <input
                  type="range"
                  min={artworkBounds.minZoom}
                  max={1.25}
                  step={0.01}
                  value={artZoom}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setHasManualZoom(true);
                    setArtZoom(value < artworkBounds.minZoom ? artworkBounds.minZoom : value);
                  }}
                />
                <span className="text-xs text-slate-500">{(artZoom * 100).toFixed(0)}%</span>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Large spine text</h2>
                <p className="text-sm text-slate-500">Overlay a title across the full stack without leaving the spine bounds.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={showLargeText}
                  onChange={(event) => setShowLargeText(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Enable large text
              </label>
            </header>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <label className="md:col-span-3 flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Text</span>
                <textarea
                  value={largeText}
                  onChange={(event) => setLargeText(event.target.value)}
                  placeholder="Enter collection title"
                  rows={3}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  disabled={!showLargeText}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Font family</span>
                <select
                  value={largeTextFont}
                  onChange={(event) => setLargeTextFont(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  disabled={!showLargeText}
                >
                  {FONT_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value} style={{ fontFamily: option.value }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Font size (px)</span>
                <input
                  type="range"
                  min={24}
                  max={maxLargeTextSizePx}
                  step={1}
                  value={largeTextSizePx}
                  onChange={(event) => setLargeTextSizePx(Number(event.target.value))}
                  disabled={!showLargeText}
                />
                <span className="text-xs text-slate-500">{Math.round(largeTextSizePx)} px</span>
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
                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-90">
                  <div
                    className="absolute left-1/2 top-1/2"
                    style={artWrapperStyle}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={artworkSrc}
                      alt="Uploaded artwork background"
                      className="pointer-events-none absolute left-1/2 top-1/2 select-none"
                      style={artImageStyle}
                    />
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black tracking-[1em] text-slate-800/10">
                  SAMPLE
                </div>

                {showLargeText && largeText.trim().length > 0 ? (
                  <div
                    className="pointer-events-none absolute flex items-center justify-center text-center text-white drop-shadow-[0_1px_6px_rgba(15,23,42,0.35)]"
                    style={largeTextWrapperStyle}
                  >
                    <span className="w-[92%] whitespace-pre-wrap break-words text-slate-50" style={{ lineHeight: 1.1 }}>
                      {largeText}
                    </span>
                  </div>
                ) : null}

                {layout.rects.map((rect) => (
                  <div
                    key={rect.id}
                    className="absolute rounded-md border shadow-sm"
                    style={{
                      width: rect.widthMm * PREVIEW_SCALE,
                      height: rect.heightMm * PREVIEW_SCALE,
                      transform: `translate(${rect.xMm * PREVIEW_SCALE}px, ${rect.yMm * PREVIEW_SCALE}px)`,
                      borderColor: rect.color,
                      backgroundColor: "transparent",
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

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">PDF layout preview</h2>
                <p className="text-sm text-slate-500">11×17 in sheet centred on the stack with live artwork alignment.</p>
              </div>
              {pdfPreview ? (
                <a
                  href={pdfPreview.pdfUrl}
                  download="flyleaf-mockup.pdf"
                  className="inline-flex items-center rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10"
                >
                  Download PDF
                </a>
              ) : null}
            </header>

            <p className="mt-4 text-sm text-slate-600">
              The preview updates automatically whenever you tweak books, text, or artwork positioning above.
            </p>

            <div className="mt-4 space-y-4">
              {pdfPreview ? (
                pdfPreview.pageImages.length > 0 ? (
                  <div className="space-y-6">
                    {pdfPreview.pageImages.map((imageUrl, index) => (
                      <figure
                        key={`${imageUrl}-${index}`}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt={`PDF page ${index + 1}`} className="block w-full" />
                        <figcaption className="border-t border-slate-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Page {index + 1}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100/70 py-16 text-center text-sm text-slate-500">
                    PDF preview will appear once at least one spine is defined.
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100/70 py-16 text-center text-sm text-slate-500">
                  {isGeneratingPdf ? "Generating PDF preview…" : "PDF preview will appear once the artwork is ready."}
                </div>
              )}
              {isGeneratingPdf ? (
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rendering latest layout…</p>
              ) : (
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest layout ready</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
