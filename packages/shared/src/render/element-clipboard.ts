/**
 * element-clipboard.ts: framework-agnostic cut/copy/paste codec for slide
 * elements.
 *
 * Two layers, shared by every binding's clipboard handlers:
 *
 * 1. In-memory payload: {@link buildElementClipboardPayload} deep-clones the
 *    copied element (so later edits never mutate the clipboard) and
 *    {@link cloneElementForPaste} produces the pasted clone with a fresh id
 *    (template-prefix aware, see {@link makeCloneId}) and the standard
 *    {@link PASTE_OFFSET_PX} cascade offset.
 * 2. String codec: {@link serializeElementClipboard} /
 *    {@link deserializeElementClipboard} convert elements to/from a marked,
 *    versioned JSON string so bindings can round-trip elements through the
 *    system clipboard (or postMessage). Binary fields (e.g. an embedded chart
 *    workbook `Uint8Array`) are base64-tagged so they survive the round trip;
 *    unknown or foreign clipboard text is rejected with `null`.
 *
 * @module render/element-clipboard
 */
import type { PptxElement } from 'pptx-viewer-core';

/** MIME type bindings should use when writing the payload as a custom clipboard format. */
export const ELEMENT_CLIPBOARD_MIME_TYPE = 'application/x-pptx-viewer-elements+json';

/** Marker identifying a serialized element-clipboard payload. */
export const ELEMENT_CLIPBOARD_MARKER = 'pptx-viewer/elements';

/** Current codec version; {@link deserializeElementClipboard} rejects others. */
export const ELEMENT_CLIPBOARD_VERSION = 1;

/** Standard paste/duplicate cascade offset in px (applied to both axes). */
export const PASTE_OFFSET_PX = 20;

/** In-memory clipboard payload stored when an element is copied or cut. */
export interface ElementClipboardPayload {
	element: PptxElement;
	isTemplate: boolean;
}

/** Decoded multi-element clipboard data produced by the string codec. */
export interface ElementClipboardData {
	elements: PptxElement[];
	isTemplate: boolean;
}

/** Options for {@link cloneElementForPaste} / {@link prepareElementsForPaste}. */
export interface PasteCloneOptions {
	/**
	 * Whether the clone is inserted into the template (master/layout) store, so
	 * its fresh id must keep a template prefix (see {@link makeCloneId}).
	 */
	intoTemplate?: boolean;
	/** Horizontal paste offset in px (default {@link PASTE_OFFSET_PX}). */
	offsetX?: number;
	/** Vertical paste offset in px (default {@link PASTE_OFFSET_PX}). */
	offsetY?: number;
}

/** Generate a unique element id (`el-<timestamp>-<random>`). */
export function generateElementId(): string {
	return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build the id for a pasted / duplicated clone so that it routes to the same
 * store it is inserted into.
 *
 * In edit-template mode the clone lands in the template store, so it must keep
 * a template (`master-` / `layout-`) prefix; otherwise later edits (which route
 * by id prefix) would target the wrong store and be lost. Outside template mode
 * a normal id is generated.
 */
export function makeCloneId(intoTemplate: boolean, sourceId: string): string {
	if (!intoTemplate) {
		return generateElementId();
	}
	if (sourceId.startsWith('master-')) {
		return `master-${generateElementId()}`;
	}
	return `layout-${generateElementId()}`;
}

/**
 * Snapshot a copied/cut element into the in-memory clipboard payload.
 * Deep-clones so later canvas edits never mutate the clipboard content.
 */
export function buildElementClipboardPayload(
	element: PptxElement,
	isTemplate: boolean,
): ElementClipboardPayload {
	return { element: structuredClone(element), isTemplate };
}

/**
 * Produce the clone inserted by paste/duplicate: a deep copy with a fresh
 * (template-prefix aware) id and the standard cascade offset applied.
 */
export function cloneElementForPaste(
	element: PptxElement,
	options: PasteCloneOptions = {},
): PptxElement {
	const clone = structuredClone(element);
	clone.id = makeCloneId(options.intoTemplate ?? false, element.id);
	clone.x += options.offsetX ?? PASTE_OFFSET_PX;
	clone.y += options.offsetY ?? PASTE_OFFSET_PX;
	return clone;
}

/** Clone every element in decoded clipboard data for insertion (fresh ids + offset). */
export function prepareElementsForPaste(
	data: ElementClipboardData,
	options: PasteCloneOptions = {},
): PptxElement[] {
	return data.elements.map((element) => cloneElementForPaste(element, options));
}

/** Tag used to mark base64-encoded binary fields inside the JSON payload. */
const BINARY_TAG = '__pptxU8';

function uint8ToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Serialize elements to the marked, versioned JSON clipboard string.
 * `Uint8Array` fields anywhere in the element tree (embedded workbooks, raw
 * part bytes) are base64-tagged so they survive the text round trip.
 */
export function serializeElementClipboard(
	elements: PptxElement[],
	isTemplate: boolean = false,
): string {
	return JSON.stringify(
		{
			marker: ELEMENT_CLIPBOARD_MARKER,
			version: ELEMENT_CLIPBOARD_VERSION,
			isTemplate,
			elements,
		},
		(_key, value: unknown) => {
			if (value instanceof Uint8Array) {
				return { [BINARY_TAG]: uint8ToBase64(value) };
			}
			return value;
		},
	);
}

function isElementLike(value: unknown): value is PptxElement {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.id === 'string' &&
		typeof candidate.type === 'string' &&
		typeof candidate.x === 'number' &&
		typeof candidate.y === 'number' &&
		typeof candidate.width === 'number' &&
		typeof candidate.height === 'number'
	);
}

/**
 * Decode a clipboard string produced by {@link serializeElementClipboard}.
 * Returns `null` for anything else (foreign clipboard text, malformed JSON,
 * wrong marker/version, or structurally invalid elements), so callers can fall
 * back to their plain-text paste path.
 */
export function deserializeElementClipboard(text: string): ElementClipboardData | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text, (_key, value: unknown) => {
			if (typeof value === 'object' && value !== null) {
				const tagged = (value as Record<string, unknown>)[BINARY_TAG];
				if (typeof tagged === 'string') {
					return base64ToUint8(tagged);
				}
			}
			return value;
		});
	} catch {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null) {
		return null;
	}
	const candidate = parsed as Record<string, unknown>;
	if (
		candidate.marker !== ELEMENT_CLIPBOARD_MARKER ||
		candidate.version !== ELEMENT_CLIPBOARD_VERSION ||
		!Array.isArray(candidate.elements) ||
		candidate.elements.length === 0 ||
		!candidate.elements.every(isElementLike)
	) {
		return null;
	}
	return {
		elements: candidate.elements,
		isTemplate: candidate.isTemplate === true,
	};
}
