import { hasTextProperties } from 'pptx-viewer-core';
import type { OmmlNode } from 'pptx-viewer-shared';
import { convertOmmlToMathMl, sanitizeMathMl } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import { getTextBlockStyle } from '../element-styles';
import type { ElementRenderContext } from '../types';

/** Render every OMML-bearing text segment as browser-native MathML. */
export function renderEquations(
	element: Parameters<typeof hasTextProperties>[0],
	context: ElementRenderContext,
): HTMLElement | null {
	if (!hasTextProperties(element)) {
		return null;
	}
	const equations = (element.textSegments ?? []).filter((segment) => segment.equationXml);
	if (equations.length === 0) {
		return null;
	}
	const wrapper = createEl(context.document, 'div', 'pptxv-equations', {
		...getTextBlockStyle(element),
		alignItems: 'center',
		gap: '0.25em',
		fontFamily: "'Cambria Math', 'STIX Two Math', serif",
	});
	for (const segment of equations) {
		const mathml = convertOmmlToMathMl(segment.equationXml as OmmlNode);
		if (!mathml) {
			continue;
		}
		const row = createEl(context.document, 'span', 'pptxv-equation', {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			width: '100%',
		});
		const math = createEl(context.document, 'span', 'pptxv-equation-math', {
			flex: 1,
			textAlign: 'center',
		});
		math.innerHTML = sanitizeMathMl(mathml);
		row.appendChild(math);
		if (segment.equationNumber) {
			const number = createEl(context.document, 'span', 'pptxv-equation-number', {
				whiteSpace: 'nowrap',
			});
			number.textContent = `(${segment.equationNumber})`;
			row.appendChild(number);
		}
		wrapper.appendChild(row);
	}
	return wrapper.childNodes.length > 0 ? wrapper : null;
}
