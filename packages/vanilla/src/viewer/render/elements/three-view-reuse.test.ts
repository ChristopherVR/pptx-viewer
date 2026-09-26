// @vitest-environment happy-dom
import type { PptxThreeViewElement, ThreeViewSpec } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import {
	collectThreeViews,
	takeReusableThreeView,
	withReusableThreeViews,
} from './three-view-reuse';

function fakeView(spec: ThreeViewSpec | null): PptxThreeViewElement {
	const el = document.createElement('pptx-three-view') as unknown as PptxThreeViewElement;
	Object.defineProperty(el, 'spec', { value: spec, configurable: true });
	return el;
}

describe('three-view reuse across a stage rebuild', () => {
	it('collects live views by spec and hands each out once', () => {
		const spec = { kind: 'smartart', spec: {} } as unknown as ThreeViewSpec;
		const root = document.createElement('div');
		const view = fakeView(spec);
		root.append(view as unknown as Node, fakeView(null) as unknown as Node);
		const pool = collectThreeViews(root);
		expect(pool.size).toBe(1);
		withReusableThreeViews(pool, () => {
			expect(takeReusableThreeView(spec)).toBe(view);
			expect(takeReusableThreeView(spec)).toBeNull();
		});
	});

	it('offers nothing outside a rebuild', () => {
		const spec = { kind: 'chart', spec: {} } as unknown as ThreeViewSpec;
		const root = document.createElement('div');
		root.append(fakeView(spec) as unknown as Node);
		withReusableThreeViews(collectThreeViews(root), () => undefined);
		expect(takeReusableThreeView(spec)).toBeNull();
	});
});
