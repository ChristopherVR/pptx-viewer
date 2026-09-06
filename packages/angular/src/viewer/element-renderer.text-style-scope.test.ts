/**
 * A font-style emphasis effect (Bold Flash, Bold Reveal, Underline, Change
 * Font Style/Size) must animate a table cell, a chart title/label/legend, a
 * SmartArt node caption and a connector caption exactly as it animates plain
 * shape/text, since PowerPoint does not distinguish those targets. This used
 * to be gated on `hasTextProperties(el)` (true only for text/shape/connector),
 * so a table or chart never got the override at all, and a connector's own
 * early return in the (React) equivalent skipped it even though connectors
 * DO satisfy `hasTextProperties`.
 *
 * TestBed rendering is unavailable in this package (see `vitest.config.ts`),
 * so this reads the component/template sources, the same seam
 * `dynamic-style.component.test.ts` uses.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string): string => readFileSync(join(here, file), 'utf8');

describe('text-style emphasis override reaches every element type', () => {
	it('computes textStyleOverrideCss unconditionally, not gated on hasTextProperties', () => {
		const source = read('element-renderer.component.ts');
		const start = source.indexOf('readonly textStyleOverrideCss = computed');
		expect(start).toBeGreaterThan(-1);
		const body = source.slice(start, source.indexOf(');', start));
		expect(body).not.toContain('hasTextProperties');
		expect(body).toContain(
			'buildTextStyleOverrideCss(this.element().id, this.animationState()?.textStyle)',
		);
	});

	it('emits <pptx-dynamic-style> inside the table, chart, and smartArt wrapper divs', () => {
		// table/chart/smartArt are "simple wrapper" kinds split out to
		// `ElementRendererGraphicsComponent`; see that component's doc.
		const html = read('element-renderer-graphics.component.html');
		for (const marker of ['pptx-ng-table', 'pptx-ng-chart', 'pptx-ng-smartart']) {
			const caseStart = html.indexOf(`class="pptx-ng-element ${marker}"`);
			expect(caseStart).toBeGreaterThan(-1);
			const nextCloseDiv = html.indexOf('</div>', caseStart);
			const segment = html.slice(caseStart, nextCloseDiv);
			expect(segment).toContain('<pptx-dynamic-style [css]="textStyleOverrideCss()" />');
		}
	});

	it('threads textStyleOverrideCss into pptx-connector-renderer', () => {
		const html = read('element-renderer.component.html');
		const caseStart = html.indexOf('<pptx-connector-renderer');
		expect(caseStart).toBeGreaterThan(-1);
		const selfClose = html.indexOf('/>', caseStart);
		const segment = html.slice(caseStart, selfClose);
		expect(segment).toContain('[textStyleOverrideCss]="textStyleOverrideCss()"');
	});

	it('connectorRendererComponent accepts and renders the override via pptx-dynamic-style', () => {
		const source = read('connector-renderer.component.ts');
		expect(source).toContain(
			'readonly textStyleOverrideCss = input<string | undefined>(undefined);',
		);
		expect(source).toContain('<pptx-dynamic-style [css]="textStyleOverrideCss()" />');
		expect(source).toContain('DynamicStyleComponent');
	});
});
