/**
 * SVG Print Serializer
 *
 * Provides a direct DOM-to-SVG serialization path for high-fidelity
 * print output, bypassing html2canvas entirely. This produces vector
 * output that remains sharp at any DPI.
 *
 * Strategy:
 * - Uses SVG `<foreignObject>` to embed HTML slide content
 * - Inlines all computed styles to make the SVG self-contained
 * - Embeds images as base64 data URIs
 * - Produces an SVG that can be rendered to PDF via the browser's
 *   native print pipeline or converted with a lightweight library
 *
 * @module svg-print-serializer
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Options for SVG print serialization. */
export interface SvgPrintOptions {
  /** Slide width in pixels. */
  width: number;
  /** Slide height in pixels. */
  height: number;
  /** Optional background colour for the slide. */
  backgroundColor?: string;
  /** Whether to inline all computed styles. Default: true. */
  inlineStyles?: boolean;
  /** Whether to embed external images as base64. Default: true. */
  embedImages?: boolean;
  /** Custom CSS to inject into the SVG. */
  customCss?: string;
}

/** Result of serializing a slide to SVG for printing. */
export interface SvgPrintResult {
  /** The complete SVG XML string. */
  svg: string;
  /** The width of the SVG in pixels. */
  width: number;
  /** The height of the SVG in pixels. */
  height: number;
}

/* ------------------------------------------------------------------ */
/*  HTML Escaping                                                      */
/* ------------------------------------------------------------------ */

/** Characters that need escaping in XML attribute values. */
const XML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape a string for safe inclusion in XML/SVG content.
 */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch] || ch);
}

/* ------------------------------------------------------------------ */
/*  Style Collection                                                   */
/* ------------------------------------------------------------------ */

/**
 * CSS properties to inline for self-contained SVG output.
 * This is a subset of commonly needed visual properties.
 */
const INLINE_STYLE_PROPERTIES: readonly string[] = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin",
  "padding",
  "border",
  "border-radius",
  "background",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "text-shadow",
  "white-space",
  "word-break",
  "overflow",
  "overflow-x",
  "overflow-y",
  "opacity",
  "visibility",
  "z-index",
  "transform",
  "transform-origin",
  "box-shadow",
  "clip-path",
  "filter",
  "flex",
  "flex-direction",
  "flex-wrap",
  "align-items",
  "justify-content",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "object-fit",
  "object-position",
  "vertical-align",
  "fill",
  "stroke",
  "stroke-width",
] as const;

/**
 * Collect computed styles for an element, returning only properties
 * that differ from the defaults (to minimize SVG size).
 */
export function collectInlineStyles(
  element: HTMLElement,
  properties: readonly string[] = INLINE_STYLE_PROPERTIES,
): string {
  const computed = window.getComputedStyle(element);
  const styles: string[] = [];

  for (const prop of properties) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== "initial" && value !== "normal" && value !== "auto" && value !== "none" && value !== "0px") {
      styles.push(`${prop}: ${value}`);
    }
  }

  return styles.join("; ");
}

/* ------------------------------------------------------------------ */
/*  Image Embedding                                                    */
/* ------------------------------------------------------------------ */

/**
 * Convert an image URL to a base64 data URI.
 * Returns the original URL if conversion fails (e.g. CORS).
 */
export async function imageToBase64(url: string): Promise<string> {
  // Skip already-embedded images
  if (url.startsWith("data:")) return url;
  // Skip blob URLs (can't fetch cross-origin)
  if (url.startsWith("blob:")) return url;

  try {
    const response = await fetch(url, { mode: "cors" });
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve((reader.result as string) || url);
      };
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

/**
 * Find all images in an element subtree and return their src URLs.
 */
export function collectImageUrls(root: HTMLElement): string[] {
  const urls: string[] = [];
  const images = root.querySelectorAll("img");

  for (const img of images) {
    if (img.src) {
      urls.push(img.src);
    }
  }

  // Also check for background-image URLs
  const allElements = root.querySelectorAll("*");
  for (const el of allElements) {
    const htmlEl = el as HTMLElement;
    const computed = window.getComputedStyle(htmlEl);
    const bgImage = computed.getPropertyValue("background-image");
    if (bgImage && bgImage !== "none") {
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch?.[1]) {
        urls.push(urlMatch[1]);
      }
    }
  }

  return [...new Set(urls)];
}

/* ------------------------------------------------------------------ */
/*  SVG Print Document Construction                                    */
/* ------------------------------------------------------------------ */

/**
 * Build print-ready CSS rules to inject into the SVG foreignObject.
 * These override browser defaults and ensure clean print output.
 */
