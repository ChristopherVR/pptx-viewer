// @vitest-environment jsdom
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { getElementInteractionProps } from './element-interaction-props';

function element(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'el-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		...overrides,
	} as unknown as PptxElement;
}

function fakeDiv(): HTMLDivElement {
	const el = document.createElement('div');
	return el;
}

describe('getElementInteractionProps - @highlightClick flash', () => {
	it('flashes filter+outline on click when actionClick.highlightClick is set', () => {
		vi.useFakeTimers();
		const el = element({ actionClick: { action: 'ppaction://noaction', highlightClick: true } });
		const props = getElementInteractionProps({
			element: el,
			isEditableText: false,
			canInteract: false,
			isInlineEditing: false,
			isActionable: true,
			isPresentationPassive: false,
			onInlineEditCancel: vi.fn(),
			onActionClick: vi.fn(),
		});
		const target = fakeDiv();
		props.onClick?.({
			currentTarget: target,
			ctrlKey: false,
			metaKey: false,
			stopPropagation: vi.fn(),
			preventDefault: vi.fn(),
		} as never);
		expect(target.style.filter).toBe('brightness(1.18)');
		expect(target.style.outline).toBe('2px solid rgba(59, 130, 246, 0.6)');
		vi.advanceTimersByTime(320);
		expect(target.style.filter).toBe('');
		expect(target.style.outline).toBe('');
		vi.useRealTimers();
	});

	it('does not flash on click when highlightClick is unset', () => {
		const el = element({ actionClick: { action: 'ppaction://noaction' } });
		const props = getElementInteractionProps({
			element: el,
			isEditableText: false,
			canInteract: false,
			isInlineEditing: false,
			isActionable: true,
			isPresentationPassive: false,
			onInlineEditCancel: vi.fn(),
			onActionClick: vi.fn(),
		});
		const target = fakeDiv();
		props.onClick?.({
			currentTarget: target,
			ctrlKey: false,
			metaKey: false,
			stopPropagation: vi.fn(),
			preventDefault: vi.fn(),
		} as never);
		expect(target.style.filter).toBe('');
		expect(target.style.outline).toBe('');
	});

	it('flashes on mouse-enter and clears on mouse-leave when actionHover.highlightClick is set', () => {
		const el = element({ actionHover: { action: 'ppaction://noaction', highlightClick: true } });
		const props = getElementInteractionProps({
			element: el,
			isEditableText: false,
			canInteract: false,
			isInlineEditing: false,
			isActionable: false,
			isPresentationPassive: false,
			onInlineEditCancel: vi.fn(),
			onActionClick: vi.fn(),
		});
		const target = fakeDiv();
		props.onMouseEnter?.({ currentTarget: target } as never);
		expect(target.style.filter).toBe('brightness(1.15)');
		expect(target.style.outline).toBe('2px solid rgba(59, 130, 246, 0.5)');
		expect(props.onMouseLeave).toBeDefined();
		props.onMouseLeave?.({ currentTarget: target } as never);
		expect(target.style.filter).toBe('');
		expect(target.style.outline).toBe('');
	});

	it('has no onMouseLeave handler when actionHover carries no highlightClick', () => {
		const el = element({ actionHover: { action: 'ppaction://noaction' } });
		const props = getElementInteractionProps({
			element: el,
			isEditableText: false,
			canInteract: false,
			isInlineEditing: false,
			isActionable: false,
			isPresentationPassive: false,
			onInlineEditCancel: vi.fn(),
			onActionClick: vi.fn(),
		});
		expect(props.onMouseLeave).toBeUndefined();
	});
});
