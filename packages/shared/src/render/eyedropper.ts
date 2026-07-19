/**
 * EyeDropper colour sampler (framework-agnostic).
 *
 * Prefers the native browser EyeDropper API (Chrome 95+ / Edge 95+). For
 * browsers without it (Firefox, Safari) a DOM-sampling fallback reads the
 * colour under the pointer via `elementFromPoint` + `getComputedStyle`, so the
 * eyedropper still works everywhere. Shared by every binding; each re-exports
 * these symbols through a thin shim.
 */

/** A sampled colour, as hex plus its RGB channels. */
export interface EyedropperResult {
	hex: string;
	r: number;
	g: number;
	b: number;
}

/**
 * Returns true when the native EyeDropper API is available in this browser.
 * Guards against SSR / headless environments without `window`.
 */
export function eyedropperAvailable(): boolean {
	return typeof window !== 'undefined' && 'EyeDropper' in window;
}

/**
 * Open the native EyeDropper and return the picked sRGB hex colour string
 * (e.g. `"#a3b4c5"`), or `null` when the user cancels or the API is absent.
 */
export async function openNativeEyeDropper(): Promise<string | null> {
	if (!eyedropperAvailable()) {
		return null;
	}
	try {
		type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
		const EyeDropperClass = (window as unknown as Record<string, unknown>)[
			'EyeDropper'
		] as EyeDropperCtor;
		const dropper = new EyeDropperClass();
		const result = await dropper.open();
		return result.sRGBHex;
	} catch {
		// User cancelled (AbortError) or unexpected error: treat as no-op
		return null;
	}
}

// ---------------------------------------------------------------------------
// Fallback sampling (Firefox / Safari)
// ---------------------------------------------------------------------------

function toHex(r: number, g: number, b: number): string {
	const h = (n: number): string => n.toString(16).padStart(2, '0');
	return `#${h(r)}${h(g)}${h(b)}`;
}

function parseRgbaString(str: string): EyedropperResult | null {
	const match = str.match(/rgba?\(\s*(?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)/u);
	if (!match?.groups) {
		return null;
	}
	const r = parseInt(match.groups.r, 10);
	const g = parseInt(match.groups.g, 10);
	const b = parseInt(match.groups.b, 10);
	return { r, g, b, hex: toHex(r, g, b) };
}

/**
 * Sample the colour at a client-space point by inspecting the topmost element's
 * computed paint. Tries, in order: a real `<canvas>` pixel read (sharp for
 * rasterised content), then the element's `background-color`, SVG `fill`, and
 * finally text `color`. Returns `null` when nothing paintable is found.
 *
 * This is the DOM fallback used when the native EyeDropper API is unavailable;
 * it needs no canvas plumbing, so it works against the live slide DOM.
 */
export function sampleColorFromSlide(clientX: number, clientY: number): EyedropperResult | null {
	const target =
		typeof document === 'undefined' ? null : document.elementFromPoint(clientX, clientY);
	if (!(target instanceof Element)) {
		return null;
	}

	// Direct pixel read when the pointer is over a <canvas> (untainted only).
	const canvas = target instanceof HTMLCanvasElement ? target : target.closest('canvas');
	if (canvas instanceof HTMLCanvasElement) {
		try {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				const rect = canvas.getBoundingClientRect();
				const sx = Math.round((clientX - rect.left) * (canvas.width / canvas.clientWidth));
				const sy = Math.round((clientY - rect.top) * (canvas.height / canvas.clientHeight));
				const pixel = ctx.getImageData(sx, sy, 1, 1).data;
				return { r: pixel[0], g: pixel[1], b: pixel[2], hex: toHex(pixel[0], pixel[1], pixel[2]) };
			}
		} catch {
			// Cross-origin / tainted canvas: fall through to computed-style sampling.
		}
	}

	const computed = getComputedStyle(target);
	const bg = computed.backgroundColor;
	if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
		const parsed = parseRgbaString(bg);
		if (parsed) {
			return parsed;
		}
	}
	const fill = computed.fill;
	if (fill && fill !== 'none' && fill !== 'transparent') {
		const parsed = parseRgbaString(fill);
		if (parsed) {
			return parsed;
		}
	}
	return computed.color ? parseRgbaString(computed.color) : null;
}

/**
 * Run the eyedropper fallback: arm a one-shot pointer listener and resolve with
 * the hex colour of the next click (or `null` if the user presses Escape). Used
 * only when {@link eyedropperAvailable} is false. The caller is responsible for
 * any "armed" UI affordance; this just manages the listeners.
 */
export function pickColorByClickFallback(): Promise<string | null> {
	if (typeof document === 'undefined') {
		return Promise.resolve(null);
	}
	return new Promise<string | null>((resolve) => {
		const cleanup = (): void => {
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown, true);
		};
		const onPointerDown = (event: PointerEvent): void => {
			event.preventDefault();
			event.stopPropagation();
			cleanup();
			const sample = sampleColorFromSlide(event.clientX, event.clientY);
			resolve(sample ? sample.hex : null);
		};
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				cleanup();
				resolve(null);
			}
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('keydown', onKeyDown, true);
	});
}
