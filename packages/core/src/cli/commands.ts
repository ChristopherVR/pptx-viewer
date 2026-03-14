/**
 * CLI command handlers for pptx-cli.
 *
 * Each handler is a standalone async function that accepts parsed
 * arguments and returns a result object. This separation from the
 * CLI entry-point allows programmatic reuse and testability.
 *
 * @module cli/commands
 */

import { PptxHandler } from "../core/PptxHandler";
import { PptxMarkdownConverter } from "../converter/PptxMarkdownConverter";
import { SvgExporter } from "../converter/SvgExporter";
import { mergePresentation } from "../core/builders/sdk/merge-operations";
import { findText, replaceText } from "../core/builders/sdk/text-operations";
import type { PptxData, PptxSlide } from "../core/types/presentation";
import type { PptxElement } from "../core/types/elements";
import type { FindResult } from "../core/builders/sdk/text-operations";
import type { MergeOptions } from "../core/builders/sdk/merge-operations";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Result from the `info` command. */
export interface InfoResult {
	slideCount: number;
	width: number;
	height: number;
	widthEmu?: number;
	heightEmu?: number;
	slideSizeType?: string;
	title?: string;
	creator?: string;
	subject?: string;
	themeName?: string;
	majorFont?: string;
	minorFont?: string;
	layoutCount: number;
	layouts: string[];
	sectionCount: number;
	sections: string[];
	hasMacros: boolean;
	hasDigitalSignatures: boolean;
	embeddedFontCount: number;
	customShowCount: number;
	totalElements: number;
	hiddenSlideCount: number;
	notesCount: number;
	commentCount: number;
}

/** Result from the `export-svg` command. */
export interface ExportSvgResult {
	slideCount: number;
	svgs: string[];
}

/** Result from the `export-md` command. */
export interface ExportMdResult {
	markdown: string;
	slideCount: number;
}

/** Result from the `merge` command. */
export interface MergeResult {
	mergedSlideCount: number;
	totalSlideCount: number;
	outputBytes: Uint8Array;
}

/** Result from the `find` command. */
export interface FindCommandResult {
	matches: FindResult[];
	totalCount: number;
}

/** Result from the `replace` command. */
export interface ReplaceResult {
	replacementCount: number;
	outputBytes: Uint8Array;
}

/** Result from the `create` command. */
export interface CreateResult {
	outputBytes: Uint8Array;
	slideCount: number;
}

/** A single slide's diff entry. */
export interface SlideDiffEntry {
	slideNumber: number;
	status: "added" | "removed" | "modified" | "unchanged";
	elementCountA?: number;
	elementCountB?: number;
	textDifferences?: string[];
}

