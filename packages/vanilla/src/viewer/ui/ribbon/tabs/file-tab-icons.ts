import {
	ArrowLeft,
	Download,
	FilePlus2,
	FolderOpen,
	Home,
	Info,
	Printer,
	Save,
	Settings,
	Share2,
	Upload,
	UserRound,
	X,
} from 'lucide';
import type { IconNode } from 'lucide';
import type { BackstagePage } from 'pptx-viewer-shared';

export type FileTabIcon = BackstagePage | 'back';

const ICONS: Record<FileTabIcon, IconNode> = {
	back: ArrowLeft,
	home: Home,
	new: FilePlus2,
	open: FolderOpen,
	info: Info,
	save: Save,
	saveAs: Download,
	print: Printer,
	share: Share2,
	export: Upload,
	close: X,
	account: UserRound,
	options: Settings,
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createFileTabIcon(doc: Document, icon: FileTabIcon): SVGSVGElement {
	return createLucideIcon(doc, ICONS[icon], 17);
}

export function createLucideIcon(doc: Document, icon: IconNode, size: number): SVGSVGElement {
	const svg = doc.createElementNS(SVG_NS, 'svg');
	for (const [name, value] of Object.entries({
		viewBox: '0 0 24 24',
		width: size,
		height: size,
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': 1.7,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		'aria-hidden': 'true',
	})) {
		svg.setAttribute(name, String(value));
	}
	for (const [tag, attributes] of icon) {
		const child = doc.createElementNS(SVG_NS, tag);
		for (const [name, value] of Object.entries(attributes)) {
			if (value !== undefined) {
				child.setAttribute(name, String(value));
			}
		}
		svg.appendChild(child);
	}
	return svg;
}
