import type {
	PptxData,
	PptxHeaderFooter,
	PptxCoreProperties,
	PptxAppProperties,
} from '../core';
import { ConversionOptions, DocumentConverter } from './base';
import { SlideProcessor } from './SlideProcessor';
import { TextSegmentRenderer } from './TextSegmentRenderer';
import { ChartElementProcessor } from './elements/ChartElementProcessor';
import { ElementProcessorRegistry } from './elements/ElementProcessor';
import { FallbackElementProcessor } from './elements/FallbackElementProcessor';
import { GroupElementProcessor } from './elements/GroupElementProcessor';
import { ImageElementProcessor } from './elements/ImageElementProcessor';
import { InkElementProcessor } from './elements/InkElementProcessor';
import { MediaElementProcessor } from './elements/MediaElementProcessor';
import { OleElementProcessor } from './elements/OleElementProcessor';
import { SmartArtElementProcessor } from './elements/SmartArtElementProcessor';
import { TableElementProcessor } from './elements/TableElementProcessor';
import { TextElementProcessor } from './elements/TextElementProcessor';

/**
 * Options specific to PPTX-to-Markdown conversion, extending the base
 * {@link ConversionOptions} with presentation-aware settings.
 */
export interface PptxConverterOptions extends ConversionOptions {
	/** Human-readable name of the source file, used in front-matter metadata. */
	sourceName: string;

	/** Whether to append speaker notes (as blockquotes) below each slide. */
	includeSpeakerNotes: boolean;

	/**
	 * Optional 1-based slide range to limit conversion to a subset of the deck.
	 * Omit or leave fields undefined to convert all slides.
	 */
	slideRange?: {
		/** First slide to include (1-based, default 1). */
		start?: number;
		/** Last slide to include (1-based, default = last slide). */
		end?: number;
	};
	/**
	 * When true, emit clean semantic markdown instead of CSS-positioned HTML.
	 * Default is false (positioned HTML layout for slide fidelity).
	 */
	semanticMode?: boolean;
}

/**
 * Converts a parsed {@link PptxData} presentation into a Markdown document.
 *
 * This is the primary entry point for PPTX-to-Markdown conversion. It
 * orchestrates slide processing, media extraction, metadata generation,
 * and output assembly. Each slide element type is handled by a dedicated
 * {@link ElementProcessor} registered in the internal registry.
 *
 * @example
 * ```ts
 * const converter = new PptxMarkdownConverter('/output', {
 *   sourceName: 'deck.pptx',
 *   includeSpeakerNotes: true,
 *   mediaFolderName: 'media',
 *   includeMetadata: true,
 * });
 * const markdown = await converter.convert(pptxData);
 * ```
 */
export class PptxMarkdownConverter extends DocumentConverter<PptxData> {
	/** Renderer for rich-text segments (bold, italic, hyperlinks, etc.). */
	private readonly textRenderer: TextSegmentRenderer;

	/** Registry mapping element types to their dedicated processors. */
	private readonly registry: ElementProcessorRegistry;

	/** Delegate responsible for converting individual slides. */
	private readonly slideProcessor: SlideProcessor;

	/** Number of slides actually converted (after applying the slide range filter). */
	private convertedSlides = 0;

	/** Total number of slides in the source presentation. */
	private totalSlides = 0;

	/**
	 * @param outputDir - Root directory for output files.
	 * @param options - PPTX-specific conversion options.
	 */
	public constructor(outputDir: string, options: PptxConverterOptions) {
		super(outputDir, options);
		this.textRenderer = new TextSegmentRenderer();
		this.registry = new ElementProcessorRegistry();
		this.registerProcessors();
		this.slideProcessor = new SlideProcessor(
			this.registry,
			this.mediaContext,
			this.textRenderer
		);
	}

	/** Returns the number of images extracted and saved during conversion. */
	public get imagesExtracted(): number {
		return this.mediaContext.totalImages;
	}

	/** Returns the media directory path, or `null` if no images were extracted. */
	public get mediaDir(): string | null {
		return this.mediaContext.totalImages > 0
			? this.mediaContext.mediaDir
			: null;
	}

	/** Returns the number of slides that were actually converted. */
	public get slidesConverted(): number {
		return this.convertedSlides;
	}

	/** Returns the total number of slides in the source presentation. */
	public get presentationSlides(): number {
		return this.totalSlides;
	}

