/**
 * Wiring pin for the `a:sp3d` bevel lighting SVG `<filter>` in
 * `ElementRendererComponent`.
 *
 * `getBevelLightingFilterDef` (accessor logic: id/cssReference/filterMarkup
 * shape, feDiffuseLighting/feSpecularLighting presence, layer count) is
 * covered in `element-effect-defs.test.ts`, mirroring how the soft-edge
 * filter's accessor is tested there. The sanitizing wrapper around it lives
 * in `bevel-lighting-filter.ts` (split out purely to keep the component file
 * under the ~300 LOC guideline), which this file also pins.
 *
 * The Angular TestBed compiler is unavailable for this component (it depends
 * on `TranslateService`/`AnimationPlaybackService`/`SmartArt3DService`, so a
 * full DOM render is out of reach here without it), so - like
 * `extrusion-3d-overlay.component.test.ts`'s "wiring into
 * element-renderer-shape.component" block - this pins BOTH ends of the wire
 * by asserting on the actual source: the computed signal exists and
 * sanitizes via `DomSanitizer`, and the template mounts it. Without this, a
 * template edit that drops the `@if (bevelLightingFilter(); …)` block (or a
 * signal rename that breaks the binding) would leave every 3D bevel visibly
 * unlit - worse than the old box-shadow approximation it replaced, since that
 * fallback is now gone - while every unit test on the pure accessor stayed
 * green, exactly the class of gap CLAUDE.md's "per-binding unit tests passing
 * does NOT mean the binding works" warns about.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function read(file: string): string {
	return readFileSync(path.join(__dirname, file), 'utf8');
}

describe('wiring into element-renderer.component (bevel lighting <filter> parity)', () => {
	it('mounts the bevel lighting <defs> block in the template', () => {
		const html = read('element-renderer.component.html');
		expect(html).toContain('@if (bevelLightingFilter(); as blf)');
		expect(html).toContain('[innerHTML]="blf.markup"');
	});

	it('declares the bevelLightingFilter computed, wired through resolveBevelLightingFilter', () => {
		const source = read('element-renderer.component.ts');
		expect(source).toContain('DomSanitizer');
		expect(source).toContain('private readonly sanitizer = inject(DomSanitizer);');
		expect(source).toContain("from './bevel-lighting-filter';");
		expect(source).toMatch(
			/readonly bevelLightingFilter = computed<BevelLightingFilterDef \| undefined>\(\(\) =>\s*resolveBevelLightingFilter\(this\.element\(\), this\.sanitizer\),?\s*\);/u,
		);
	});

	it('sanitizes filterMarkup via DomSanitizer.bypassSecurityTrustHtml, reading getBevelLightingFilterDef', () => {
		const source = read('bevel-lighting-filter.ts');
		expect(source).toContain("import { getBevelLightingFilterDef } from './element-effect-defs';");
		expect(source).toContain('getBevelLightingFilterDef(element)');
		expect(source).toContain('sanitizer.bypassSecurityTrustHtml(def.filterMarkup)');
	});
});
