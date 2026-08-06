import { ELEMENT_FIELD_KIND, SLIDE_FIELD_KIND } from '../../core/types';
import type { PptxData, PptxElement, PptxSlide } from '../../core/types';
import { encodeJsonValue } from './json-binary-codec';
import type { JsonAssetAccumulator } from './json-binary-codec';
import { PPTX_JSON_FORMAT, PPTX_JSON_VERSION } from './json-document';
import type { PptxJsonDocument } from './json-document';
import { PRESENTATION_FIELD_NAMES } from './presentation-field-keys';

/** Options for {@link buildPptxJsonDocument}. */
export interface PptxJsonSerializeOptions {
	/** Producer identifier written into the `generator` field. */
	generator?: string;
	/**
	 * Whether to stamp `createdAt` with the current time. Defaults to `true`;
	 * disable for byte-stable output (e.g. snapshot tests).
	 */
	includeTimestamp?: boolean;
}

const SLIDE_FIELD_NAMES = Object.keys(SLIDE_FIELD_KIND);
const ELEMENT_FIELD_NAMES = Object.keys(ELEMENT_FIELD_KIND);

/**
 * Serialize a parsed presentation into a versioned, self-contained
 * `pptx-viewer-json` document. Binary payloads (thumbnails, embedded fonts,
 * chart workbooks) are embedded as tagged base64; images and media already
 * live in the model as base64 data URLs and are carried verbatim. Field
 * coverage is driven by the canonical inventories (`SLIDE_FIELD_KIND`,
 * `ELEMENT_FIELD_KIND`, `PRESENTATION_FIELD_KEYS`) so no model field is
 * silently dropped.
 */
export function buildPptxJsonDocument(
	data: PptxData,
	options: PptxJsonSerializeOptions = {},
): PptxJsonDocument {
	const stats: JsonAssetAccumulator = { count: 0, totalBytes: 0 };

	const source = data as unknown as Record<string, unknown>;
	const presentation: Record<string, unknown> = {};
	for (const key of PRESENTATION_FIELD_NAMES) {
		const value = source[key];
		if (value !== undefined) {
			presentation[key] = encodeJsonValue(value, stats);
		}
	}

	const slides = data.slides.map((slide) => serializeSlide(slide, stats));

	const document: PptxJsonDocument = {
		format: PPTX_JSON_FORMAT,
		version: PPTX_JSON_VERSION,
		slideCount: slides.length,
		assets: { count: stats.count, totalBytes: stats.totalBytes },
		presentation,
		slides,
	};
	if (options.generator !== undefined) {
		document.generator = options.generator;
	}
	if (options.includeTimestamp !== false) {
		document.createdAt = new Date().toISOString();
	}
	return document;
}

/** Serialize a presentation straight to JSON text. */
export function serializePptxToJson(
	data: PptxData,
	options: PptxJsonSerializeOptions & { pretty?: boolean } = {},
): string {
	const document = buildPptxJsonDocument(data, options);
	return JSON.stringify(document, null, options.pretty ? 2 : undefined);
}

function serializeSlide(slide: PptxSlide, stats: JsonAssetAccumulator): Record<string, unknown> {
	const source = slide as unknown as Record<string, unknown>;
	const encoded: Record<string, unknown> = {};
	for (const key of SLIDE_FIELD_NAMES) {
		if (key === 'elements') {
			continue;
		}
		const value = source[key];
		if (value !== undefined) {
			encoded[key] = encodeJsonValue(value, stats);
		}
	}
	encoded.elements = slide.elements.map((element) => serializeElement(element, stats));
	return encoded;
}

function serializeElement(
	element: PptxElement,
	stats: JsonAssetAccumulator,
): Record<string, unknown> {
	const source = element as unknown as Record<string, unknown>;
	const encoded: Record<string, unknown> = {};
	for (const key of ELEMENT_FIELD_NAMES) {
		const value = source[key];
		if (value !== undefined) {
			encoded[key] = encodeJsonValue(value, stats);
		}
	}
	return encoded;
}
