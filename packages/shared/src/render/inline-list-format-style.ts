import type { TextSegment } from 'pptx-viewer-core';

import { withInlineListDecorationDefaults } from './inline-list-decoration';
import { inlineListSession, registerInlineListRunStyle } from './inline-list-seed';
import type { InlineListSeed } from './inline-list-types';
import { segmentStyleToCss } from './text-run-style';

/** Paint a command's full run style, including removal of previous declarations. */
export function paintInlineListRun(
	seed: InlineListSeed,
	wrapper: HTMLElement,
	segment: TextSegment,
	fontScale: number,
): void {
	const session = inlineListSession(seed)!;
	const oldIndex =
		session.runTokens.get(wrapper.dataset.pptxListRun ?? '') ?? session.runNodes.get(wrapper);
	const old = oldIndex === undefined ? undefined : session.segments[oldIndex];
	const defaults = 'textStyle' in session.element ? session.element.textStyle : undefined;
	const css = segmentStyleToCss(
		{ ...segment, style: withInlineListDecorationDefaults(segment.style, defaults) },
		fontScale,
	);
	if (old) {
		for (const property of Object.keys(segmentStyleToCss(old, fontScale))) {
			if (!(property in css)) {
				Reflect.set(wrapper.style, property, '');
			}
		}
	}
	Object.assign(wrapper.style, { textDecoration: 'none', ...css });
	wrapper.dataset.pptxListRun = registerInlineListRunStyle(
		seed,
		segment.style,
		wrapper.style.cssText,
	)!;
}

/** A decoration propagates through descendants, unlike inherited font weight. */
export function sharedTextDecorationAncestors(
	node: Text,
	root: HTMLElement,
	decoration: 'underline' | 'line-through',
): HTMLElement[] {
	const result: HTMLElement[] = [];
	let ancestor = node.parentElement;
	while (ancestor) {
		const authored =
			ancestor.style.textDecoration ||
			ancestor.style.textDecorationLine ||
			(ancestor.tagName === 'U' ? 'underline' : ancestor.tagName === 'S' ? 'line-through' : '');
		if (
			authored.includes(decoration) &&
			(ancestor === root || ancestor.textContent !== node.data)
		) {
			result.push(ancestor);
		}
		if (ancestor === root) {
			break;
		}
		ancestor = ancestor.parentElement;
	}
	return result;
}

/** Clearing a single-text wrapper leaves no unaffected sibling to repaint. */
export function clearSingleTextDecoration(node: Text, blockRoot: HTMLElement): void {
	let ancestor = node.parentElement;
	while (ancestor && ancestor !== blockRoot && ancestor.textContent === node.data) {
		if (
			ancestor.style.textDecoration ||
			ancestor.style.textDecorationLine ||
			ancestor.tagName === 'U' ||
			ancestor.tagName === 'S'
		) {
			ancestor.style.textDecoration = 'none';
			ancestor.style.textDecorationLine = 'none';
		}
		ancestor = ancestor.parentElement;
	}
}
