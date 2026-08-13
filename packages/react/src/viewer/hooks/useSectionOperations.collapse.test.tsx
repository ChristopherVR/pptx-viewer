// @vitest-environment happy-dom
/**
 * Does collapsing a section survive a save?
 *
 * `p14:section/@collapsed` round-trips through core, and Vue, Angular, Svelte
 * and Vanilla all write the flag back onto the section model. React alone kept
 * it in the slides pane's component-local `useState`, so `SectionOperations`
 * had no `toggleSectionCollapse` at all and a collapsed section was forgotten
 * the moment the deck was saved (or the pane unmounted).
 *
 * This drives the REAL hook over real React state, because the bug was that
 * the operation did not exist on the interface every binding shares.
 */
import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { useSectionOperations } from './useSectionOperations';
import type { SectionOperations } from './useSectionOperations';

interface HarnessApi {
	ops: SectionOperations;
	sections: PptxSection[];
}

let api: HarnessApi | null = null;
let dirtyCount = 0;

function Harness({ initial }: { initial: PptxSection[] }): null {
	const [sections, setSections] = useState<PptxSection[]>(initial);
	const [slides, setSlides] = useState<PptxSlide[]>([]);
	const ops = useSectionOperations({
		sections,
		setSections,
		slides,
		setSlides,
		markDirty: () => {
			dirtyCount += 1;
		},
	});
	api = { ops, sections };
	return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function mount(initial: PptxSection[]): void {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	act(() => {
		root?.render(<Harness initial={initial} />);
	});
}

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	host?.remove();
	root = null;
	host = null;
	api = null;
	dirtyCount = 0;
});

const SECTIONS: PptxSection[] = [
	{ id: 'sec1', name: 'Intro', slideIds: ['1'] },
	{ id: 'sec2', name: 'Body', slideIds: ['2'], collapsed: true },
];

describe('useSectionOperations collapse', () => {
	it('exposes toggleSectionCollapse, the operation the other four bindings have', () => {
		mount(SECTIONS);
		expect(api?.ops.toggleSectionCollapse).toBeTypeOf('function');
	});

	it('writes the flag onto the section model, so a save can persist it', () => {
		mount(SECTIONS);
		act(() => {
			api?.ops.toggleSectionCollapse('sec1');
		});

		expect(api?.sections[0].collapsed).toBeTruthy();
		// Untouched sections keep their own flag, including an authored `true`.
		expect(api?.sections[1].collapsed).toBeTruthy();
	});

	it('expands a section that arrived collapsed', () => {
		mount(SECTIONS);
		act(() => {
			api?.ops.toggleSectionCollapse('sec2');
		});

		expect(api?.sections[1].collapsed).toBeFalsy();
		expect(api?.sections[0].collapsed).toBeUndefined();
	});

	it('marks the deck dirty, so the change is offered for save', () => {
		mount(SECTIONS);
		act(() => {
			api?.ops.toggleSectionCollapse('sec1');
		});

		expect(dirtyCount).toBe(1);
	});

	it('leaves the sections array untouched for an unknown id', () => {
		mount(SECTIONS);
		act(() => {
			api?.ops.toggleSectionCollapse('nope');
		});

		expect(api?.sections.map((s) => s.collapsed)).toStrictEqual([undefined, true]);
	});
});
