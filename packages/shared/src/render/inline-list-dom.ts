import { withInlineListDecorationDefaults } from './inline-list-decoration';
import { bindInlineListParagraph, bindInlineListRun, inlineListSession } from './inline-list-seed';
import type { InlineListSeed } from './inline-list-types';
import { applyUnderlineVariant } from './text-run-decoration';
import { segmentStyleToCss } from './text-run-style';
import { resolveAutoFitFontScale } from './text-style-helpers';

const initialized = new WeakSet<HTMLElement>();

/**
 * One-time native list seed for DOM-based bindings. Existing shared run styling
 * is reused; the controller paints markers and paragraph spacing externally.
 * Refuses an occupied root or previously bound seed, never replacing live DOM.
 */
export function initializeInlineListDom(root: HTMLElement, seed: InlineListSeed): boolean {
	const session = inlineListSession(seed);
	if (
		!session ||
		initialized.has(root) ||
		root.childNodes.length > 0 ||
		session.boundParagraphs.size > 0
	) {
		return false;
	}
	const textStyle = 'textStyle' in session.element ? session.element.textStyle : undefined;
	const fontScale = resolveAutoFitFontScale(textStyle);
	for (const paragraph of seed.paragraphs) {
		const block = root.ownerDocument.createElement('div');
		block.dataset.pptxListParagraph = paragraph.token;
		for (const run of paragraph.runs) {
			const span = root.ownerDocument.createElement('span');
			span.dataset.pptxListRun = run.token;
			const source = session.segments[run.segmentIndex];
			const projected = {
				...source,
				style: withInlineListDecorationDefaults(source.style, textStyle),
			};
			const style = segmentStyleToCss(projected, fontScale);
			applyUnderlineVariant(style, projected);
			for (const [key, value] of Object.entries(style)) {
				span.style.setProperty(
					key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`),
					String(value),
				);
			}
			if (run.text === '' || run.isLineBreak) {
				span.append(root.ownerDocument.createElement('br'));
			} else {
				// A legacy run can carry embedded soft breaks rather than separate segments.
				for (const [index, line] of run.text.split('\n').entries()) {
					if (index > 0) {
						span.append(root.ownerDocument.createElement('br'));
					}
					span.append(root.ownerDocument.createTextNode(line));
				}
			}
			block.append(span);
			bindInlineListRun(seed, span, run.segmentIndex);
		}
		root.append(block);
		bindInlineListParagraph(seed, block, paragraph.sourceIndex);
	}
	initialized.add(root);
	return true;
}
