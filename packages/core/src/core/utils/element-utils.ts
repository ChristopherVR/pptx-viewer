/**
 * Framework-agnostic element utility functions.
 *
 * Provides identity checks, text extraction, ID generation, and
 * miscellaneous helpers used throughout the PPTX editor.
 *
 * XML builders live in `./element-xml-builders.ts`;
 * action helpers live in `./element-actions.ts`.
 *
 * @module element-utils
 */
import type { PptxElement, PptxElementWithText, TextSegment, TextStyle } from '../types';
import { hasTextProperties } from '../types';
import { cloneTextStyle } from './clone-utils';

// ---------------------------------------------------------------------------
// Element identity helpers
// ---------------------------------------------------------------------------

/**
 * Check whether an element is a template element (from a slide layout
 * or slide master). Template elements have IDs prefixed with
 * `"layout-"` or `"master-"`.
 *
 * @param element - The element to check.
 * @returns `true` if the element originates from a layout or master slide.
 */
export function isTemplateElement(element: PptxElement): boolean {
	return element.id.startsWith('layout-') || element.id.startsWith('master-');
}

/**
 * Type guard that checks whether an element supports text editing.
 *
 * Only `"text"` and `"shape"` elements can contain editable text.
 * A shape qualifies if it has a `text` property or non-empty `textSegments`.
 *
 * @param element - The element to check.
 * @returns `true` if the element is a text-bearing element.
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
 * Return a human-readable label for an element based on its type.
 * Used in the UI for selection panes, accessibility labels, etc.
 *
 * @param element - The element to label.
 * @returns A display string such as `"Text"`, `"Image"`, `"Chart"`, etc.
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
		return 'Embedded Object';
	}
	if (element.type === 'media') {
		return 'Media';
	}

	return 'Shape';
}

/**
 * Determine whether an element should show a fallback type label
 * on the canvas (e.g. "Chart", "SmartArt") because it cannot be
 * rendered natively.
 *
 * Text elements, shapes, connectors, images, and tables have their
 * own renderers and never need a fallback label.
 *
 * @param element - The element to check.
 * @param isTextElement - Whether this element is a text element (pre-computed for performance).
 * @returns `true` if a fallback label should be displayed.
 */