	/**
	 * Converts the full PPTX presentation (or a slide subset) into Markdown.
	 *
	 * The conversion pipeline:
	 * 1. Resolves the slide range and selects the target slides.
	 * 2. Processes each slide through {@link SlideProcessor}, producing markdown sections.
	 * 3. Inserts section headings when slides belong to named sections.
	 * 4. Optionally prepends YAML front-matter with document metadata.
	 * 5. Appends header/footer information if present.
	 * 6. Writes the output file if an `outputPath` was configured.
	 *
	 * @param source - The parsed PPTX data structure.
	 * @returns The complete Markdown string.
	 */
	public async convert(source: PptxData): Promise<string> {
		this.totalSlides = source.slides.length;
		const { start, end } = this.resolveRange(source.slides.length);
		const selectedSlides = source.slides.slice(start - 1, end);
		this.convertedSlides = selectedSlides.length;

		const slideSections: string[] = [];
		let currentSection: string | undefined;
		for (const slide of selectedSlides) {
			const sectionLabel = slide.sectionName ?? slide.sectionId;
			if (sectionLabel && sectionLabel !== currentSection) {
				currentSection = sectionLabel;
				slideSections.push(`# ${sectionLabel}`);
			}
			slideSections.push(
				await this.slideProcessor.processSlide(slide, {
					includeSpeakerNotes: this.getOptions().includeSpeakerNotes,
					slideWidth: source.width || 960,
					slideHeight: source.height || 540,
					semanticMode: this.getOptions().semanticMode,
				})
			);
		}

		let markdown = slideSections.join('\n\n---\n\n');

		if (this.options.includeMetadata) {
			const frontMatter = this.buildPptxFrontMatter(source);
			markdown = `${frontMatter}${markdown}`;
		}

		const footer = this.renderHeaderFooter(source.headerFooter);
		if (footer) {
			markdown = `${markdown}\n\n---\n\n${footer}`;
		}

		markdown = markdown.endsWith('\n') ? markdown : `${markdown}\n`;

		if (this.options.outputPath) {
			await this.writeOutput(markdown, this.options.outputPath);
		}

		return markdown;
	}

	/**
	 * Registers all element-type processors into the internal registry.
	 * Each processor handles one or more {@link PptxElement} types
	 * (text, image, table, chart, etc.).
	 */
	private registerProcessors(): void {
		this.registry.register(new TextElementProcessor(this.textRenderer));
		this.registry.register(new ImageElementProcessor());
		this.registry.register(new TableElementProcessor());
		this.registry.register(new ChartElementProcessor());
		this.registry.register(new SmartArtElementProcessor());
		this.registry.register(new GroupElementProcessor());
		this.registry.register(new MediaElementProcessor());
		this.registry.register(new OleElementProcessor());
		this.registry.register(new InkElementProcessor());
		this.registry.register(new FallbackElementProcessor());
	}

	/**
	 * Assembles a YAML front-matter block containing presentation metadata
	 * such as title, author, slide count, theme, dimensions, and more.
	 *
	 * @param source - The parsed PPTX data.
	 * @returns A YAML front-matter string (including `---` delimiters).
	 */
	private buildPptxFrontMatter(source: PptxData): string {
		const meta: Record<string, string | number> = {
			source: this.getOptions().sourceName,
			format: 'pptx',
			slides: source.slides.length,
			converted: new Date().toISOString(),
		};

		this.addCoreProperties(meta, source.coreProperties);
		this.addAppProperties(meta, source.appProperties);

		if (source.width && source.height) {
			meta.dimensions = `${source.width}x${source.height}`;
		}
		if (source.sections && source.sections.length > 0) {
			meta.sections = source.sections.map((s) => s.name).join(', ');
		}

		this.addPresentationMeta(meta, source);

		return this.buildFrontMatter(meta);
	}

	/**
	 * Populates metadata entries from OPC core properties (title, author, subject, etc.).
	 *
	 * @param meta - The metadata dictionary to populate.
	 * @param props - Core document properties from the PPTX file.
	 */
	private addCoreProperties(
		meta: Record<string, string | number>,
		props: PptxCoreProperties | undefined
	): void {
		if (!props) return;
		if (props.title) meta.title = props.title;
		if (props.creator) meta.author = props.creator;
		if (props.subject) meta.subject = props.subject;
		if (props.description) meta.description = props.description;
		if (props.category) meta.category = props.category;
		if (props.lastModifiedBy) meta.lastModifiedBy = props.lastModifiedBy;
		if (props.revision) meta.revision = props.revision;
	}

