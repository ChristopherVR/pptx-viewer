import { EQUATION_TEMPLATES } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createEquationPanel } from './equation-panel';

/**
 * Modal equation editor dialog tests: live MathML preview, the shared
 * template gallery, Insert enabling, and edit-mode seeding, mirroring the
 * React `EquationEditorDialog` behavior contract.
 */

function make(onSubmit = vi.fn()) {
	const t = createTranslator();
	const panel = createEquationPanel(document, t, onSubmit);
	document.body.appendChild(panel.el);
	return { panel, onSubmit };
}

function typeLatex(root: HTMLElement, latex: string): HTMLTextAreaElement {
	const textarea = root.querySelector<HTMLTextAreaElement>('.pptxv-eqdlg-input');
	if (!textarea) {
		throw new Error('textarea not found');
	}
	textarea.value = latex;
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
	return textarea;
}

function insertButton(root: HTMLElement): HTMLButtonElement {
	const btn = root.querySelector<HTMLButtonElement>('.pptxv-eqdlg-footer .is-primary');
	if (!btn) {
		throw new Error('insert button not found');
	}
	return btn;
}

describe('createEquationPanel', () => {
	afterEach(() => document.body.replaceChildren());

	it('stays hidden until toggled open as a modal dialog', () => {
		const { panel } = make();
		expect(panel.el.hidden).toBeTruthy();
		panel.toggle();
		expect(panel.el.hidden).toBeFalsy();
		expect(panel.isOpen()).toBeTruthy();
		expect(panel.el.querySelector('[role="dialog"]')).not.toBeNull();
		expect(panel.el.querySelector('.pptxv-eqdlg-backdrop')).not.toBeNull();
	});

	it('shows the placeholder preview and disables Insert until valid LaTeX is entered', () => {
		const { panel } = make();
		panel.toggle();
		const preview = panel.el.querySelector('.pptxv-eqdlg-preview');
		expect(preview?.classList.contains('is-empty')).toBeTruthy();
		expect(preview?.querySelector('mi')).toBeNull();
		expect(insertButton(panel.el).disabled).toBeTruthy();

		typeLatex(panel.el, 'x+y');
		// sanitizeMathMl strips the outer <math> wrapper, keeping the inner
		// MathML token elements (<mi>/<mo>/...).
		expect(preview?.querySelectorAll('mi')).toHaveLength(2);
		expect(insertButton(panel.el).disabled).toBeFalsy();
	});

	it('renders the full shared template gallery and seeds LaTeX on tile click', () => {
		const { panel } = make();
		panel.toggle();
		const tiles = panel.el.querySelectorAll<HTMLButtonElement>('.pptxv-eqdlg-template');
		expect(tiles).toHaveLength(EQUATION_TEMPLATES.length);
		expect(
			tiles[0]?.querySelector('.pptxv-eqdlg-template-math mfrac, .pptxv-eqdlg-template-math mi'),
		).not.toBeNull();

		tiles[0]?.click();
		const textarea = panel.el.querySelector<HTMLTextAreaElement>('.pptxv-eqdlg-input');
		expect(textarea?.value).toBe(EQUATION_TEMPLATES[0]?.latex);
		expect(tiles[0]?.classList.contains('is-active')).toBeTruthy();
		expect(insertButton(panel.el).disabled).toBeFalsy();
	});

	it('submits compiled OMML on Insert and closes with a cleared textarea', () => {
		const { panel, onSubmit } = make();
		panel.toggle();
		typeLatex(panel.el, 'x+y');
		insertButton(panel.el).click();

		expect(onSubmit).toHaveBeenCalledOnce();
		const [omml, id] = onSubmit.mock.calls[0] ?? [];
		expect(Object.keys(omml as Record<string, unknown>).length).toBeGreaterThan(0);
		expect(id).toBeUndefined();
		expect(panel.isOpen()).toBeFalsy();

		panel.toggle();
		expect(panel.el.querySelector<HTMLTextAreaElement>('.pptxv-eqdlg-input')?.value).toBe('');
	});

	it('seeds from the existing OMML in edit mode and submits with the element id', () => {
		const { panel, onSubmit } = make();
		panel.openEdit('eq1', { 'm:oMath': { 'm:r': { 'm:t': 'x' } } });

		expect(panel.isOpen()).toBeTruthy();
		const textarea = panel.el.querySelector<HTMLTextAreaElement>('.pptxv-eqdlg-input');
		expect(textarea?.value).toBe('x');
		insertButton(panel.el).click();
		expect(onSubmit).toHaveBeenCalledWith(expect.any(Object), 'eq1');
	});

	it('opens a fresh insert session (no id, empty LaTeX) after a cancelled edit', () => {
		const { panel, onSubmit } = make();
		panel.openEdit('eq1', { 'm:oMath': { 'm:r': { 'm:t': 'x' } } });
		panel.setOpen(false);

		panel.toggle();
		const textarea = panel.el.querySelector<HTMLTextAreaElement>('.pptxv-eqdlg-input');
		expect(textarea?.value).toBe('');
		typeLatex(panel.el, 'a+b');
		insertButton(panel.el).click();
		expect(onSubmit).toHaveBeenCalledWith(expect.any(Object), undefined);
	});

	it('disables editing surfaces when not editable', () => {
		const { panel } = make();
		panel.toggle();
		typeLatex(panel.el, 'x+y');
		panel.setEditable(false);
		expect(
			panel.el.querySelector<HTMLTextAreaElement>('.pptxv-eqdlg-input')?.disabled,
		).toBeTruthy();
		expect(insertButton(panel.el).disabled).toBeTruthy();
		panel.setEditable(true);
		expect(insertButton(panel.el).disabled).toBeFalsy();
	});
});