export function buildPrintStyleSheet(
  width: number,
  height: number,
  customCss?: string,
): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :host, :root {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    img { display: block; max-width: 100%; }
    /* Force backgrounds to print */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* Remove scrollbars */
    *::-webkit-scrollbar { display: none !important; }
    * { scrollbar-width: none !important; }
    /* Remove interactive-only elements */
    [data-export-ignore="true"] { display: none !important; }
    ${customCss || ""}
  `.trim();
}

/**
 * Serialize an HTML element subtree to a self-contained SVG string
 * using `<foreignObject>` for HTML embedding.
 *
 * The resulting SVG can be:
 * - Rendered in a browser at any zoom level without quality loss
 * - Printed via the browser's native print pipeline
 * - Converted to PDF with SVG-to-PDF tools
 *
 * @param element - The slide stage HTML element to serialize.
 * @param options - Serialization options.
 * @returns An SvgPrintResult with the SVG string and dimensions.
 */
export function serializeElementToSvg(
  element: HTMLElement,
  options: SvgPrintOptions,
): SvgPrintResult {
  const {
    width,
    height,
    backgroundColor,
    inlineStyles = true,
    customCss,
  } = options;

  // Clone the element to avoid mutating the live DOM
  const clone = element.cloneNode(true) as HTMLElement;

  // Optionally inline computed styles on each element
  if (inlineStyles) {
    inlineComputedStyles(element, clone);
  }

  // Serialize the clone to HTML
  const htmlContent = clone.outerHTML;

  // Build the stylesheet for the foreignObject
  const printCss = buildPrintStyleSheet(width, height, customCss);

  // Construct the SVG document
  const bgRect = backgroundColor
    ? `<rect width="${width}" height="${height}" fill="${escapeXml(backgroundColor)}" />`
    : "";

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <defs>`,
    `    <style type="text/css"><![CDATA[${printCss}]]></style>`,
    `  </defs>`,
    bgRect ? `  ${bgRect}` : "",
    `  <foreignObject x="0" y="0" width="${width}" height="${height}">`,
    `    <div xmlns="http://www.w3.org/1999/xhtml" style="width: ${width}px; height: ${height}px; overflow: hidden;">`,
    `      ${htmlContent}`,
    `    </div>`,
    `  </foreignObject>`,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");

  return { svg, width, height };
}

/**
 * Inline computed styles from the original element tree onto the cloned tree.
 *
 * Walks both trees in parallel, reading computed styles from the original
 * (which is in the live document) and writing them to the clone.
 */
function inlineComputedStyles(
  original: HTMLElement,
  clone: HTMLElement,
): void {
  const styleStr = collectInlineStyles(original);
  if (styleStr) {
    clone.setAttribute("style", styleStr);
  }

  const origChildren = original.querySelectorAll("*");
  const cloneChildren = clone.querySelectorAll("*");

  for (let i = 0; i < origChildren.length && i < cloneChildren.length; i++) {
    const origEl = origChildren[i] as HTMLElement;
    const cloneEl = cloneChildren[i] as HTMLElement;

    if (!origEl.style || !cloneEl.setAttribute) continue;

    const styles = collectInlineStyles(origEl);
    if (styles) {
      cloneEl.setAttribute("style", styles);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Multi-slide SVG Print Document                                     */
/* ------------------------------------------------------------------ */

/**
 * Generate a multi-page SVG document containing all slides,
 * suitable for print-to-PDF conversion.
 *
 * Each slide is placed in its own SVG group with a page-break
 * marker, allowing browsers to split them across pages.
 *
 * @param svgs   - Array of per-slide SVG strings.
 * @param width  - Slide width in pixels.
 * @param height - Slide height in pixels.
 * @returns A single HTML document string ready for printing.
 */
export function buildPrintDocument(
  svgs: string[],
  width: number,
  height: number,
  options: {
    title?: string;
    orientation?: "landscape" | "portrait";
    colorFilter?: string;
  } = {},
): string {
  const { title = "Print", orientation = "landscape", colorFilter = "" } = options;

  const slidePages = svgs
    .map(
      (svg, i) =>
        `<section class="print-slide-page" aria-label="Slide ${i + 1}">
  ${svg}
</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #fff;
      ${colorFilter}
    }
    .print-slide-page {
      page-break-after: always;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      padding: 5mm;
    }
    .print-slide-page:last-child {
      page-break-after: auto;
    }
    .print-slide-page svg {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
    }
    @page {
      size: ${orientation};
      margin: 5mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    @media screen {
      body {
        background: #e5e7eb;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 16px;
      }
      .print-slide-page {
        background: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        border-radius: 4px;
        page-break-after: auto;
        width: ${orientation === "landscape" ? "297mm" : "210mm"};
        height: ${orientation === "landscape" ? "210mm" : "297mm"};
      }
    }
  </style>
</head>
<body>
  ${slidePages}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Utility: SVG to Blob / Data URL                                    */
/* ------------------------------------------------------------------ */

/**
 * Convert an SVG string to a Blob.
 */
export function svgToBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

/**
 * Convert an SVG string to a data URL.
 */
export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
