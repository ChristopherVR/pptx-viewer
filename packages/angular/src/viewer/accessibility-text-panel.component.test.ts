/**
 * accessibility-text-panel.component.test.ts
 *
 * `AccessibilityTextPanelComponent` is the alt text / title editor for a
 * plain shape, text box, connector, or any graphic-frame kind
 * (table/chart/smartArt/media/ole), at parity with React's
 * `AccessibilityTextSection` and Vue's `AccessibilityPanel.vue`.
 *
 * No Angular TestBed here (see `media-properties-panel.component.test.ts`):
 * `.supports()` is a plain static method testable without DI, and the
 * remaining assertions pin the source to the wiring the template/computed
 * rely on (importing shared through the vendored `../internal/shared`
 * barrel, never the bare `'pptx-viewer-shared'` specifier ng-packagr would
 * externalize; see `internal/shared.ts`'s docblock).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { AccessibilityTextPanelComponent } from './accessibility-text-panel.component';

function el(type: PptxElement['type']): PptxElement {
	return { id: 'el-1', type, x: 0, y: 0, width: 10, height: 10 } as unknown as PptxElement;
}

describe('accessibilityTextPanelComponent.supports', () => {
	it('supports a plain shape, text box and connector', () => {
		expect(AccessibilityTextPanelComponent.supports(el('shape'))).toBeTruthy();
		expect(AccessibilityTextPanelComponent.supports(el('text'))).toBeTruthy();
		expect(AccessibilityTextPanelComponent.supports(el('connector'))).toBeTruthy();
	});

	it('excludes a picture, whose own alt text field lives in ImagePropertiesPanelComponent', () => {
		expect(AccessibilityTextPanelComponent.supports(el('image'))).toBeFalsy();
		expect(AccessibilityTextPanelComponent.supports(el('picture'))).toBeFalsy();
	});

	it('supports every graphic-frame kind (table/chart/smartArt/media/ole)', () => {
		expect(AccessibilityTextPanelComponent.supports(el('table'))).toBeTruthy();
		expect(AccessibilityTextPanelComponent.supports(el('chart'))).toBeTruthy();
		expect(AccessibilityTextPanelComponent.supports(el('smartArt'))).toBeTruthy();
		expect(AccessibilityTextPanelComponent.supports(el('ole'))).toBeTruthy();
		expect(AccessibilityTextPanelComponent.supports(el('media'))).toBeTruthy();
	});

	it('excludes a kind with neither field, like a group', () => {
		expect(AccessibilityTextPanelComponent.supports(el('group'))).toBeFalsy();
	});
});

describe('accessibilityTextPanelComponent source wiring', () => {
	const source = readFileSync(
		path.join(__dirname, 'accessibility-text-panel.component.ts'),
		'utf8',
	);

	it('reads its fields through the shared descriptor, via the vendored barrel', () => {
		expect(source).toMatch(/getNonVisualDescriptionFields/);
		expect(source).toContain("from '../internal/shared'");
		expect(source).not.toContain("from 'pptx-viewer-shared'");
	});

	it('emits altText and title patches from their own inputs', () => {
		expect(source).toMatch(/altText:\s*\(event\.target as HTMLTextAreaElement\)\.value/);
		expect(source).toMatch(/title:\s*\(event\.target as HTMLInputElement\)\.value/);
	});
});

describe('inspectorPanelComponent wiring for accessibility text', () => {
	const source = readFileSync(path.join(__dirname, 'inspector-panel.component.ts'), 'utf8');

	it('mounts pptx-accessibility-text-panel gated on accessibilityTextEl', () => {
		expect(source).toContain('pptx-accessibility-text-panel');
		expect(source).toMatch(/accessibilityTextEl\(\);\s*as a11yEl/);
		expect(source).toMatch(/AccessibilityTextPanelComponent\.supports\(this\.el\(\)\)/);
	});
});
