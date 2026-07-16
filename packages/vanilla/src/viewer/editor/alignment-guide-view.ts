import type { Guide } from 'pptx-viewer-shared';

export function syncAlignmentGuides(
	doc: Document,
	root: HTMLElement,
	guides: Guide[],
	scale: number,
): void {
	root.querySelectorAll('.pptxv-alignment-guide').forEach((guide) => guide.remove());
	for (const guide of guides) {
		const line = doc.createElement('div');
		line.className = `pptxv-alignment-guide is-${guide.axis}`;
		line.style[guide.axis === 'h' ? 'top' : 'left'] = `${guide.position * scale}px`;
		root.appendChild(line);
	}
}
