import type { PptxElement } from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

interface InkLikeElement {
	inkPaths: string[];
	inkColors?: string[];
	inkTool?: 'pen' | 'highlighter' | 'eraser';
	inkOpacities?: number[];
}

export class InkElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['ink'] as const;

	public async process(
		element: PptxElement,
		_ctx: ElementProcessorContext
	): Promise<string | null> {
		if (element.type !== 'ink') return null;
		const inkElement = element as InkLikeElement;
		const details: string[] = [];

		const strokeCount = inkElement.inkPaths.length;
		details.push(`${strokeCount} stroke${strokeCount === 1 ? '' : 's'}`);

		if (inkElement.inkColors && inkElement.inkColors.length > 0) {
			const unique = [...new Set(inkElement.inkColors)];
			if (unique.length <= 4) {
				details.push(`colors ${unique.join(', ')}`);
			} else {
				details.push(`${unique.length} colors`);
			}
		}
		if (inkElement.inkTool) {
			details.push(`tool ${inkElement.inkTool}`);
		}
		if (inkElement.inkOpacities && inkElement.inkOpacities.length > 0) {
			const avgOpacity =
				inkElement.inkOpacities.reduce((sum, value) => sum + value, 0) /
				inkElement.inkOpacities.length;
			details.push(`opacity ${Math.round(avgOpacity * 100)}%`);
		}

		return `*[Ink Drawing: ${details.join(' | ')}]*`;
	}
}
