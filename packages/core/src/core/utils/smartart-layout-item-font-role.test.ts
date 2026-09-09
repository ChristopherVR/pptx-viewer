import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveItemSelfAspect } from './smartart-layout-item-font-role';

describe('resolveItemSelfAspect', () => {
	it('returns undefined when the item declares no self-scoped h/w aspect', () => {
		expect(resolveItemSelfAspect(undefined)).toBeUndefined();
		expect(resolveItemSelfAspect({ name: 'node' })).toBeUndefined();
	});

	it('reads the h-over-w form directly (factor IS the h/w aspect)', () => {
		const item: PptxSmartArtLayoutNode = {
			name: 'node',
			constraints: [{ type: 'h', referenceType: 'w', factor: 0.6 }],
		};
		expect(resolveItemSelfAspect(item)).toBe(0.6);
	});

	it("inverts the w-over-h form (basic-process's own layoutDef declares this direction: 1/factor is the h/w aspect)", () => {
		// "Vertical Process"'s real `layout1.xml`: `<dgm:constr type="w"
		// refType="h" fact="1.8"/>` (self-scoped, no `for`). Cached box
		// 180x100pt -> h/w = 100/180 = 0.5556 = 1/1.8 exactly.
		const item: PptxSmartArtLayoutNode = {
			name: 'node',
			constraints: [{ type: 'w', referenceType: 'h', factor: 1.8 }],
		};
		expect(resolveItemSelfAspect(item)).toBeCloseTo(1 / 1.8, 10);
	});

	it('prefers the h-over-w form when a layoutDef somehow declares both', () => {
		const item: PptxSmartArtLayoutNode = {
			name: 'node',
			constraints: [
				{ type: 'h', referenceType: 'w', factor: 0.6 },
				{ type: 'w', referenceType: 'h', factor: 1.8 },
			],
		};
		expect(resolveItemSelfAspect(item)).toBe(0.6);
	});

	it('ignores an ARRANGER-declared (for="ch") h/w constraint: only a genuinely self-scoped one counts', () => {
		const item: PptxSmartArtLayoutNode = {
			name: 'node',
			constraints: [{ type: 'h', referenceType: 'w', factor: 0.6, for: 'ch', forName: 'node' }],
		};
		expect(resolveItemSelfAspect(item)).toBeUndefined();
	});

	it('ignores a non-positive or non-numeric factor on either form', () => {
		expect(
			resolveItemSelfAspect({
				name: 'node',
				constraints: [{ type: 'h', referenceType: 'w', factor: 0 }],
			}),
		).toBeUndefined();
		expect(
			resolveItemSelfAspect({
				name: 'node',
				constraints: [{ type: 'w', referenceType: 'h', factor: -1 }],
			}),
		).toBeUndefined();
	});
});
