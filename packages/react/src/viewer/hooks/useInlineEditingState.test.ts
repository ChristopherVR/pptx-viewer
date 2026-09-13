// @vitest-environment happy-dom
import type { InlineTextEditSnapshot } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInlineEditingState } from './useInlineEditingState';
import type { InlineEditingState } from './useInlineEditingState';

let host: HTMLDivElement;
let root: Root;
let state: InlineEditingState;

function Probe({ onTextChange }: { onTextChange: (id: string | null, text: string) => void }) {
	state = useInlineEditingState(onTextChange);
	return null;
}

function mount(onTextChange = vi.fn()) {
	act(() => root.render(React.createElement(Probe, { onTextChange })));
	return onTextChange;
}

function snapshot(elementId = 'shape-a', text = 'Body'): InlineTextEditSnapshot {
	return { elementId, text, textSegments: [{ text, style: { bold: true, color: '#CC00AA' } }] };
}

beforeEach(() => {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
});

afterEach(() => {
	act(() => root.unmount());
	host.remove();
});

describe('useInlineEditingState', () => {
	it('mirrors a valid rich draft before React flushes the state update', () => {
		const publish = mount();
		const draft = snapshot();
		act(() => {
			state.setInlineEditingElementId('shape-a');
			state.setInlineEditingText('Body', draft);
			expect(state.inlineEditingElementIdRef.current).toBe('shape-a');
			expect(state.inlineEditingTextRef.current).toBe('Body');
			expect(state.inlineEditingSnapshotRef.current).toBe(draft);
			expect(publish).toHaveBeenCalledExactlyOnceWith('shape-a', 'Body');
		});
		expect(state.inlineEditingElementId).toBe('shape-a');
		expect(state.inlineEditingText).toBe('Body');
		expect(state.inlineEditingSnapshotRef.current?.textSegments).toBe(draft.textSegments);
	});

	it('resolves batched functional text updates once from the latest synchronous value', () => {
		const publish = mount();
		const first = vi.fn((text: string) => `${text}A`);
		const second = vi.fn((text: string) => `${text}B`);
		act(() => {
			state.setInlineEditingElementId('shape-a');
			state.setInlineEditingText(first);
			state.setInlineEditingText(second);
			expect(state.inlineEditingTextRef.current).toBe('AB');
		});
		expect(first).toHaveBeenCalledExactlyOnceWith('');
		expect(second).toHaveBeenCalledExactlyOnceWith('A');
		expect(state.inlineEditingText).toBe('AB');
		expect(publish.mock.calls).toStrictEqual([
			['shape-a', 'A'],
			['shape-a', 'AB'],
		]);
	});

	it('resolves batched functional element setters once and invalidates the old snapshot', () => {
		mount();
		const first = vi.fn((id: string | null) => `${id}-b`);
		const second = vi.fn((id: string | null) => `${id}-c`);
		act(() => {
			state.setInlineEditingElementId('shape-a');
			state.setInlineEditingText('Body', snapshot());
			state.setInlineEditingElementId(first);
			state.setInlineEditingElementId(second);
			expect(state.inlineEditingSnapshotRef.current).toBeUndefined();
		});
		expect(first).toHaveBeenCalledExactlyOnceWith('shape-a');
		expect(second).toHaveBeenCalledExactlyOnceWith('shape-a-b');
		expect(state.inlineEditingElementId).toBe('shape-a-b-c');
		expect(state.inlineEditingElementIdRef.current).toBe('shape-a-b-c');
	});

	it('clears rich state on a current plain or unsupported-text update, even when text is equal', () => {
		mount();
		act(() => {
			state.setInlineEditingElementId('shape-a');
			state.setInlineEditingText('Body', snapshot());
			state.setInlineEditingText('Body');
			expect(state.inlineEditingSnapshotRef.current).toBeUndefined();
			expect(state.inlineEditingTextRef.current).toBe('Body');
			state.setInlineEditingText('Body', snapshot());
			state.setInlineEditingText('Current unsupported body');
			expect(state.inlineEditingSnapshotRef.current).toBeUndefined();
			expect(state.inlineEditingTextRef.current).toBe('Current unsupported body');
		});
	});

	it.each([
		['wrong element', snapshot('shape-b')],
		['wrong text', snapshot('shape-a', 'Stale body')],
	])('rejects a %s snapshot without losing the latest plain text', (_label, invalid) => {
		mount();
		act(() => {
			state.setInlineEditingElementId('shape-a');
			state.setInlineEditingText('Body', snapshot());
			state.setInlineEditingText('Body', invalid);
			expect(state.inlineEditingSnapshotRef.current).toBeUndefined();
			expect(state.inlineEditingTextRef.current).toBe('Body');
		});
	});

	it('clears on close and does not revive a snapshot when the same element reopens', () => {
		mount();
		const draft = snapshot();
		act(() => {
			state.setInlineEditingElementId('shape-a');
			state.setInlineEditingText('Body', draft);
			state.setInlineEditingElementId('shape-a');
			expect(state.inlineEditingSnapshotRef.current).toBe(draft);
			state.setInlineEditingElementId(null);
			expect(state.inlineEditingSnapshotRef.current).toBeUndefined();
			state.setInlineEditingElementId('shape-a');
			expect(state.inlineEditingSnapshotRef.current).toBeUndefined();
		});
	});

	it('does not retain rich state without an active element and preserves peer text callbacks', () => {
		const publish = mount();
		act(() => state.setInlineEditingText('Body', snapshot()));
		expect(state.inlineEditingSnapshotRef.current).toBeUndefined();
		expect(state.inlineEditingText).toBe('Body');
		expect(publish).toHaveBeenCalledExactlyOnceWith(null, 'Body');
	});

	it('uses the latest peer callback after rerender while keeping synchronous refs stable', () => {
		const oldPublish = mount();
		const oldRefs = [
			state.inlineEditingElementIdRef,
			state.inlineEditingTextRef,
			state.inlineEditingSnapshotRef,
		];
		const newPublish = vi.fn();
		mount(newPublish);
		act(() => {
			state.setInlineEditingElementId('shape-a');
			state.setInlineEditingText('Body', snapshot());
		});
		expect(oldPublish).not.toHaveBeenCalled();
		expect(newPublish).toHaveBeenCalledExactlyOnceWith('shape-a', 'Body');
		expect([
			state.inlineEditingElementIdRef,
			state.inlineEditingTextRef,
			state.inlineEditingSnapshotRef,
		]).toStrictEqual(oldRefs);
	});

	it('keeps two viewer instances isolated even when their element IDs match', () => {
		let other!: InlineEditingState;
		function Pair() {
			state = useInlineEditingState(vi.fn());
			other = useInlineEditingState(vi.fn());
			return null;
		}
		act(() => root.render(React.createElement(Pair)));
		act(() => {
			state.setInlineEditingElementId('shape-a');
			other.setInlineEditingElementId('shape-a');
			state.setInlineEditingText('Body', snapshot());
		});
		expect(other.inlineEditingTextRef.current).toBe('');
		expect(other.inlineEditingSnapshotRef.current).toBeUndefined();
		expect(state.inlineEditingSnapshotRef.current?.text).toBe('Body');
	});
});
