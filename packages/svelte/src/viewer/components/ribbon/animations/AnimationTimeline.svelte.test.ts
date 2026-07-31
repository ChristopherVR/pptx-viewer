import {
	DIRECTION_VALUES,
	REPEAT_MODE_VALUES,
	SEQUENCE_VALUES,
	TIMING_CURVE_VALUES,
	TRIGGER_VALUES,
} from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import {
	DIRECTION_LABEL_KEYS,
	REPEAT_MODE_LABEL_KEYS,
	SEQUENCE_LABEL_KEYS,
	TIMING_CURVE_LABEL_KEYS,
	TRIGGER_LABEL_KEYS,
} from './animation-timeline-labels';
import AnimationTimeline from './AnimationTimeline.svelte';

/**
 * The timeline row's five schema selects printed their shared vocabulary
 * verbatim (`onShapeClick`, `fromBottomRight`, `ease-in`, `untilEndOfSlide`).
 * These tests pin the translated text AND the untouched value sets: the row
 * still offers every value the shared vocabularies carry.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function values(select: HTMLSelectElement): string[] {
	return Array.from(select.options).map((option) => option.value);
}

function texts(select: HTMLSelectElement): string[] {
	return Array.from(select.options).map((option) => option.textContent?.trim() ?? '');
}

function translated(keys: Readonly<Record<string, string>>, tokens: readonly string[]): string[] {
	return tokens.map((token) => translationsEn[keys[token]]);
}

function mountTimeline(): { target: HTMLElement; editor: EditorState } {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [],
			animations: [{ elementId: 'e1', preset: 'fadeIn', order: 1 }],
		},
	]);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AnimationTimeline, { target, props: { editor } });
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	flushSync();
	return { target, editor };
}

function selectByAriaLabel(root: ParentNode, label: string): HTMLSelectElement {
	const select = root.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
	if (!select) {
		throw new Error(`no select labelled "${label}"`);
	}
	return select;
}

describe('animationTimeline schema selects', () => {
	const CASES: Array<[string, readonly string[], Readonly<Record<string, string>>]> = [
		['Trigger', TRIGGER_VALUES, TRIGGER_LABEL_KEYS],
		['Direction', DIRECTION_VALUES, DIRECTION_LABEL_KEYS],
		['Sequence', SEQUENCE_VALUES, SEQUENCE_LABEL_KEYS],
		['Timing curve', TIMING_CURVE_VALUES, TIMING_CURVE_LABEL_KEYS],
		['Repeat', REPEAT_MODE_VALUES, REPEAT_MODE_LABEL_KEYS],
	];

	it.each(CASES)('spells the %s tokens without changing its values', (label, tokens, keys) => {
		const { target } = mountTimeline();
		const select = selectByAriaLabel(target, label);

		expect(values(select)).toStrictEqual([...tokens]);
		expect(texts(select)).toStrictEqual(translated(keys, tokens));
		// The defect shape: an option whose visible text is its own wire token.
		expect(texts(select).filter((text, index) => text === tokens[index])).toStrictEqual([]);
	});

	it('keeps every select accessible name exactly as it was', () => {
		const { target } = mountTimeline();
		const labels = Array.from(target.querySelectorAll('select')).map((select) =>
			select.getAttribute('aria-label'),
		);

		expect(labels).toStrictEqual(['Trigger', 'Direction', 'Sequence', 'Timing curve', 'Repeat']);
	});

	it('still commits the wire token when a trigger is picked', () => {
		const { target, editor } = mountTimeline();
		const trigger = selectByAriaLabel(target, 'Trigger');
		trigger.value = 'afterPrevious';
		trigger.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(editor.slides[0]?.animations?.[0]?.trigger).toBe('afterPrevious');
	});
});
