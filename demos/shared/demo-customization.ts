/**
 * Demo-only plumbing for the UI customisation model, shared by all five demos
 * so the framework-neutral e2e spec (`e2e/ui-customization.spec.ts`) can drive
 * every binding the same way: `?customization=<url-encoded JSON>` seeds the
 * viewer's `customization` prop / input / option with a `ViewerCustomization`
 * object. The imperative helpers are reached through the live component
 * handle every demo already exposes as `window.__pptxViewer` in development
 * (see `demos/dev-viewer-handle.ts`).
 *
 * Kept framework- and binding-agnostic on purpose (no import of any viewer
 * package): the value is structurally a `ViewerCustomization`, and each demo
 * narrows it to its binding's exported type at the call site.
 */

/** Read `?customization=` from `search` (the page query string). */
export function parseDemoCustomization(search: string): Record<string, unknown> | undefined {
	const raw = new URLSearchParams(search).get('customization');
	if (!raw) {
		return undefined;
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: undefined;
	} catch {
		console.warn('Ignoring ?customization=: not valid JSON');
		return undefined;
	}
}

/** The customisation for the current page, or `undefined` when none was given. */
export function currentDemoCustomization(): Record<string, unknown> | undefined {
	return typeof window === 'undefined' ? undefined : parseDemoCustomization(window.location.search);
}
