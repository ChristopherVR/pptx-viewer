import type { CssStyleMap, RenderParagraph } from 'pptx-viewer-shared';

import { applyStyleMap, createEl } from '../dom';

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
): HTMLElement {
	const block = createEl(doc, 'div', 'pptxv-text', textStyle);

	for (const para of paragraphs) {
		const p = createEl(doc, 'p', 'pptxv-para', {
			margin: 0,
			marginLeft: para.marginLeftPx !== undefined ? `${para.marginLeftPx}px` : 0,
		});
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
			bullet.textContent = `${para.bulletMarker} `;
			p.appendChild(bullet);
		}

		for (const run of para.runs) {
			if (run.text === '\n') {
				p.appendChild(doc.createElement('br'));
				continue;
			}
			const span = createEl(doc, 'span');
			applyStyleMap(span, run.style);
			span.textContent = run.text;
			p.appendChild(span);
		}

		block.appendChild(p);
	}

	return block;
}