/** Result from the `diff` command. */
export interface DiffResult {
	slideCountA: number;
	slideCountB: number;
	dimensionsMatch: boolean;
	themeMatch: boolean;
	slideDiffs: SlideDiffEntry[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load a PPTX from raw bytes and return handler + data.
 */
async function loadPptx(
	bytes: Uint8Array,
): Promise<{ handler: PptxHandler; data: PptxData }> {
	const handler = new PptxHandler();
	const data = await handler.load(bytes.buffer as ArrayBuffer);
	return { handler, data };
}

/**
 * Recursively count elements in a slide (including group children).
 */
function countElements(elements: PptxElement[]): number {
	let count = 0;
	for (const el of elements) {
		count++;
		if (el.type === "group" && "children" in el) {
			count += countElements(
				(el as PptxElement & { children: PptxElement[] }).children,
			);
		}
	}
	return count;
}

/**
 * Extract all text from a slide's elements (recursively).
 */
function extractSlideText(elements: PptxElement[]): string[] {
	const texts: string[] = [];
	for (const el of elements) {
		if ("text" in el && typeof (el as { text?: string }).text === "string") {
			const text = (el as { text: string }).text;
			if (text.trim()) {
				texts.push(text);
			}
		}
		if (el.type === "group" && "children" in el) {
			texts.push(
				...extractSlideText(
					(el as PptxElement & { children: PptxElement[] }).children,
				),
			);
		}
	}
	return texts;
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

/**
 * Show presentation info (slides, dimensions, theme, metadata).
 */
export async function handleInfo(bytes: Uint8Array): Promise<InfoResult> {
	const { data } = await loadPptx(bytes);

	let totalElements = 0;
	let hiddenSlideCount = 0;
	let notesCount = 0;
	let commentCount = 0;

	for (const slide of data.slides) {
		totalElements += countElements(slide.elements);
		if (slide.hidden) hiddenSlideCount++;
		if (slide.notes) notesCount++;
		if (slide.comments) commentCount += slide.comments.length;
	}

	return {
		slideCount: data.slides.length,
		width: data.width,
		height: data.height,
		widthEmu: data.widthEmu,
		heightEmu: data.heightEmu,
		slideSizeType: data.slideSizeType,
		title: data.coreProperties?.title,
		creator: data.coreProperties?.creator,
		subject: data.coreProperties?.subject,
		themeName: data.theme?.name,
		majorFont: data.theme?.fontScheme?.majorFont?.latin,
		minorFont: data.theme?.fontScheme?.minorFont?.latin,
		layoutCount: data.layoutOptions?.length ?? 0,
		layouts: (data.layoutOptions ?? []).map((l) => l.name),
		sectionCount: data.sections?.length ?? 0,
		sections: (data.sections ?? []).map((s) => s.name),
		hasMacros: data.hasMacros ?? false,
		hasDigitalSignatures: data.hasDigitalSignatures ?? false,
		embeddedFontCount: data.embeddedFonts?.length ?? 0,
		customShowCount: data.customShows?.length ?? 0,
		totalElements,
		hiddenSlideCount,
		notesCount,
		commentCount,
	};
}

/**
 * Export all slides as SVG strings.
 */
export async function handleExportSvg(
	bytes: Uint8Array,
	options?: { slideIndices?: number[]; includeHidden?: boolean },
): Promise<ExportSvgResult> {
	const { data } = await loadPptx(bytes);

	const svgs = SvgExporter.exportAll(data, {
		slideIndices: options?.slideIndices,
		includeHidden: options?.includeHidden,
	});

	return {
		slideCount: svgs.length,
		svgs,
	};
}

/**
 * Export presentation to Markdown.
 */
export async function handleExportMd(
	bytes: Uint8Array,
	options?: {
		sourceName?: string;
		includeSpeakerNotes?: boolean;
		semanticMode?: boolean;
		slideRange?: { start?: number; end?: number };
	},
): Promise<ExportMdResult> {
	const { data } = await loadPptx(bytes);

	const converter = new PptxMarkdownConverter("/output", {
		sourceName: options?.sourceName ?? "presentation.pptx",
		includeSpeakerNotes: options?.includeSpeakerNotes ?? true,
		semanticMode: options?.semanticMode,
		slideRange: options?.slideRange,
		mediaFolderName: "media",
		includeMetadata: true,
	});

	const markdown = await converter.convert(data);

	return {
		markdown,
		slideCount: data.slides.length,
	};
}

/**
 * Merge two presentations.
 */
export async function handleMerge(
	targetBytes: Uint8Array,
	sourceBytes: Uint8Array,
	options?: MergeOptions,
): Promise<MergeResult> {
	const { handler: targetHandler, data: targetData } =
		await loadPptx(targetBytes);
	const { data: sourceData } = await loadPptx(sourceBytes);

	const mergedCount = mergePresentation(targetData, sourceData, options);
	const outputBytes = await targetHandler.save(targetData.slides);

	return {
		mergedSlideCount: mergedCount,
		totalSlideCount: targetData.slides.length,
		outputBytes,
	};
}

/**
 * Find text in a presentation.
 */
export async function handleFind(
	bytes: Uint8Array,
	search: string,
	options?: { caseSensitive?: boolean },
): Promise<FindCommandResult> {
	const { data } = await loadPptx(bytes);

	const pattern =
		options?.caseSensitive === false
			? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
			: search;

	const matches = findText(data.slides, pattern);

	return {
		matches,
		totalCount: matches.length,
	};
}

/**
 * Replace text in a presentation and return the modified bytes.
 */
export async function handleReplace(
	bytes: Uint8Array,
	search: string,
	replacement: string,
	options?: { caseSensitive?: boolean },
): Promise<ReplaceResult> {
	const { handler, data } = await loadPptx(bytes);

	const pattern =
		options?.caseSensitive === false
			? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
			: search;

	const count = replaceText(data.slides, pattern, replacement);
	const outputBytes = await handler.save(data.slides);

	return {
		replacementCount: count,
		outputBytes,
	};
}

/**
 * Create a new blank presentation.
 */
export async function handleCreate(options?: {
	title?: string;
	creator?: string;
	theme?: {
		name?: string;
		colors?: Record<string, string>;
		fonts?: { majorFont?: string; minorFont?: string };
	};
	width?: number;
	height?: number;
}): Promise<CreateResult> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: options?.title,
		creator: options?.creator,
		width: options?.width,
		height: options?.height,
		theme: options?.theme
			? {
					name: options.theme.name,
					colors: options.theme.colors as Record<string, string> | undefined,
					fonts: options.theme.fonts,
				}
			: undefined,
	});

