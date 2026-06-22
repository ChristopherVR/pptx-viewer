/**
 * element.ts: framework-agnostic element helpers for the viewer/editor.
 *
 * Template-origin detection, inline-text eligibility, display labels, comment
 * timestamp formatting + marker positioning, and connection-site geometry. All
 * pure (only `pptx-viewer-core` types), shared by every binding.
 *
 * Note: `isConnectorOrLineElement` stays in each binding because it depends on
 * that binding's shape-type classifier (not a core export).
 *
 * @module render/element
 */
import type {
	PptxComment,
	PptxElement,
	PptxElementWithText,
	GroupPptxElement,
	OlePptxElement,
} from 'pptx-viewer-core';

/**
 * Checks whether an element originates from a slide layout or slide master.
 * Template elements have IDs prefixed with "layout-" or "master-".
 */
export function isTemplateElement(element: PptxElement): boolean {
	return element.id.startsWith('layout-') || element.id.startsWith('master-');
}

/**
 * Checks whether an element ID indicates a template (layout or master) element.
 */
export function isTemplateElementId(elementId: string): boolean {
	return elementId.startsWith('layout-') || elementId.startsWith('master-');
}

/**
 * Type-guard that returns `true` if the element can have its text edited inline:
 * a "text" or "shape" element that contains text content (plain string or
 * text segments).
 */
export function isEditableTextElement(element: PptxElement): element is PptxElementWithText {
	if (element.type !== 'text' && element.type !== 'shape') {
		return false;
	}
	return (
		element.type === 'text' ||
		typeof element.text === 'string' ||
		(element.textSegments?.length ?? 0) > 0
	);
}

/**
 * Returns a human-readable label for an element, suitable for the selection
 * pane, accessibility tree, or a tooltip (e.g. "Text", "Image", "Group (3)").
 */
export function getElementLabel(element: PptxElement): string {
	if (element.type === 'text') {
		return 'Text';
	}
	if (element.type === 'connector') {
		return 'Connector';
	}
	if (element.type === 'image' || element.type === 'picture') {
		return 'Image';
	}
	if (element.type === 'chart') {
		return 'Chart';
	}
	if (element.type === 'table') {
		return 'Table';
	}
	if (element.type === 'smartArt') {
		return 'SmartArt';
	}
	if (element.type === 'ole') {
		const ole = element as OlePptxElement;
		if (ole.oleName) {
			return ole.oleName;
		}
		if (ole.fileName) {
			return ole.fileName;
		}
		return 'Embedded Object';
	}
	if (element.type === 'media') {
		return 'Media';
	}
	if (element.type === 'ink') {
		return 'Drawing';
	}
	if (element.type === 'contentPart') {
		return 'Content Part';
	}
	if (element.type === 'model3d') {
		return '3D Model';
	}
	if (element.type === 'group') {
		return `Group (${(element as GroupPptxElement).children?.length ?? 0})`;
	}
	return 'Shape';
}

/**
 * Formats a raw ISO/date-string timestamp into a short localized display
 * format. Returns an empty string if the value is missing or unparseable.
 */
export function formatCommentTimestamp(value: string | undefined): string {
	const normalized = String(value || '').trim();
	if (normalized.length === 0) {
		return '';
	}
	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime())) {
		return '';
	}

	return parsed.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

/**
 * Computes the rendered position for a comment marker icon on the slide canvas.
 * Explicit comment x/y (clamped to the slide) win; otherwise a 4-column grid
 * fallback keyed off the comment index keeps markers from overlapping.
 */
export function getCommentMarkerPosition(
	comment: PptxComment,
	index: number,
	width: number,
	height: number,
): { x: number; y: number } {
	const fallbackX = 18 + (index % 4) * 14;
	const fallbackY = 18 + Math.floor(index / 4) * 14;
	const rawX = typeof comment.x === 'number' && Number.isFinite(comment.x) ? comment.x : fallbackX;
	const rawY = typeof comment.y === 'number' && Number.isFinite(comment.y) ? comment.y : fallbackY;

	return {
		x: Math.min(Math.max(rawX, 8), Math.max(width - 8, 8)),
		y: Math.min(Math.max(rawY, 8), Math.max(height - 8, 8)),
	};
}

/**
 * Returns the absolute position of a connection site on an element.
 *
 * Connection sites are numbered 0-3 following the OOXML convention:
 *   0 = top-centre, 1 = right-centre, 2 = bottom-centre, 3 = left-centre.
 *
 * Returns `undefined` for out-of-range site indices.
 */
export function getConnectionSitePosition(
	element: PptxElement,
	siteIndex: number,
): { x: number; y: number } | undefined {
	switch (siteIndex) {
		case 0:
			return { x: element.x + element.width / 2, y: element.y };
		case 1:
			return {
				x: element.x + element.width,
				y: element.y + element.height / 2,
			};
		case 2:
			return {
				x: element.x + element.width / 2,
				y: element.y + element.height,
			};
		case 3:
			return { x: element.x, y: element.y + element.height / 2 };
		default:
			return undefined;
	}
}
