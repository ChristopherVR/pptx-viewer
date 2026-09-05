/**
 * inspector-panel.component.test.ts: Unit tests for the pure layout helper that
 * drives the inspector's responsive (full-width bottom-sheet) branch, plus
 * source-text guards for the "Recent colours" row (wave-4 B6) mounted under
 * the fill/stroke/text colour pickers.
 *
 * No Angular TestBed: the component-rendering path needs
 * `@analogjs/vite-plugin-angular` (a follow-up), so the mobile
 * layout decision is factored into the pure `inspectorRootClass` helper and
 * tested directly here, matching the rest of the Angular package's convention.
 *
 * React reference: packages/react/src/viewer/components/InspectorPane.tsx
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';
import { inspectorRootClass } from './inspector-panel.component';

const source = componentSource(import.meta.dirname, 'inspector-panel.component.ts');

describe('inspectorRootClass', () => {
	it('returns the plain inspector class on desktop (side panel)', () => {
		expect(inspectorRootClass(false)).toBe('pptx-ng-inspector');
	});

	it('adds the is-mobile bottom-sheet modifier on mobile', () => {
		expect(inspectorRootClass(true)).toBe('pptx-ng-inspector is-mobile');
	});

	it('always keeps the base class so shared inspector styles apply', () => {
		expect(inspectorRootClass(false)).toContain('pptx-ng-inspector');
		expect(inspectorRootClass(true)).toContain('pptx-ng-inspector');
	});
});

describe('inspector panel recent colours (wave-4 B6)', () => {
	it('mounts the recent-colours row under fill, stroke, and text colour', () => {
		expect(source).toContain('RecentColorsRowComponent');
		const mounts = (source.match(/<pptx-recent-colors-row/gu) ?? []).length;
		expect(mounts).toBe(3);
	});

	it('wires each mount to its own pick handler, committing through the picker path', () => {
		expect(source).toContain('(pick)="onFillColorPick($event)"');
		expect(source).toContain('(pick)="onStrokeColorPick($event)"');
		expect(source).toContain('(pick)="onTextColorPick($event)"');
	});

	it('every colour commit path (native input or recent-row pick) pushes into RecentColorsService', () => {
		expect(source).toContain(
			'private commitFillColor(color: string, ref?: PptxThemeColorRef): void {',
		);
		expect(source).toContain(
			'private commitStrokeColor(color: string, ref?: PptxThemeColorRef): void {',
		);
		expect(source).toContain(
			'private commitTextColor(color: string, ref?: PptxThemeColorRef): void {',
		);
		const pushCalls = (source.match(/this\.recentColors\.push\(color\)/gu) ?? []).length;
		expect(pushCalls).toBe(3);
	});
});

describe('inspector panel theme colour swatch grid (W3-G2)', () => {
	it('mounts the theme-swatch grid above the fill, stroke, and text colour recent-rows', () => {
		expect(source).toContain('ThemeColorSwatchGridComponent');
		const mounts = (source.match(/<pptx-theme-color-swatch-grid/gu) ?? []).length;
		expect(mounts).toBe(3);
	});

	it('wires each theme-swatch mount to its own commit handler, carrying both hex and ref', () => {
		expect(source).toContain('(pick)="onFillThemeColor($event)"');
		expect(source).toContain('(pick)="onStrokeThemeColor($event)"');
		expect(source).toContain('(pick)="onTextThemeColor($event)"');
	});

	it('a theme-swatch pick commits fillColorRef/strokeColorRef/colorRef alongside the hex', () => {
		expect(source).toContain('shapeStylePatch(cur, { fillColor: color, fillColorRef: ref })');
		expect(source).toContain('shapeStylePatch(cur, { strokeColor: color, strokeColorRef: ref })');
		expect(source).toContain('textStylePatch(cur, { color, colorRef: ref })');
	});
});
