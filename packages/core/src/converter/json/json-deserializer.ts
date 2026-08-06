import { ELEMENT_FIELD_KIND, SLIDE_FIELD_KIND } from '../../core/types';
import type { PptxData, PptxElement, PptxSlide } from '../../core/types';
import { decodeJsonValue } from './json-binary-codec';
import { PPTX_JSON_FORMAT, PPTX_JSON_VERSION } from './json-document';
import type { PptxJsonAssetStats, PptxJsonDocument } from './json-document';
import { PRESENTATION_FIELD_NAMES } from './presentation-field-keys';

/** Error thrown when a candidate document fails `pptx-viewer-json` validation. */
export class PptxJsonFormatError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'PptxJsonFormatError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
	throw new PptxJsonFormatError(message);
}

/**
 * Validate an arbitrary parsed JSON value as a `pptx-viewer-json` document.
 * Performs structural narrowing only (no `any`, no blind casts on the
 * envelope): the format marker, version, slide array, per-slide element
 * arrays, and per-element `type` discriminants are all checked.
 */
export function parsePptxJsonDocument(value: unknown): PptxJsonDocument {
	if (!isRecord(value)) {
		fail('Not a pptx-viewer-json document: expected a JSON object at the top level.');
	}
	if (value.format !== PPTX_JSON_FORMAT) {
		fail(`Not a pptx-viewer-json document: missing format marker "${PPTX_JSON_FORMAT}".`);
	}
	if (value.version !== PPTX_JSON_VERSION) {
		fail(
			`Unsupported pptx-viewer-json version ${String(value.version)}; ` +
				`this build supports version ${PPTX_JSON_VERSION}.`,
		);
	}
	const presentation = value.presentation;
	if (!isRecord(presentation)) {
		fail('Invalid pptx-viewer-json document: "presentation" must be an object.');
	}
	const slides = value.slides;
	if (!Array.isArray(slides)) {
		fail('Invalid pptx-viewer-json document: "slides" must be an array.');
	}
	const validatedSlides: Array<Record<string, unknown>> = slides.map((slide, index) => {
		if (!isRecord(slide)) {
			fail(`Invalid pptx-viewer-json document: slide ${index} is not an object.`);
		}
		const elements = slide.elements;
		if (elements !== undefined && !Array.isArray(elements)) {
			fail(`Invalid pptx-viewer-json document: slide ${index} "elements" must be an array.`);
		}
		for (const [elementIndex, element] of (elements ?? []).entries()) {
			if (!isRecord(element) || typeof element.type !== 'string' || element.type.length === 0) {
				fail(
					`Invalid pptx-viewer-json document: slide ${index} element ${elementIndex} ` +
						'must be an object with a string "type" discriminant.',
				);
			}
		}
		return slide;
	});
	if (typeof value.slideCount === 'number' && value.slideCount !== validatedSlides.length) {
		fail(
			`Invalid pptx-viewer-json document: slideCount ${value.slideCount} does not match ` +
				`${validatedSlides.length} slides.`,
		);
	}

	const document: PptxJsonDocument = {
		format: PPTX_JSON_FORMAT,
		version: PPTX_JSON_VERSION,
		slideCount: validatedSlides.length,
		assets: normalizeAssetStats(value.assets),
		presentation,
		slides: validatedSlides,
	};
	if (typeof value.generator === 'string') {
		document.generator = value.generator;
	}
	if (typeof value.createdAt === 'string') {
		document.createdAt = value.createdAt;
	}
	return document;
}

/** Parse and validate JSON text as a `pptx-viewer-json` document. */
export function parsePptxJson(text: string): PptxJsonDocument {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch (error) {
		fail(`Not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
	return parsePptxJsonDocument(raw);
}

/**
 * Rebuild a {@link PptxData} model from a validated document. Field coverage
 * mirrors serialization: only fields present in the canonical inventories are
 * accepted, and tagged binary payloads are decoded back to `Uint8Array`.
 */
export function pptxDataFromJsonDocument(document: PptxJsonDocument): PptxData {
	const data: Record<string, unknown> = {};
	for (const key of PRESENTATION_FIELD_NAMES) {
		const value = document.presentation[key];
		if (value !== undefined) {
			data[key] = decodeJsonValue(value);
		}
	}
	if (typeof data.width !== 'number' || typeof data.height !== 'number') {
		fail('Invalid pptx-viewer-json document: presentation "width"/"height" must be numbers.');
	}
	data.slides = document.slides.map((slide) => deserializeSlide(slide));
	return data as unknown as PptxData;
}

/** Convenience: parse, validate, and rebuild in one step. */
export function deserializePptxFromJson(text: string): PptxData {
	return pptxDataFromJsonDocument(parsePptxJson(text));
}

function deserializeSlide(encoded: Record<string, unknown>): PptxSlide {
	const slide: Record<string, unknown> = {};
	for (const key of Object.keys(SLIDE_FIELD_KIND)) {
		if (key === 'elements') {
			continue;
		}
		const value = encoded[key];
		if (value !== undefined) {
			slide[key] = decodeJsonValue(value);
		}
	}
	const elements = Array.isArray(encoded.elements) ? encoded.elements : [];
	slide.elements = elements.map((element) =>
		deserializeElement(element as Record<string, unknown>),
	);
	return slide as unknown as PptxSlide;
}

function deserializeElement(encoded: Record<string, unknown>): PptxElement {
	const element: Record<string, unknown> = {};
	for (const key of Object.keys(ELEMENT_FIELD_KIND)) {
		const value = encoded[key];
		if (value !== undefined) {
			element[key] = decodeJsonValue(value);
		}
	}
	return element as unknown as PptxElement;
}

function normalizeAssetStats(value: unknown): PptxJsonAssetStats {
	if (isRecord(value) && typeof value.count === 'number' && typeof value.totalBytes === 'number') {
		return { count: value.count, totalBytes: value.totalBytes };
	}
	return { count: 0, totalBytes: 0 };
}
