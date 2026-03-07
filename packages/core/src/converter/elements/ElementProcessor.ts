import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';

export interface ElementProcessorContext {
	mediaContext: MediaContext;
	slideNumber: number;
	/** Slide canvas width in CSS pixels (for layout positioning). */
	slideWidth: number;
	/** Slide canvas height in CSS pixels (for layout positioning). */
	slideHeight: number;
	/** Scale factor applied to the layout container (for font/image sizing). */
	layoutScale?: number;
	/**
	 * When true, processors should emit clean markdown instead of HTML.
	 * Tables become markdown tables, images use `![alt](path)` syntax,
	 * and text uses markdown formatting (not `<strong>`, `<em>`, etc.).
	 */
	semanticMode?: boolean;
	processElements: (elements: PptxElement[]) => Promise<string[]>;
}

export interface ElementProcessor {
	readonly supportedTypes: ReadonlyArray<PptxElement['type']>;
	process(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null>;
}

/** Action fields available on PptxElementBase (not exported from the plugin package). */
interface ElementAction {
	url?: string;
	targetSlideIndex?: number;
	tooltip?: string;
	action?: string;
}

/** Base spatial & metadata fields available on every PptxElement variant. */
interface ElementBaseFields {
	hidden?: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation?: number;
	flipHorizontal?: boolean;
	flipVertical?: boolean;
	actionClick?: ElementAction;
	actionHover?: ElementAction;
}

export class ElementProcessorRegistry {
	private readonly processors = new Map<
		PptxElement['type'],
		ElementProcessor
	>();

	public register(processor: ElementProcessor): void {
		for (const type of processor.supportedTypes) {
			this.processors.set(type, processor);
		}
	}

	public getProcessor(type: PptxElement['type']): ElementProcessor | null {
		return this.processors.get(type) ?? null;
	}

	public async processElement(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		const processor = this.getProcessor(element.type);
		if (!processor) return null;

		let result = await processor.process(element, ctx);
		if (result === null) return null;

		const base = element as unknown as ElementBaseFields;

		if (base.hidden) {
			result = `*[Hidden]* ${result}`;
		}

		result += this.buildActionAnnotation(
			base.actionClick, 'Click'
		);
		result += this.buildActionAnnotation(
			base.actionHover, 'Hover'
		);

		return result;
	}

	private buildActionAnnotation(
		action: ElementAction | undefined,
		_trigger: string
	): string {
		if (!action) return '';

		if (action.url) {
			const linkText = action.tooltip ?? action.url;
			return `\n\n[${linkText}](${action.url})`;
		}

		if (action.targetSlideIndex !== undefined) {
			const label = `Jump to slide ${action.targetSlideIndex + 1}`;
			return `\n\n*${label}*`;
		}

		if (action.action) {
			return `\n\n*${action.action}*`;
		}

		return '';
	}
}
