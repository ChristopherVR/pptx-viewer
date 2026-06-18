/**
 * Native EyeDropper API wrapper for the Angular viewer.
 *
 * Feature-detects the browser EyeDropper API (Chrome 95+ / Edge 95+).
 * When unavailable, all functions no-op gracefully.
 */

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
		// User cancelled (AbortError) or unexpected error — treat as no-op
		return null;
	}
}
