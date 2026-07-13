/**
 * Minimal inline SVG icons for the toolbar (16x16 stroke icons, Lucide-style
 * paths). Kept as static path data + a tiny builder so no icon library is
 * pulled into the zero-dependency bundle.
 */
export type IconName =
	| 'chevron-left'
	| 'chevron-right'
	| 'chevron-down'
	| 'chevron-up'
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
	| 'send-backward'
	| 'share'
	| 'broadcast'
	| 'cut'
	| 'copy'
	| 'paste'
	| 'duplicate'
	| 'trash'
	| 'bold'
	| 'italic'
	| 'underline'
	| 'strikethrough'
	| 'text-shadow'
	| 'a-up'
	| 'a-down'
	| 'clear-format'
	| 'change-case'
	| 'char-spacing'
	| 'font-color'
	| 'highlight'
	| 'bullet-list'
	| 'numbered-list'
	| 'indent-increase'
	| 'indent-decrease'
	| 'align-left'
	| 'align-center'
	| 'align-right'
	| 'align-justify'
	| 'align-top'
	| 'align-middle'
	| 'align-bottom'
	| 'distribute-h'
	| 'distribute-v'
	| 'flip-h'
	| 'flip-v'
	| 'group'
	| 'ungroup'
	| 'line-spacing'
	| 'search'
	| 'replace'
	| 'new-slide'
	| 'layout'
	| 'table'
	| 'image'
	| 'video'
	| 'text-box'
	| 'chart'
	| 'file'
	| 'download'
	| 'printer'
	| 'square'
	| 'circle'
	| 'triangle'
	| 'diamond'
	| 'database'
	| 'move-right'
	| 'equation'
	| 'smart-art'
	| 'action-button'
	| 'field'
	| 'cursor'
	| 'pen'
	| 'highlighter'
	| 'eraser'
	| 'panel-left'
	| 'panel-right'
	| 'sticky-note'
	| 'monitor'
	| 'presentation';

