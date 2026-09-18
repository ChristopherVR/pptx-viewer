/**
 * The six opt-in Three.js scenes every demo can hand its viewer (SmartArt and
 * the surface / bar3D / line3D / area3D / pie3D charts), resolved once from the
 * page URL so all five demos agree on the rules:
 *
 *  - `?smartArt3D=1` (etc.) forces a scene on, `?smartArt3D=0` forces it off.
 *  - Otherwise a scene is ON for a person in a browser and OFF under browser
 *    automation (`navigator.webdriver`, which Playwright/WebDriver set). The
 *    e2e suite is written against the plain DOM/SVG renderers: chart parity
 *    fingerprints an `svg`, SmartArt build-reveal counts DOM nodes, and so on.
 *    When the demos flipped the scenes on by default those ~90 specs, none of
 *    which pass a query string, all saw a `<canvas>` instead and went red on
 *    every binding. The specs that DO cover the scenes already opt in
 *    explicitly (`?barChart3D=1`, `smartart-3d.spec.ts`, ...), so this default
 *    changes nothing for them. The docs screenshot capture runs under
 *    automation too and must pass `=1` for a 3D shot.
 *
 * Options > Advanced > "Disable 3D rendering" remains the persistent,
 * cross-session way to fall back to 2D; the viewer applies it on top of these
 * host flags (`resolve3DRenderingFlags` in `pptx-viewer-shared`).
 */
export interface Demo3DFlags {
	smartArt3D: boolean;
	surfaceChart3D: boolean;
	barChart3D: boolean;
	lineChart3D: boolean;
	areaChart3D: boolean;
	pieChart3D: boolean;
}

export const DEMO_3D_FLAG_NAMES = [
	'smartArt3D',
	'surfaceChart3D',
	'barChart3D',
	'lineChart3D',
	'areaChart3D',
	'pieChart3D',
] as const satisfies readonly (keyof Demo3DFlags)[];

/** Pure: `params` is the page query string, `automated` is `navigator.webdriver`. */
export function resolveDemo3DFlags(params: URLSearchParams, automated: boolean): Demo3DFlags {
	const flags = {} as Demo3DFlags;
	for (const name of DEMO_3D_FLAG_NAMES) {
		const value = params.get(name);
		flags[name] = value === null ? !automated : value !== '0';
	}
	return flags;
}

/** The flags for the current page, or every scene on outside a browser. */
export function currentDemo3DFlags(): Demo3DFlags {
	if (typeof window === 'undefined') {
		return resolveDemo3DFlags(new URLSearchParams(), false);
	}
	return resolveDemo3DFlags(
		new URLSearchParams(window.location.search),
		window.navigator.webdriver === true,
	);
}
