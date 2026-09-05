/**
 * `pptx-dynamic-style` wiring: Angular's compiler strips every literal
 * `<style>` from a template (its static text becomes component styles), so
 * `<style>{{ css }}</style>` and `<style [textContent]="css">` render NOTHING.
 * The Angular build even surfaced this as an esbuild css-syntax-error on the
 * `{{` of the text-style override. Both dynamic per-element stylesheets must
 * therefore go through the imperative component instead.
 *
 * TestBed rendering is unavailable in this package (see `vitest.config.ts`),
 * so the templates are read as source, the same seam the sibling wiring tests
 * use.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string): string => readFileSync(join(here, file), 'utf8');

describe('dynamic <style> wiring', () => {
	it('never writes a literal <style> into a template the compiler would strip', () => {
		for (const file of ['element-renderer.component.html', 'content-part-renderer.component.ts']) {
			expect(read(file)).not.toMatch(/<style[\s>]/u);
		}
	});

	it('routes the text-style emphasis override through pptx-dynamic-style', () => {
		expect(read('element-renderer.component.html')).toContain(
			'<pptx-dynamic-style [css]="textStyleOverrideCss()" />',
		);
		expect(read('element-renderer.component.ts')).toContain('DynamicStyleComponent,');
	});

	it('routes the ink replay keyframes through pptx-dynamic-style, outside the svg', () => {
		const source = read('content-part-renderer.component.ts');
		const style = source.indexOf('<pptx-dynamic-style [css]="replayKeyframes" />');
		expect(style).toBeGreaterThan(-1);
		expect(style).toBeLessThan(source.indexOf('<svg'));
	});

	it('creates the element through Renderer2, which the compiler never sees', () => {
		const source = read('dynamic-style.component.ts');
		expect(source).toContain("this.renderer.createElement('style')");
		expect(source).toContain("this.renderer.setProperty(this.styleEl, 'textContent', text)");
	});
});
