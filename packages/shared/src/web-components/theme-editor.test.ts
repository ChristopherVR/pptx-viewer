// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from '.';
import { createThemeEditorEdit, PRESET_THEMES, themeEditorLabels } from '../render';
import type { ThemeEditorApplyEvent } from './theme-editor';

registerPptxWebControls();
afterEach(() => document.body.replaceChildren());
const theme = {
	name: 'Loaded',
	colorScheme: { ...PRESET_THEMES[0].colorScheme, accent1: '#123456' },
	fontScheme: {
		majorFont: { latin: 'Custom Font', eastAsia: 'Yu Gothic' },
		minorFont: { latin: 'Verdana' },
	},
};

function editor() {
	const node = document.createElement('pptx-ui-theme-editor');
	node.setAttribute('inline', '');
	node.theme = structuredClone(theme);
	node.labels = themeEditorLabels((key) => key);
	document.body.append(node);
	return node;
}

describe('shared theme editor', () => {
	it('stages edits, retains font metadata and emits one detached apply payload', () => {
		const node = editor();
		const apply = vi.fn();
		node.addEventListener('theme-editor-apply', apply);
		const input = node.shadowRoot!.querySelector<HTMLInputElement>('input[type=text]')!;
		input.value = 'Draft';
		input.dispatchEvent(new Event('input'));
		expect(node.theme!.name).toBe('Loaded');
		expect(apply).not.toHaveBeenCalled();
		node.shadowRoot!.querySelector<HTMLButtonElement>('.apply')!.click();
		expect(apply).toHaveBeenCalledOnce();
		const edit = (apply.mock.calls[0][0] as ThemeEditorApplyEvent).detail;
		expect(edit.name).toBe('Draft');
		expect(edit.fontScheme.majorFont?.eastAsia).toBe('Yu Gothic');
		edit.colorScheme.accent1 = '#ff0000';
		expect(node.theme!.colorScheme!.accent1).toBe('#123456');
	});

	it('keeps drafts during controlled refresh and Reset reads the current host theme', () => {
		const node = editor();
		node.shadowRoot!.querySelectorAll<HTMLButtonElement>('.preset')[1].click();
		const name = node.shadowRoot!.querySelector<HTMLInputElement>('input[type=text]')!;
		expect(name.value).toBe('Facet');
		node.theme = { ...theme, name: 'External update' };
		expect(name.value).toBe('Facet');
		node.shadowRoot!.querySelectorAll<HTMLButtonElement>('.actions button')[1].click();
		expect(name.value).toBe('External update');
	});

	it('enforces disabled state for edits and apply while preserving dismissal', () => {
		const node = editor();
		const apply = vi.fn();
		const close = vi.fn();
		node.addEventListener('theme-editor-apply', apply);
		node.addEventListener('theme-editor-close', close);
		node.disabled = true;
		const field = node.shadowRoot!.querySelector<HTMLInputElement>('input[type=text]')!;
		field.value = 'Attempt';
		field.dispatchEvent(new Event('input'));
		node.shadowRoot!.querySelector<HTMLButtonElement>('.apply')!.click();
		expect(apply).not.toHaveBeenCalled();
		node.shadowRoot!.querySelector<HTMLButtonElement>('.close')!.click();
		expect(close).toHaveBeenCalledOnce();
	});

	it('preserves unknown fonts and isolates two instances through reconnect', () => {
		const first = editor();
		const second = editor();
		const select = first.shadowRoot!.querySelector('pptx-ui-select')!;
		expect(select.value).toBe('Custom Font');
		expect(Array.from(select.options).map((option) => option.value)).toContain('Custom Font');
		first.shadowRoot!.querySelectorAll<HTMLButtonElement>('.preset')[1].click();
		first.remove();
		document.body.append(first);
		expect(second.shadowRoot!.querySelector<HTMLInputElement>('input[type=text]')!.value).toBe(
			'Loaded',
		);
		expect(first.shadowRoot!.querySelector<HTMLInputElement>('input[type=text]')!.value).toBe(
			'Facet',
		);
	});

	it('normalizes missing slots without changing the supplied theme', () => {
		const original = { name: 'Partial', colorScheme: { accent1: '#123456' } };
		const draft = createThemeEditorEdit(original);
		expect(Object.keys(draft.colorScheme)).toHaveLength(12);
		expect(original.colorScheme).toStrictEqual({ accent1: '#123456' });
	});
});
