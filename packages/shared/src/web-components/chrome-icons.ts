const SVG_NS = 'http://www.w3.org/2000/svg';

/** Trusted 16x16 stroke paths for the chrome controls. No host markup is inserted. */
export const CHROME_ICON_PATHS = {
	lock: 'M4.5 7.5h7v5.5h-7zM5.75 7.5V5.5a2.25 2.25 0 0 1 4.5 0v2',
	close: 'M4 4l8 8M12 4l-8 8',
	warning: 'M8 2.5l6 10.5H2zM8 6.5v3M8 11.2v.1',
	info: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 7.2v3.6M8 5v.1',
	trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5M7 7v4M9 7v4',
	pen: 'M3 13l.7-3L10.8 3l2.2 2.2L5.9 12.3zM9.5 4.5l2 2',
	restore: 'M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3M8 5v3.2l2 1.3',
	print: 'M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z',
	check: 'M3 8.5l3.2 3.2L13 4.8',
} as const;

export type ChromeIcon = keyof typeof CHROME_ICON_PATHS;

export function createChromeIcon(doc: Document, icon: ChromeIcon): SVGSVGElement {
	const svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('aria-hidden', 'true');
	const path = doc.createElementNS(SVG_NS, 'path');
	path.setAttribute('d', CHROME_ICON_PATHS[icon]);
	svg.append(path);
	return svg;
}

/** Shared base rules for the icon SVGs inside the chrome controls. */
export const CHROME_ICON_STYLES = `
svg { flex: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.45;
	stroke-linecap: round; stroke-linejoin: round; }
`;
