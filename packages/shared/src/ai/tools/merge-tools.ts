/**
 * The `merge_tables` tool executor: a deterministic, first-class table merge.
 * It reads two table elements from a slide, merges them via
 * {@link mergeTableElements}, and produces a single slides change that REMOVES
 * both originals and ADDS the merged table, routed through the write policy so
 * it stages (default) or applies as one undoable history entry.
 */

import type { TableMergeDirection } from '../table-merge';
import { mergeTableElements } from '../table-merge';
import type { AiToolContext, AiToolExecutor } from './executor-base';
import { newElementId, requireElement, requireSlide, routeWrite } from './executor-base';

interface MergeTablesInput {
	slideIndex: number;
	elementIdA: string;
	elementIdB: string;
	direction?: TableMergeDirection;
}

const mergeTables: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as MergeTablesInput;
	const mergedId = newElementId();
	const result = routeWrite(ctx, `Merge tables on slide ${p.slideIndex + 1}`, (slides) => {
		const slide = requireSlide(slides, p.slideIndex);
		const elA = requireElement(slide, p.elementIdA);
		const elB = requireElement(slide, p.elementIdB);
		if (elA.type !== 'table') {
			throw new Error(`Element '${p.elementIdA}' is not a table.`);
		}
		if (elB.type !== 'table') {
			throw new Error(`Element '${p.elementIdB}' is not a table.`);
		}
		const merged = mergeTableElements(elA, elB, { direction: p.direction, id: mergedId });
		const remove = new Set([p.elementIdA, p.elementIdB]);
		slide.elements = slide.elements.filter((e) => !remove.has(e.id));
		slide.elements.push(merged);
		return slides;
	});
	return { ...result, mergedElementId: mergedId };
};

/** Table-merge executor keyed by tool name. */
export const mergeExecutors = {
	merge_tables: mergeTables,
} satisfies Record<string, AiToolExecutor>;
