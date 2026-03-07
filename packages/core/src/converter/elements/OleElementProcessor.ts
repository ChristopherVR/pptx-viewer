import type { PptxElement } from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

interface OleLikeElement {
	oleObjectType?: string;
	fileName?: string;
	oleName?: string;
	oleFileExtension?: string;
	oleProgId?: string;
	isLinked?: boolean;
	previewImageData?: string;
	previewImage?: string;
}

export class OleElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['ole'] as const;

	public async process(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		if (element.type !== 'ole') return null;
		const oleElement = element as OleLikeElement;
		const objectType = oleElement.oleObjectType ?? 'unknown';
		const fileName =
			oleElement.fileName ?? oleElement.oleName ?? 'embedded-object';
		const output: string[] = [`*[Embedded ${objectType}: ${fileName}]*`];
		if (oleElement.oleFileExtension) {
			output.push(`*Extension: .${oleElement.oleFileExtension}*`);
		}
		if (oleElement.oleProgId) {
			output.push(`*Program ID: ${oleElement.oleProgId}*`);
		}

		if (oleElement.isLinked) {
			output.push('*Linked object*');
		}

		const previewSource =
			oleElement.previewImageData ?? oleElement.previewImage;
		if (previewSource && previewSource.startsWith('data:')) {
			try {
				const previewPath = await ctx.mediaContext.saveImage(
					previewSource,
					`slide${ctx.slideNumber}-ole`
				);
				output.push(
					`![Embedded ${objectType} preview](${previewPath})`
				);
			} catch {
				// Ignore preview extraction errors.
			}
		}

		return output.join('\n\n');
	}
}
