/**
 * Text-driven node sizing (ECMA-376 Part 1, 21.4.2.x `dgm:rule`): a `tx`
 * node whose rule list lets its height grow (`<dgm:rule type="h"
 * val="INF"/>`) is as tall as its constraints make it OR as its text needs
 * at the size the layout is being built around, whichever is larger.
 * "Vertical Bullet List"'s `parentText` is `0.52 x primFontSz` tall until a
 * wrapped label needs more; "Vertical Box List"'s `childText` grows past its
 * `0.7 x primFontSz` for a child line under its `1.64 x primFontSz` top
 * margin.
 *
 * The grown height is the text's measured height (`text-measure.ts`) plus
 * its margins, inside the preset's own text rectangle, plus a small
 * `GROW_SLACK_EM`: across the cached drawings a grown box is 0.03-0.06em
 * taller than the fitted text's own block (single lines at 30, 35 and 46pt:
 * 0.043, 0.040, 0.040em; two lines at 40pt 0.033em; two bullet paragraphs at
 * 27pt 0.040em).
 *
 * Only runs inside a font search (the node's font must be known); see
 * `font-search.ts`.
 */

import { layoutContextOf } from './engine-context';
import type { EngineNode } from './engine-node';
import { layoutFontOf } from './layout-font';
import type { Size } from './preferred-size';
import { nodeMarginsPt, textBoxAt } from './text-fit';
import { paragraphsHeight } from './text-measure';

export const GROW_SLACK_EM = 0.04;

/** Whether a rule reaching `node` lets its `type` grow without bound. */
export function canGrow(node: EngineNode, type: 'w' | 'h'): boolean {
	const unbounded = (declaring: EngineNode, relation: 'self' | 'ch' | 'des'): boolean =>
		declaring.rules.some(
			(rule) =>
				rule.type === type &&
				rule.for === relation &&
				(!rule.forName || rule.forName === node.name) &&
				rule.val === Number.POSITIVE_INFINITY,
		);
	if (unbounded(node, 'self')) {
		return true;
	}
	if (node.parent && unbounded(node.parent, 'ch')) {
		return true;
	}
	for (let anc = node.parent; anc; anc = anc.parent) {
		if (unbounded(anc, 'des')) {
			return true;
		}
	}
	return false;
}

/**
 * The height `node`'s text needs at width `w`, or `undefined` when its font
 * is not known yet, it has no text, or a word is wider than its line.
 */
export function textNeedHeight(node: EngineNode, w: number, h: number): number | undefined {
	const context = layoutContextOf(node);
	const font = layoutFontOf(node);
	if (!context || font === undefined || !(w > 0)) {
		return undefined;
	}
	const text = context.textOf(node);
	if (!text) {
		return undefined;
	}
	const margins = nodeMarginsPt(node, font, (ref) => layoutFontOf(ref));
	let height = Math.max(h, 1e-3);
	for (let i = 0; i < 12; i++) {
		const box = textBoxAt(node, w, height);
		const textH = paragraphsHeight(
			text,
			font,
			box.w - margins.lMarg - margins.rMarg,
			context.metrics,
		);
		if (textH === undefined) {
			return undefined;
		}
		const need = textH + GROW_SLACK_EM * font + margins.tMarg + margins.bMarg;
		if (box.h >= need - 1e-6) {
			return height;
		}
		height += need - box.h;
	}
	return height;
}

/** `size` grown to fit `node`'s text where its rules allow (see module doc). */
export function grownSize(node: EngineNode, size: Size): Size {
	let h = Math.max(size.h, node.growFloor?.h ?? -Infinity);
	if (canGrow(node, 'h')) {
		const need = textNeedHeight(node, size.w, h);
		if (need !== undefined && need > h) {
			h = need;
		}
	}
	return h === size.h ? size : { w: size.w, h };
}
