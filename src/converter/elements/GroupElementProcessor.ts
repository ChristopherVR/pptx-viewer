import type { GroupPptxElement, PptxElement } from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

export class GroupElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['group'] as const;

	public async process(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		if (element.type !== 'group') return null;
		const groupElement: GroupPptxElement = element;
		if (groupElement.children.length === 0) return null;
		const children = await ctx.processElements(groupElement.children);
		if (children.length === 0) return null;
		return children.join('\n\n');
	}
}
