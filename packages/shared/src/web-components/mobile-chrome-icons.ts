const SVG_NS = 'http://www.w3.org/2000/svg';

/** Trusted 20x20 stroke paths for the mobile bars. No host markup is inserted. */
export const MOBILE_ICON_PATHS = {
	menu: 'M3 5h14M3 10h14M3 15h14',
	undo: 'M7 5 3 9l4 4M4 9h7a5 5 0 0 1 5 5',
	redo: 'm13 5 4 4-4 4M16 9H9a5 5 0 0 0-5 5',
	ai: 'M10 3l1.4 4.1L15.5 8.5l-4.1 1.4L10 14l-1.4-4.1L4.5 8.5l4.1-1.4zM15.5 13v3M14 14.5h3',
	save: 'M10 3v9M6.5 9.5 10 13l3.5-3.5M4 16h12',
	present: 'M4 4h12v9H4zM7 17l3-4 3 4',
	share:
		'M7 9l6-3M7 11l6 3M5 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM15 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM15 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
	slides: 'M10 3 3 6.5l7 3.5 7-3.5zM3 10l7 3.5 7-3.5M3 13.5 10 17l7-3.5',
	insert: 'M10 4v12M4 10h12',
	inspector: 'M4 6h8M15 6h1M4 14h1M8 14h8M12 4v4M7 12v4',
	comments: 'M4 4h12v9H8l-4 3z',
	notes: 'M4 3.5h12v9l-4 4H4zM12 16.5v-4h4M7 7h6M7 10h4',
} as const;

export type MobileIcon = keyof typeof MOBILE_ICON_PATHS;

export function createMobileIcon(doc: Document, icon: MobileIcon): SVGSVGElement {
	const svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 20 20');
	svg.setAttribute('aria-hidden', 'true');
	const path = doc.createElementNS(SVG_NS, 'path');
	path.setAttribute('d', MOBILE_ICON_PATHS[icon]);
	svg.append(path);
	return svg;
}
