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

export interface PptxConverterOptions extends ConversionOptions {
	sourceName: string;
	includeSpeakerNotes: boolean;
	slideRange?: {
		start?: number;
		end?: number;
	};
	/**
	 * When true, emit clean semantic markdown instead of CSS-positioned HTML.
	 * Default is false (positioned HTML layout for slide fidelity).
	 */
	semanticMode?: boolean;
}

export class PptxMarkdownConverter extends DocumentConverter<PptxData> {
	private readonly textRenderer: TextSegmentRenderer;
	private readonly registry: ElementProcessorRegistry;
	private readonly slideProcessor: SlideProcessor;
	private convertedSlides = 0;
	private totalSlides = 0;

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

	public get imagesExtracted(): number {
		return this.mediaContext.totalImages;
	}

	public get mediaDir(): string | null {
		return this.mediaContext.totalImages > 0
			? this.mediaContext.mediaDir
			: null;
	}

	public get slidesConverted(): number {
		return this.convertedSlides;
	}

	public get presentationSlides(): number {
		return this.totalSlides;
	}

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

	private resolveRange(totalSlides: number): { start: number; end: number } {
		const range = this.getOptions().slideRange;
		const start = Math.max(1, Math.min(range?.start ?? 1, totalSlides));
		const end = Math.max(
			start,
			Math.min(range?.end ?? totalSlides, totalSlides)
		);
		return { start, end };
	}

	private getOptions(): PptxConverterOptions {
		return this.options as PptxConverterOptions;
	}
}
