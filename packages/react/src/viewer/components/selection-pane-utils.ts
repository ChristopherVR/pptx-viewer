/**
 * Display-name resolution for Selection Pane rows.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

const TYPE_LABELS: Record<string, string> = {
	text: 'Text Box',
	shape: 'Shape',
	connector: 'Connector',
	image: 'Image',
	picture: 'Picture',
	chart: 'Chart',
	table: 'Table',
	smartArt: 'SmartArt',
	media: 'Media',
	group: 'Group',
	ink: 'Ink',
	ole: 'Object',
	unknown: 'Object',
};

/**
 * A row's label: an explicit element name (`cNvPr/@name`, editable via the
 * pane's rename input) wins over the text-content / type-label fallbacks.
 */
export function getElementDisplayName(element: PptxElement, index: number): string {
	if (element.name && element.name.trim().length > 0) {
		return element.name.trim();
	}
	if (hasTextProperties(element) && element.text && element.text.trim().length > 0) {
		return element.text.trim().slice(0, 32);
	}
	const label = TYPE_LABELS[element.type] ?? 'Object';
	return `${label} ${index + 1}`;
}