	/**
	 * Populates metadata entries from application-level properties
	 * (application name, editing time, word/paragraph counts).
	 *
	 * @param meta - The metadata dictionary to populate.
	 * @param props - Application properties from the PPTX file.
	 */
	private addAppProperties(
		meta: Record<string, string | number>,
		props: PptxAppProperties | undefined
	): void {
		if (!props) return;
		if (props.application) meta.application = props.application;
		if (typeof props.totalTime === 'number')
			meta.editingMinutes = props.totalTime;
		if (typeof props.words === 'number') meta.words = props.words;
		if (typeof props.paragraphs === 'number')
			meta.paragraphs = props.paragraphs;
	}

	/**
	 * Adds presentation-level metadata (custom properties, show type, theme,
	 * security warnings, embedded fonts, custom shows) to the front-matter dictionary.
	 *
	 * @param meta - The metadata dictionary to populate.
	 * @param source - The full parsed PPTX data.
	 */
	private addPresentationMeta(
		meta: Record<string, string | number>,
		source: PptxData
	): void {
		if (source.customProperties?.length) {
			meta.customProperties = source.customProperties
				.map((p) => `${p.name}=${p.value}`).join(', ');
		}
		const pp = source.presentationProperties;
		if (pp) {
			if (pp.showType) meta.showType = pp.showType;
			if (pp.loopContinuously) meta.loopContinuously = 'true';
			if (pp.advanceMode) meta.advanceMode = pp.advanceMode;
			if (pp.showWithNarration) meta.narration = 'enabled';
			if (pp.showWithAnimation === false) meta.animation = 'disabled';
		}
		if (source.theme?.name) {
			meta.theme = source.theme.name;
			if (source.theme.fontScheme) {
				const major = source.theme.fontScheme.majorFont?.latin;
				const minor = source.theme.fontScheme.minorFont?.latin;
				if (major || minor) {
					meta.fonts = [major, minor].filter(Boolean).join(', ');
				}
			}
		}
		if (source.isPasswordProtected) meta.warning_passwordProtected = '⚠ yes';
		if (source.hasMacros) meta.warning_macros = '⚠ yes';
		if (source.embeddedFonts?.length) {
			meta.embeddedFonts = source.embeddedFonts
				.map((f) => f.name).join(', ');
		}
		if (source.customShows?.length) {
			meta.customShows = source.customShows
				.map((s) => s.name).join(', ');
		}
	}

	/**
	 * Renders the presentation-level header/footer settings (header text,
	 * footer text, date/time, slide numbers) into a pipe-delimited markdown string.
	 *
	 * @param hf - Header/footer configuration from the presentation.
	 * @returns A formatted string, or an empty string if no header/footer data is present.
	 */
	private renderHeaderFooter(
		hf: PptxHeaderFooter | undefined
	): string {
		if (!hf) return '';
		const parts: string[] = [];
		if (hf.hasHeader && hf.headerText) {
			parts.push(`**Header:** ${hf.headerText}`);
		}
		if (hf.hasFooter && hf.footerText) {
			parts.push(`**Footer:** ${hf.footerText}`);
		}
		if (hf.hasDateTime && hf.dateTimeText) {
			parts.push(`**Date/Time:** ${hf.dateTimeText}`);
		}
		if (hf.hasSlideNumber) {
			parts.push('**Slide Numbers:** enabled');
		}
		if (hf.dateTimeAuto && hf.dateFormat) {
			parts.push(`**Date Format:** ${hf.dateFormat}`);
		}
		return parts.join(' | ');
	}

	/**
	 * Resolves and clamps the user-specified slide range to valid bounds.
	 * Defaults to the full deck if no range is configured.
	 *
	 * @param totalSlides - Total number of slides in the presentation.
	 * @returns A 1-based `{ start, end }` range guaranteed to be within bounds.
	 */
	private resolveRange(totalSlides: number): { start: number; end: number } {
		const range = this.getOptions().slideRange;
		const start = Math.max(1, Math.min(range?.start ?? 1, totalSlides));
		const end = Math.max(
			start,
			Math.min(range?.end ?? totalSlides, totalSlides)
		);
		return { start, end };
	}

	/** Casts the base `options` to the PPTX-specific options type. */
	private getOptions(): PptxConverterOptions {
		return this.options as PptxConverterOptions;
	}
}