const ICON_PATHS: Record<IconName, string[]> = {
	'chevron-left': ['M15 18l-6-6 6-6'],
	'chevron-right': ['M9 18l6-6-6-6'],
	'chevron-down': ['M6 9l6 6 6-6'],
	'chevron-up': ['M18 15l-6-6-6 6'],
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
	share: [
		'M15 5a3 3 0 1 0 6 0 3 3 0 1 0 -6 0',
		'M3 12a3 3 0 1 0 6 0 3 3 0 1 0 -6 0',
		'M15 19a3 3 0 1 0 6 0 3 3 0 1 0 -6 0',
		'M8.6 13.5l6.8 3.9',
		'M15.4 6.6l-6.8 3.9',
	],
	broadcast: [
		'M10 12a2 2 0 1 0 4 0 2 2 0 1 0 -4 0',
		'M7.8 7.8a6 6 0 0 0 0 8.4',
		'M16.2 7.8a6 6 0 0 1 0 8.4',
		'M4.9 4.9a10 10 0 0 0 0 14.2',
		'M19.1 4.9a10 10 0 0 1 0 14.2',
	],
	cut: [
		'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
		'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
		'M20 4L8.5 15.5',
		'M14.5 9.5L20 15',
		'M8.5 8.5L12 12',
	],
	copy: ['M9 9h11v11H9z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
	paste: [
		'M9 3h6v3H9z',
		'M6 5h2v2h8V5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
	],
	duplicate: ['M8 8h11v11H8z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
	trash: ['M4 6h16', 'M9 6V4h6v2', 'M6 6l1 14h10l1-14', 'M10 11v5', 'M14 11v5'],
	bold: ['M6 4h6a3.5 3.5 0 0 1 0 7H6z', 'M6 11h7a3.5 3.5 0 0 1 0 7H6z'],
	italic: ['M11 4h6', 'M7 20h6', 'M15 4L9 20'],
	underline: ['M6 4v6a6 6 0 0 0 12 0V4', 'M5 21h14'],
	strikethrough: [
		'M6 12h12',
		'M8 6.5a4 3 0 0 1 4-2.5c2 0 4 1 4 2.5',
		'M8 17.5a4 3 0 0 0 4 2.5c2 0 4-1 4-2.5',
	],
	'text-shadow': ['M6 17V7h5a3.5 3.5 0 0 1 0 7H6', 'M9.5 10h5a3.5 3.5 0 0 1 0 7H9.5', 'M9.5 17V10'],
	'a-up': ['M5 18l4-11 4 11', 'M6.5 14h5', 'M17 10l3-3 3 3'],
	'a-down': ['M5 18l4-11 4 11', 'M6.5 14h5', 'M17 7l3 3 3-3'],
	'clear-format': ['M4 7V4h11l-1.5 3', 'M14 7l6 13', 'M9.5 10.5L18 19', 'M4 20h7'],
	'change-case': [
		'M4 16l3-9 3 9',
		'M5 13h4',
		'M14 8v8',
		'M14 10a3 3 0 1 1 0 6',
		'M14 10a3 3 0 1 0 0 6',
	],
	'char-spacing': [
		'M6 6h2v12H6z',
		'M16 6h2v12h-2z',
		'M2 20h2M2 20v-2M2 20v2',
		'M22 20h-2M22 20v-2M22 20v2',
	],
	'font-color': ['M6 20h12', 'M9.5 4h5L18 16H6L9.5 4z'],
	highlight: ['M11 15l-4 4H3v-4l4-4', 'M14.5 4.5l5 5L9 20l-5-1 1-5z'],
	'bullet-list': ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
	'numbered-list': [
		'M10 6h11',
		'M10 12h11',
		'M10 18h11',
		'M4 6h1v3',
		'M4 13a1 1 0 0 1 1-1h1v2l-2 2h2',
		'M4 17h2v3H4',
	],
	'indent-increase': ['M3 5h18', 'M3 19h18', 'M3 12h9', 'M14 9l4 3-4 3'],
	'indent-decrease': ['M3 5h18', 'M3 19h18', 'M3 12h9', 'M18 9l-4 3 4 3'],
	'align-left': ['M4 6h16', 'M4 12h10', 'M4 18h14'],
	'align-center': ['M4 6h16', 'M7 12h10', 'M6 18h12'],
	'align-right': ['M4 6h16', 'M10 12h10', 'M6 18h14'],
	'align-justify': ['M4 6h16', 'M4 12h16', 'M4 18h16'],
	'align-top': ['M4 4h16', 'M9 9h6v11H9z'],
	'align-middle': ['M4 12h16', 'M9 6.5h6v11H9z'],
	'align-bottom': ['M4 20h16', 'M9 4h6v11H9z'],
	'distribute-h': ['M3 4v16', 'M21 4v16', 'M8 9h3v6H8z', 'M13 9h3v6h-3z'],
	'distribute-v': ['M4 3h16', 'M4 21h16', 'M9 8v3h6V8z', 'M9 13v3h6v-3z'],
	'flip-h': ['M12 3v18', 'M17 8l3 4-3 4', 'M7 8l-3 4 3 4'],
	'flip-v': ['M3 12h18', 'M8 17l4 3 4-3', 'M8 7l4-3 4 3'],
	group: ['M4 4h10v10H4z', 'M10 10h10v10H10z'],
	ungroup: ['M4 4h7v7H4z', 'M13 13h7v7h-7z'],
	'line-spacing': [
		'M5 5h14',
		'M5 12h14',
		'M5 19h14',
		'M2 8l0 -5 M2 3l1.5 1.5 M2 3l-1.5 1.5',
		'M2 16l0 5 M2 21l1.5 -1.5 M2 21l-1.5 -1.5',
	],
	search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M21 21l-4.35-4.35'],
	replace: ['M4 7h11l-3-3', 'M4 7l3 3', 'M20 17H9l3-3', 'M20 17l-3 3'],
	'new-slide': ['M4 4h16v16H4z', 'M12 8v8', 'M8 12h8'],
	layout: ['M3 4h18v16H3z', 'M3 10h18', 'M9 10v10'],
	table: ['M3 4h18v16H3z', 'M3 10h18', 'M3 16h18', 'M9 4v16', 'M15 4v16'],
	image: ['M3 4h18v16H3z', 'M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M4 18l5-5 4 4 3-3 4 4'],
	video: ['M3 5h13v14H3z', 'M16 10l5-3v10l-5-3z'],
	'text-box': ['M4 4h16v16H4z', 'M9 9h6', 'M12 9v7'],
	chart: ['M3 3v18h18', 'M7 11h3v6H7z', 'M12 7h3v10h-3z', 'M17 13h3v4h-3z'],
	file: ['M6 2h9l5 5v15H6z', 'M15 2v5h5'],
	download: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
	printer: [
		'M6 9V3h12v6',
		'M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2',
		'M6 14h12v7H6z',
	],
	square: ['M4 4h16v16H4z'],
	circle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'],
	triangle: ['M12 3l9 18H3z'],
	diamond: ['M12 2l10 10-10 10L2 12z'],
	database: [
		'M12 5c4.4 0 8-1.1 8-2.5S16.4 0 12 0 4 1.1 4 2.5 7.6 5 12 5z',
		'M4 2.5v14c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-14',
		'M4 9c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5',
	],
	'move-right': ['M5 12h14', 'M13 6l6 6-6 6'],
	equation: ['M4 17h6', 'M7 14v6', 'M14 7l4.5 10', 'M15.5 14h5'],
	'smart-art': ['M3 3h8v8H3z', 'M13 13h8v8h-8z', 'M11 7h2', 'M17 11v2'],
	'action-button': ['M3 3h18v18H3z', 'M13 7l4 5-4 5'],
	field: ['M4 7h16', 'M4 12h10', 'M4 17h12', 'M19 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
	cursor: ['M4 4l7.07 17 2.51-7.39L21 11.07 4 4z'],
	pen: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z'],
	highlighter: ['M9 11l-6 6v3h3l9.5-9.5', 'M14.5 4l5.5 5.5-2.5 2.5-5.5-5.5z'],
	eraser: [
		'M7 21l-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21',
		'M22 21H7',
		'M5 11l9 9',
	],
	'panel-left': ['M4 4h16v16H4z', 'M9 4v16'],
	'panel-right': ['M4 4h16v16H4z', 'M15 4v16'],
	'sticky-note': ['M5 4h14v10l-6 6H5z', 'M13 20v-6h6'],
	monitor: ['M3 5h18v12H3z', 'M8 21h8', 'M12 17v4'],
	presentation: ['M3 4h18', 'M5 4h14v11H5z', 'M12 15v3', 'M9 21l3-3 3 3'],
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