export function shouldRenderFallbackLabel(element: PptxElement, isTextElement: boolean): boolean {
	if (isTextElement) {
		return false;
	}
	if (element.type === 'shape' || element.type === 'connector') {
		return false;
	}
	if (element.type === 'picture' || element.type === 'image') {
		return false;
	}
	if (element.type === 'table') {
		return false;
	}
	return (
		element.type === 'chart' ||
		element.type === 'smartArt' ||
		element.type === 'ole' ||
		element.type === 'media' ||
		element.type === 'unknown'
	);
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Extract the plain-text content of an element by concatenating
 * all text segments. Returns an empty string for non-text elements.
 *
 * @param element - The element to extract text from.
 * @returns The concatenated text content.
 */
export function getElementTextContent(element: PptxElement): string {
	if (!hasTextProperties(element)) {
		return '';
	}
	if (typeof element.text === 'string') {
		return element.text;
	}
	if (!element.textSegments || element.textSegments.length === 0) {
		return '';
	}
	return element.textSegments.map((segment) => String(segment.text || '')).join('');
}

/**
 * Create a single-segment text segments array with the given text
 * and a cloned copy of the style.
 *
 * Useful when replacing all text in an element with new uniform content.
 *
 * @param text - The text content.
 * @param style - The text style to apply (will be cloned).
 * @returns An array containing one TextSegment.
 */
export function createUniformTextSegments(
	text: string,
	style: TextStyle | undefined,
): TextSegment[] {
	return [
		{
			text,
			style: cloneTextStyle(style) || {},
		},
	];
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique editor element ID using a prefix, timestamp, and
 * random suffix. The format is `"{prefix}-{timestamp}-{random}"`.
 *
 * The suffix is base-36 (~2 billion values), not a four-digit number. Ids
 * minted in the same millisecond share the timestamp, so the suffix is the only
 * thing separating them, and a four-digit one is not enough: minting 1000 ids
 * in a loop produced ~46 duplicates. That matters because element ids are
 * written back out as `p:cNvPr/@id`, and a duplicate makes an animation's
 * `p:spTgt/@spid` name two shapes at once. Pasting or ungrouping a group mints
 * one id per descendant in a single tick, which is exactly the burst case.
 *
 * @param prefix - A human-readable prefix (e.g. `"shape"`, `"text"`).
 * @returns A unique ID string.
 */
export function createEditorId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * First `p:cNvPr/@id` handed out by {@link createDrawingObjectId}.
 *
 * Authoring tools number drawing objects from 1 upwards, so real decks occupy
 * the low range. Starting well above it keeps freshly minted ids clear of the
 * ids already in the package without having to read them.
 */
const DRAWING_OBJECT_ID_BASE = 100_000;

let nextDrawingObjectId = DRAWING_OBJECT_ID_BASE;

/**
 * Mint a fresh `p:cNvPr/@id` for a newly created shape, connector, picture or
 * graphic frame.
 *
 * The id must be unique within a slide's `p:spTree`. This used to be
 * `Math.floor(Math.random() * 10000) + 1000`: 9,000 possible values, so a deck
 * gaining a few dozen new shapes collided routinely (the birthday bound puts an
 * even chance of a clash at about 112 shapes). `validateAndDeduplicateIds`
 * caught the collision on the way out, but its repair RENUMBERS one of the two
 * shapes, and an animation's `p:spTgt/@spid` still points at the old number, so
 * the fix silently detached the animation from its target.
 *
 * A monotonic counter cannot collide with itself at all, which removes the
 * renumbering rather than relying on it. The counter is per module instance,
 * i.e. per loaded viewer, which is the scope in which new shapes are created.
 *
 * @returns A strictly increasing integer id, safely inside `ST_DrawingElementId`
 *   (`xsd:unsignedInt`): 2 billion mints in one session would be needed to
 *   approach the limit.
 */
export function createDrawingObjectId(): number {
	nextDrawingObjectId += 1;
	return nextDrawingObjectId;
}

// ---------------------------------------------------------------------------
// Buffer copy
// ---------------------------------------------------------------------------

/**
 * Create a detached copy of a `Uint8Array` as a new `ArrayBuffer`.
 *
 * This is needed when the source bytes come from a shared buffer
 * (e.g. a memory-mapped file) that may be invalidated later.
 *
 * @param bytes - The source byte array.
 * @returns A new `ArrayBuffer` containing a copy of the bytes.
 */
export function createArrayBufferCopy(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

// ---------------------------------------------------------------------------
// Array normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a value that may be a single item, an array, `undefined`,
 * or `null` into a guaranteed array. Useful for handling OOXML nodes
 * that may be a single object or an array depending on child count.
 *
 * @param value - The value to normalise.
 * @returns An array (possibly empty).
 */
export function ensureArrayValue<T>(value: T | T[] | undefined | null): T[] {
	if (!value) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------------------
// Comment helpers
// ---------------------------------------------------------------------------

/**
 * Format a comment timestamp string into a short localised display
 * format (e.g. "Mar 7, 02:30 PM"). Returns an empty string for
 * missing or unparseable timestamps.
 *
 * @param value - An ISO timestamp string or undefined.
 * @returns A formatted date string for display.
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
 * Compute the canvas position for a comment marker icon.
 *
 * Uses the comment's stored position if available, otherwise falls
 * back to a grid layout based on the comment's index. The position
 * is clamped to stay within 8px of the slide edges.
 *
 * @param comment - Object with optional x/y coordinates.
 * @param index - The comment's index (for fallback grid positioning).
 * @param width - Slide width in pixels.
 * @param height - Slide height in pixels.
 * @returns The clamped `{ x, y }` position for the marker.
 */
export function getCommentMarkerPosition(
	comment: { x?: number; y?: number },
	index: number,
	width: number,
	height: number,
): { x: number; y: number } {
	// Fallback: arrange in a 4-column grid near the top-left
	const fallbackX = 18 + (index % 4) * 14;
	const fallbackY = 18 + Math.floor(index / 4) * 14;
	const rawX = typeof comment.x === 'number' && Number.isFinite(comment.x) ? comment.x : fallbackX;
	const rawY = typeof comment.y === 'number' && Number.isFinite(comment.y) ? comment.y : fallbackY;

	// Clamp to stay 8px inside slide edges
	return {
		x: Math.min(Math.max(rawX, 8), Math.max(width - 8, 8)),
		y: Math.min(Math.max(rawY, 8), Math.max(height - 8, 8)),
	};
}

// ---------------------------------------------------------------------------
// File reader helper
// ---------------------------------------------------------------------------

/**
 * Read a `File` object as a base64 data URL using the FileReader API.
 *
 * @param file - The file to read.
 * @returns A promise that resolves to the file's data URL string.
 * @throws {Error} If the file read fails or produces a non-string result.
 */
export async function readFileAsDataUrl(file: File): Promise<string> {
	return await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== 'string') {
				reject(new Error('Failed to read image file.'));
				return;
			}
			resolve(result);
		};
		reader.onerror = () => {
			reject(new Error('Failed to read image file.'));
		};
		reader.readAsDataURL(file);
	});
}
