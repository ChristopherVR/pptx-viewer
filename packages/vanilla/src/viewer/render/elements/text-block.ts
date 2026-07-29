import { buildTextBuildSpec, textBuildSpanStyle } from 'pptx-viewer-shared';
import type { CssStyleMap, ElementAnimationState, RenderParagraph } from 'pptx-viewer-shared';

import { applyStyleMap, createEl } from '../dom';

/** A run whose text is exactly a newline is a hard line break, not content. */
const NEWLINE_RUN = '\n';

/**
 * Render an element's rich text (paragraphs of styled runs with bullet
 * markers + hanging indents) into a `.pptxv-text` block. The paragraph model
 * is built by the shared, framework-agnostic `buildParagraphs`; this module is
 * pure DOM assembly (vanilla port of Vue's `SlideTextBlock.vue`).
 */
export function renderTextBlock(
	doc: Document,
	paragraphs: RenderParagraph[],
	textStyle: CssStyleMap,
	/**
	 * Owning element id + live sub-element animation states, supplied only while
	 * presenting. A staged text build (PowerPoint's "Animate text: By letter")
	 * needs the rendered text split to match its per-character sub-animations,
	 * otherwise the whole box just fades as one.
	 */
	build?: { elementId: string; states: ReadonlyMap<string, ElementAnimationState> | undefined },
): HTMLElement {
	const block = createEl(doc, 'div', 'pptxv-text', textStyle);

	for (const para of paragraphs) {
		const paraStyle: CssStyleMap = {
			margin: 0,
			marginLeft: para.marginLeftPx !== undefined ? `${para.marginLeftPx}px` : 0,
		};
		// Per-paragraph spacing from this paragraph's own `a:pPr` (shared #69):
		// a unitless multiplier or `"<n>pt"` string for line-height, and px
		// space-before/after as top/bottom margins. Only set when the paragraph
		// overrides it, so it otherwise inherits the block-level line-height.
		if (para.lineHeight !== undefined) {
			paraStyle.lineHeight = para.lineHeight;
		}
		if (para.spaceBeforePx !== undefined) {
			paraStyle.marginTop = `${para.spaceBeforePx}px`;
		}
		if (para.spaceAfterPx !== undefined) {
			paraStyle.marginBottom = `${para.spaceAfterPx}px`;
		}
		if (para.strutFontSizePx !== undefined) {
			// Re-base the line box on this paragraph's own runs; every run span
			// carries an explicit font-size, so this only moves the CSS strut.
			paraStyle.fontSize = `${para.strutFontSizePx}px`;
		}
		const p = createEl(doc, 'p', 'pptxv-para', paraStyle);
		if (para.textIndentPx !== undefined) {
			p.style.textIndent = `${para.textIndentPx}px`;
		}

		const picture = para.bulletPicture;
		if (picture?.src) {
			const image = createEl(doc, 'img', 'pptxv-bullet-image', {
				width: `${picture.sizePx}px`,
				height: `${picture.sizePx}px`,
				display: 'inline-block',
				verticalAlign: 'middle',
				marginInlineEnd: '4px',
				objectFit: 'contain',
			});
			image.src = picture.src;
			image.alt = picture.accessibleLabel;
			p.appendChild(image);
		} else if (para.bulletMarker !== undefined) {
			const bullet = createEl(doc, 'span', 'pptxv-bullet');
			applyStyleMap(bullet, para.bulletStyle);
			if (para.bulletPicture) {
				bullet.setAttribute('aria-label', para.bulletPicture.accessibleLabel);
			}
			// No trailing spacer: the marker's own box is the hanging distance
			// wide (shared `buildParagraphs` sets `min-width`), and a space here
			// would inherit the marker's font - Wingdings paints U+00A0 as a
			// visible dot, i.e. a second bullet (issue #131).
			bullet.textContent = para.bulletMarker;
			p.appendChild(bullet);
		}

		const spec = build
			? buildTextBuildSpec<CssStyleMap>(
					build.elementId,
					paragraphs.indexOf(para),
					para.runs
						.filter((run) => run.text !== NEWLINE_RUN)
						.map((run) => ({ text: run.text, style: run.style })),
					build.states,
				)
			: undefined;

		if (spec && spec.granularity !== 'paragraph') {
			for (const span of spec.spans ?? []) {
				const node = createEl(doc, 'span');
				applyStyleMap(node, { ...(span.style ?? {}), ...textBuildSpanStyle(span) });
				if (span.animId) {
					node.setAttribute('data-anim-id', span.animId);
				}
				node.textContent = span.text;
				p.appendChild(node);
			}
			block.appendChild(p);
			continue;
		}

		// A paragraph-level build wraps the runs; everything else renders plainly.
		let runHost: HTMLElement = p;
		if (spec) {
			const wrapper = createEl(doc, 'span');
			applyStyleMap(wrapper, textBuildSpanStyle(spec));
			if (spec.animId) {
				wrapper.setAttribute('data-anim-id', spec.animId);
			}
			p.appendChild(wrapper);
			runHost = wrapper;
		}

		for (const run of para.runs) {
			if (run.text === NEWLINE_RUN) {
				runHost.appendChild(doc.createElement('br'));
				continue;
			}
			const span = createEl(doc, 'span');
			applyStyleMap(span, run.style);
			span.textContent = run.text;
			runHost.appendChild(span);
		}

		// An authored blank line has no runs, so without this the <p> collapses
		// to zero height and the gap a deck puts between a heading and its
		// bullet list disappears (issue #131).
		if (para.isEmpty) {
			runHost.appendChild(doc.createElement('br'));
		}

		block.appendChild(p);
	}

	return block;
}
