/**
 * Minimal inline SVG icons for the toolbar (16x16 stroke icons, Lucide-style
 * paths). Kept as static path data + a tiny builder so no icon library is
 * pulled into the zero-dependency bundle.
 */
export type IconName =
	| 'chevron-left'
	| 'chevron-right'
	| 'zoom-in'
	| 'zoom-out'
	| 'fit'
	| 'play'
	| 'sidebar'
	| 'undo'
	| 'redo'
	| 'save'
	| 'notes'
	| 'plus'
	| 'minus'
	| 'shapes'
	| 'bring-front'
	| 'send-back'
	| 'bring-forward'
	| 'send-backward';

const ICON_PATHS: Record<IconName, string[]> = {
	'chevron-left': ['M15 18l-6-6 6-6'],
	'chevron-right': ['M9 18l6-6-6-6'],
	'zoom-in': ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M21 21l-4.35-4.35', 'M11 8v6', 'M8 11h6'],
	'zoom-out': ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M21 21l-4.35-4.35', 'M8 11h6'],
	fit: [
		'M8 3H5a2 2 0 0 0-2 2v3',
		'M16 3h3a2 2 0 0 1 2 2v3',
		'M8 21H5a2 2 0 0 1-2-2v-3',
		'M16 21h3a2 2 0 0 0 2-2v-3',
	],
	play: ['M6 4l14 8-14 8V4z'],
	sidebar: ['M4 4h16v16H4z', 'M9 4v16'],
	undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-15-6.7L3 13'],
	redo: ['M21 7v6h-6', 'M3 17a9 9 0 0 1 15-6.7L21 13'],
	save: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
	notes: ['M5 4h14v16H5z', 'M8 9h8', 'M8 13h8', 'M8 17h4'],
	plus: ['M12 5v14', 'M5 12h14'],
	minus: ['M5 12h14'],
	shapes: ['M4 4h9v9H4z', 'M17.5 14a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z'],
	'bring-front': ['M9 3h12v12H9z', 'M3 9h6v12h12v-6', 'M3 9h6V3'],
	'send-back': ['M3 9h12v12H3z', 'M9 3h12v12h-6', 'M15 15h6V9'],
	'bring-forward': ['M8 8h13v13H8z', 'M3 3h10v5', 'M3 3v10h5'],
	'send-backward': ['M3 3h13v13H3z', 'M16 16h5V8', 'M16 21h5v-5'],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build a 16x16 stroked icon `<svg>` for the given name. */
export function createIcon(doc: Document, name: IconName): SVGSVGElement {
	const svg = doc.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	svg.setAttribute('aria-hidden', 'true');
	for (const d of ICON_PATHS[name]) {
		const path = doc.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', d);
		svg.appendChild(path);
	}
	return svg;
}
