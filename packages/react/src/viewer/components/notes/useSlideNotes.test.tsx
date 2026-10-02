// @vitest-environment happy-dom
import type { PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useSlideNotes } from './useSlideNotes';

beforeAll(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

const mounted: { root: Root; target: HTMLElement }[] = [];
afterEach(() => {
	for (const { root, target } of mounted.splice(0)) {
		act(() => root.unmount());
		target.remove();
	}
});

const slide = (id: string, notes: string): PptxSlide =>
	({ id, rId: id, slideNumber: 1, elements: [], notes }) as PptxSlide;

type Result = ReturnType<typeof useSlideNotes>;

function mountHook(initial: PptxSlide) {
	const latest: { current?: Result } = {};
	const onUpdateNotes = vi.fn();
	function Harness({ active }: { active: PptxSlide }) {
		latest.current = useSlideNotes({
			activeSlide: active,
			isExpanded: true,
			canEdit: true,
			onToggle: vi.fn(),
			onUpdateNotes,
		});
		return null;
	}
	const target = document.createElement('div');
	const root = createRoot(target);
	mounted.push({ root, target });
	act(() => root.render(<Harness active={initial} />));
	return {
		latest,
		onUpdateNotes,
		show: (active: PptxSlide) => act(() => root.render(<Harness active={active} />)),
	};
}

describe('useSlideNotes slide changes', () => {
	it('shows the notes of a slide again after editing it and visiting another slide', () => {
		const a = slide('a', 'Alpha');
		const b = slide('b', '');
		const { latest, show } = mountHook(a);
		expect(latest.current!.draft).toBe('Alpha');

		// The edit round-trips through the host: slide A now holds the saved text.
		const edited = slide('a', 'Alpha beta');
		act(() => {
			latest.current!.handlePlainChange({
				target: { value: 'Alpha beta' },
			} as React.ChangeEvent<HTMLTextAreaElement>);
		});
		act(() => latest.current!.handleBlur());
		show(edited);
		expect(latest.current!.draft).toBe('Alpha beta');

		show(b);
		expect(latest.current!.draft).toBe('');

		// Returning must re-seed from the slide, not keep slide B's draft because
		// the text equals the last value this editor saved.
		show(edited);
		expect(latest.current!.draft).toBe('Alpha beta');
	});
});
