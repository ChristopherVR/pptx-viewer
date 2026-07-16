/**
 * Pure SVG-print string helpers, shared by bindings that offer a vector print
 * path (currently React). These build self-contained SVG / print-HTML strings
 * and escape text; they touch no DOM.
 *
 * The DOM-bound driver pieces (cloning the live element tree, reading
 * `getComputedStyle`, fetching images to base64, `Blob` wrapping) stay in the
 * binding; only the string assembly and escaping live here.
 */
import { sanitizeMarkupOrEmpty } from '../render/dompurify-safe';

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

/** Options for {@link buildPrintDocument}. */
export interface PrintDocumentOptions {
	title?: string;
	orientation?: 'landscape' | 'portrait';
	colorFilter?: string;
}

/* ------------------------------------------------------------------ */
/*  XML escaping                                                       */
/* ------------------------------------------------------------------ */

/** Characters that need escaping in XML attribute values. */
const XML_ESCAPE_MAP: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;',
};

/** Escape a string for safe inclusion in XML/SVG content. */
export function escapeXml(text: string): string {
	return text.replace(/[&<>"']/gu, (ch) => XML_ESCAPE_MAP[ch] || ch);
}

/* ------------------------------------------------------------------ */
/*  Non-text interpolation guards                                      */
/* ------------------------------------------------------------------ */

/**
 * Characters permitted in a caller-supplied CSS declaration (e.g. a
 * `filter: ...;` rule) that gets interpolated, unescaped, into a `<style>`
 * element. HTML-escaping isn't an option here since the value must remain
 * valid CSS, so instead this is a strict allow-list: letters, digits,
 * whitespace, and common declaration punctuation. Deliberately excludes
 * `<`, `>`, `/`, quotes, and `{`/`}`, so nothing in this set can close the
 * surrounding `<style>` tag or smuggle in a sibling element.
 */
const SAFE_CSS_DECLARATION = /^[a-zA-Z0-9\s():;,.%-]*$/u;

/**
 * Sanitize a caller-supplied CSS declaration before it is embedded into the
 * print stylesheet. Callers of this library only ever pass a handful of
 * known-literal `filter:` values, but this function is a public export, so
 * it cannot assume that holds; anything outside the safe character set
 * (e.g. an attempt to close the `<style>` tag) is dropped rather than
 * embedded.
 */
export function sanitizeCssDeclaration(value: string): string {
	return SAFE_CSS_DECLARATION.test(value) ? value : '';
}

/**
 * Coerce a caller-supplied orientation to one of the two literal values it
 * is typed as. `PrintDocumentOptions.orientation` is typed as a union at
 * compile time, but this function is a public export reachable from plain
 * JS callers, so a runtime check keeps the value that reaches `@page` /
 * `<style>` interpolation confined to those two known-safe strings.
 */
export function sanitizeOrientation(value: 'landscape' | 'portrait'): 'landscape' | 'portrait' {
	return value === 'portrait' ? 'portrait' : 'landscape';
}

/** Element/attribute shapes that are never legitimate in a rendered slide SVG. */
const UNSAFE_SVG_SUBSTRINGS = [
	'</section',
	'<script',
	'<foreignobject',
	'<iframe',
	'<embed',
	'<object',
	// eslint-disable-next-line no-script-url -- security deny-list entry: verifies the scheme is rejected, never executed.
	'javascript:',
];

/** Matches an `on<event>=` handler attribute, e.g. `onload=`, `onclick=`. */
const EVENT_HANDLER_ATTR_RE = /\son\w+\s*=/iu;

/**
 * Guard against a malformed or tampered per-slide SVG string breaking out
 * of the `<section>` wrapper it's embedded in (unescaped) by
 * {@link buildPrintDocument}.
 *
 * This is deliberately an allow-list first, deny-list second check, not
 * just a deny-list: legitimate SVG produced by this library's own
 * `SvgExporter` render path is always a single well-formed `<svg>...</svg>`
 * root element, so anything that doesn't structurally look like that is
 * rejected outright. The deny-list then additionally screens for common
 * SVG-based script-injection vectors (`<script>`, `<foreignObject>` (which
 * can embed arbitrary HTML), `on*=` event handler attributes, `javascript:`
 * URIs) so a crafted-but-still-`<svg>...</svg>`-shaped payload is also
 * rejected.
 */
export function isSafeSvgMarkup(svg: string): boolean {
	const trimmed = svg.trim();
	if (!trimmed.toLowerCase().startsWith('<svg') || !trimmed.toLowerCase().endsWith('</svg>')) {
		return false;
	}

	const lower = trimmed.toLowerCase();
	if (UNSAFE_SVG_SUBSTRINGS.some((needle) => lower.includes(needle))) {
		return false;
	}

	return !EVENT_HANDLER_ATTR_RE.test(trimmed);
}

function sanitizeSlideSvg(svg: string, width: number, height: number): string {
	if (!isSafeSvgMarkup(svg)) {
		return '';
	}
	const sanitized = sanitizeMarkupOrEmpty(svg, { USE_PROFILES: { svg: true } }).trim();
	if (!sanitized || sanitized.toLowerCase().startsWith('<svg')) {
		return sanitized;
	}
	const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
	const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${safeWidth} ${safeHeight}" width="${safeWidth}" height="${safeHeight}">${sanitized}</svg>`;
}

/* ------------------------------------------------------------------ */
/*  Print stylesheet / document construction                           */
/* ------------------------------------------------------------------ */

/**
 * Build print-ready CSS rules to inject into the SVG foreignObject. These
 * override browser defaults and ensure clean print output.
 */
export function buildPrintStyleSheet(width: number, height: number, customCss?: string): string {
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
    ${customCss || ''}
  `.trim();
}

/**
 * Generate a multi-page HTML document embedding all per-slide SVG strings,
 * suitable for print-to-PDF conversion. Each slide is placed in its own page
 * section with a page-break marker.
 *
 * @param svgs Array of per-slide SVG strings.
 * @param width Slide width in pixels.
 * @param height Slide height in pixels.
 */
export function buildPrintDocument(
	svgs: string[],
	width: number,
	height: number,
	options: PrintDocumentOptions = {},
): string {
	const { title = 'Print', orientation = 'landscape', colorFilter = '' } = options;
	const safeOrientation = sanitizeOrientation(orientation);
	const safeColorFilter = sanitizeCssDeclaration(colorFilter);

	const slidePages = svgs
		.map((svg, i) => {
			// Belt-and-suspenders: the structural allow/deny-list guard runs
			// first, then DOMPurify's SVG profile actually transforms the
			// markup (stripping `<script>`/`<foreignObject>`/event handlers/
			// `javascript:` URIs) before it is spliced in, rather than merely
			// gating the raw, untransformed string behind a boolean check.
			const safeSvg = sanitizeSlideSvg(svg, width, height);
			return `<section class="print-slide-page" aria-label="Slide ${i + 1}">
  ${safeSvg}
</section>`;
		})
		.join('\n');

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
      ${safeColorFilter}
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
      size: ${safeOrientation};
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
        width: ${safeOrientation === 'landscape' ? '297mm' : '210mm'};
        height: ${safeOrientation === 'landscape' ? '210mm' : '297mm'};
      }
    }
  </style>
</head>
<body>
  ${slidePages}
</body>
</html>`;
}

/** Convert an SVG string to a data URL. */
export function svgToDataUrl(svg: string): string {
	const encoded = encodeURIComponent(svg);
	return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
