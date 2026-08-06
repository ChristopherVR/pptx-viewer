import type { PptxData } from '../../core/types';
import {
	deserializePptxFromJson,
	parsePptxJson,
	parsePptxJsonDocument,
	pptxDataFromJsonDocument,
} from './json-deserializer';
import { decodePptxJsonText, isPptxJsonText } from './json-document';
import type { PptxJsonDocument } from './json-document';
import { buildPptxJsonDocument, serializePptxToJson } from './json-serializer';
import type { PptxJsonSerializeOptions } from './json-serializer';
import { PRESENTATION_FIELD_NAMES } from './presentation-field-keys';

/** Options for a {@link PptxJsonConverter} instance. */
export interface PptxJsonConverterOptions extends PptxJsonSerializeOptions {
	/** Pretty-print JSON output with 2-space indentation. */
	pretty?: boolean;
}

/**
 * Converts a parsed {@link PptxData} presentation to and from the portable
 * `pptx-viewer-json` document format.
 *
 * Sibling of {@link PptxMarkdownConverter}: where the markdown converter
 * produces a lossy human-readable rendition, this converter produces a
 * lossless (model-level), versioned, self-contained JSON document that can
 * be re-imported without the original `.pptx` archive.
 *
 * @example
 * ```ts
 * const converter = new PptxJsonConverter({ generator: 'my-app' });
 * const json = converter.toJson(pptxData);
 * const roundTripped = converter.fromJson(json);
 * ```
 */
export class PptxJsonConverter {
	public constructor(private readonly options: PptxJsonConverterOptions = {}) {}

	/** Serialize a presentation into a structured JSON document. */
	public toDocument(data: PptxData): PptxJsonDocument {
		return buildPptxJsonDocument(data, this.options);
	}

	/** Serialize a presentation straight to JSON text. */
	public toJson(data: PptxData): string {
		return serializePptxToJson(data, this.options);
	}

	/** Validate an arbitrary parsed JSON value as a document. */
	public parseDocument(value: unknown): PptxJsonDocument {
		return parsePptxJsonDocument(value);
	}

	/** Rebuild the presentation model from JSON text (parse + validate). */
	public fromJson(text: string): PptxData {
		return deserializePptxFromJson(text);
	}

	/** Rebuild the presentation model from a validated document. */
	public fromDocument(document: PptxJsonDocument): PptxData {
		return pptxDataFromJsonDocument(document);
	}

	/** Static counterpart of {@link fromJson}. */
	public static fromJson(text: string): PptxData {
		return deserializePptxFromJson(text);
	}

	/** Static counterpart of {@link toJson}. */
	public static toJson(data: PptxData, options: PptxJsonConverterOptions = {}): string {
		return serializePptxToJson(data, options);
	}

	/** Parse and validate JSON text as a document without rebuilding the model. */
	public static parse(text: string): PptxJsonDocument {
		return parsePptxJson(text);
	}

	/** Cheap text-level sniff for the format marker. */
	public static isPptxJsonText(text: string): boolean {
		return isPptxJsonText(text);
	}

	/** Byte-level sniff + decode; `null` for non-JSON (e.g. ZIP) input. */
	public static decodeText(data: ArrayBuffer | Uint8Array): string | null {
		return decodePptxJsonText(data);
	}
}

/**
 * Overlay an imported presentation onto a freshly loaded base presentation
 * (typically a blank one generated for JSON import): every presentation-level
 * field defined on `imported` wins, fields it lacks keep the base value (so a
 * blank deck's theme scaffolding survives when the document carries none),
 * and the slide array is replaced wholesale. Mutates and returns `base`.
 */
export function applyImportedPptxData(base: PptxData, imported: PptxData): PptxData {
	const target = base as unknown as Record<string, unknown>;
	const source = imported as unknown as Record<string, unknown>;
	for (const key of PRESENTATION_FIELD_NAMES) {
		if (source[key] !== undefined) {
			target[key] = source[key];
		}
	}
	base.slides = imported.slides;
	return base;
}
