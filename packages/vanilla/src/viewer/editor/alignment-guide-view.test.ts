import type { Guide } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { syncAlignmentGuides } from './alignment-guide-view';

function makeRoot(): HTMLElement {
	const root = document.createElement('div');
	// The guide's drag maths reads its offsetParent's bounding rect, so the
	// root needs a real CSS position for happy-dom to resolve one; the
	// resulting rect is all-zero, which is fine since these tests only assert
	// the callback fired with SOME finite number.
	root.style.position = 'relative';
	document.body.appendChild(root);
	return root;
}

function guide(overrides: Partial<Guide> = {}): Guide {
	return { id: 'g1', axis: 'h', position: 100, ...overrides };
}

describe('syncAlignmentGuides', () => {
	it('renders a line per guide, positioned by axis and scale', () => {
		const root = makeRoot();
		syncAlignmentGuides(document, root, [guide({ axis: 'h', position: 100 })], 2);

		const line = root.querySelector<HTMLElement>('.pptxv-alignment-guide')!;
		expect(line.className).toContain('is-h');
		expect(line.style.top).toBe('200px');
	});

	it('positions a vertical guide via left instead of top', () => {
		const root = makeRoot();
		syncAlignmentGuides(document, root, [guide({ axis: 'v', position: 50 })], 1);

		const line = root.querySelector<HTMLElement>('.pptxv-alignment-guide')!;
		expect(line.className).toContain('is-v');
		expect(line.style.left).toBe('50px');
	});

	it('removes a stale guide no longer in the list', () => {
		const root = makeRoot();
		syncAlignmentGuides(document, root, [guide({ id: 'a' }), guide({ id: 'b' })], 1);
		expect(root.querySelectorAll('.pptxv-alignment-guide')).toHaveLength(2);

		syncAlignmentGuides(document, root, [guide({ id: 'a' })], 1);
		expect(root.querySelectorAll('.pptxv-alignment-guide')).toHaveLength(1);
	});

	it('reuses the SAME DOM node across syncs for an id that persists', () => {
		const root = makeRoot();
		syncAlignmentGuides(document, root, [guide({ position: 10 })], 1, {
			onMoveGuide: vi.fn(),
			onRemoveGuide: vi.fn(),
		});
		const first = root.querySelector('.pptxv-alignment-guide');

		syncAlignmentGuides(document, root, [guide({ position: 20 })], 1, {
			onMoveGuide: vi.fn(),
			onRemoveGuide: vi.fn(),
		});
		const second = root.querySelector('.pptxv-alignment-guide');

		// Same node: a naive remove-and-recreate would drop mid-drag pointer
		// capture, which is exactly what this reconciliation exists to avoid.
		expect(second).toBe(first);
		expect((second as HTMLElement).style.top).toBe('20px');
	});

	it('does not mark the guide interactive when no callbacks are given', () => {
		const root = makeRoot();
		syncAlignmentGuides(document, root, [guide()], 1);

		const line = root.querySelector<HTMLElement>('.pptxv-alignment-guide')!;
		expect(line.className).not.toContain('is-interactive');
	});

	it('marks the guide interactive when callbacks are given', () => {
		const root = makeRoot();
		syncAlignmentGuides(document, root, [guide()], 1, {
			onMoveGuide: vi.fn(),
			onRemoveGuide: vi.fn(),
		});

		const line = root.querySelector<HTMLElement>('.pptxv-alignment-guide')!;
		expect(line.className).toContain('is-interactive');
	});

	it('calls onMoveGuide while the pointer is captured and dragging', () => {
		const root = makeRoot();
		const onMoveGuide = vi.fn();
		syncAlignmentGuides(document, root, [guide({ axis: 'h' })], 1, {
			onMoveGuide,
			onRemoveGuide: vi.fn(),
		});
		const line = root.querySelector<HTMLElement>('.pptxv-alignment-guide')!;
		// happy-dom does not run real layout, so `offsetParent` (the stage the
		// drag maths measures against) is never computed; stub it so the
		// pointermove handler's `getBoundingClientRect()` call has something to
		// call, matching what a real browser gives it for a positioned root.
		Object.defineProperty(line, 'offsetParent', { value: root, configurable: true });

		line.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
		expect(line.hasPointerCapture(1)).toBeTruthy();

		line.dispatchEvent(
			new PointerEvent('pointermove', { pointerId: 1, clientY: 40, bubbles: true }),
		);

		expect(onMoveGuide).toHaveBeenCalledWith('g1', expect.any(Number));
	});

	it('does not call onMoveGuide for a pointer that never captured', () => {
		const root = makeRoot();
		const onMoveGuide = vi.fn();
		syncAlignmentGuides(document, root, [guide()], 1, { onMoveGuide, onRemoveGuide: vi.fn() });
		const line = root.querySelector<HTMLElement>('.pptxv-alignment-guide')!;

		line.dispatchEvent(
			new PointerEvent('pointermove', { pointerId: 1, clientY: 40, bubbles: true }),
		);

		expect(onMoveGuide).not.toHaveBeenCalled();
	});

	it('releases pointer capture on pointerup', () => {
		const root = makeRoot();
		syncAlignmentGuides(document, root, [guide()], 1, {
			onMoveGuide: vi.fn(),
			onRemoveGuide: vi.fn(),
		});
		const line = root.querySelector<HTMLElement>('.pptxv-alignment-guide')!;

		line.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
		expect(line.hasPointerCapture(1)).toBeTruthy();
		line.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
		expect(line.hasPointerCapture(1)).toBeFalsy();
	});

	it('calls onRemoveGuide with the guide id on double-click', () => {
		const root = makeRoot();
		const onRemoveGuide = vi.fn();
		syncAlignmentGuides(document, root, [guide({ id: 'g7' })], 1, {
			onMoveGuide: vi.fn(),
			onRemoveGuide,
		});
		const line = root.querySelector<HTMLElement>('.pptxv-alignment-guide')!;

		line.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(onRemoveGuide).toHaveBeenCalledWith('g7');
	});
});