	// Add a blank title slide
	data.slides.push(createSlide("Title Slide").build());

	const outputBytes = await handler.save(data.slides);

	return {
		outputBytes,
		slideCount: data.slides.length,
	};
}

/**
 * Compare two presentations and return a diff summary.
 */
export async function handleDiff(
	bytesA: Uint8Array,
	bytesB: Uint8Array,
): Promise<DiffResult> {
	const { data: dataA } = await loadPptx(bytesA);
	const { data: dataB } = await loadPptx(bytesB);

	const dimensionsMatch =
		dataA.width === dataB.width && dataA.height === dataB.height;
	const themeMatch =
		(dataA.theme?.name ?? "") === (dataB.theme?.name ?? "");

	const maxSlides = Math.max(dataA.slides.length, dataB.slides.length);
	const slideDiffs: SlideDiffEntry[] = [];

	for (let i = 0; i < maxSlides; i++) {
		const slideA: PptxSlide | undefined = dataA.slides[i];
		const slideB: PptxSlide | undefined = dataB.slides[i];

		if (!slideA && slideB) {
			slideDiffs.push({
				slideNumber: i + 1,
				status: "added",
				elementCountB: countElements(slideB.elements),
			});
			continue;
		}

		if (slideA && !slideB) {
			slideDiffs.push({
				slideNumber: i + 1,
				status: "removed",
				elementCountA: countElements(slideA.elements),
			});
			continue;
		}

		if (slideA && slideB) {
			const textsA = extractSlideText(slideA.elements);
			const textsB = extractSlideText(slideB.elements);
			const elemCountA = countElements(slideA.elements);
			const elemCountB = countElements(slideB.elements);

			const textA = textsA.sort().join("\n");
			const textB = textsB.sort().join("\n");

			const textDifferences: string[] = [];

			// Find texts in A not in B
			for (const t of textsA) {
				if (!textsB.includes(t)) {
					textDifferences.push(`- ${t}`);
				}
			}
			// Find texts in B not in A
			for (const t of textsB) {
				if (!textsA.includes(t)) {
					textDifferences.push(`+ ${t}`);
				}
			}

			const isModified =
				elemCountA !== elemCountB ||
				textA !== textB ||
				slideA.backgroundColor !== slideB.backgroundColor ||
				slideA.layoutName !== slideB.layoutName;

			slideDiffs.push({
				slideNumber: i + 1,
				status: isModified ? "modified" : "unchanged",
				elementCountA: elemCountA,
				elementCountB: elemCountB,
				textDifferences:
					textDifferences.length > 0 ? textDifferences : undefined,
			});
		}
	}

	return {
		slideCountA: dataA.slides.length,
		slideCountB: dataB.slides.length,
		dimensionsMatch,
		themeMatch,
		slideDiffs,
	};
}
