import { convertLatexToOmml, convertOmmlToMathMl, sanitizeMathMl } from 'pptx-viewer-shared';
import type { OmmlNode } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeButton } from '../controls';

export interface EquationPanel {
	el: HTMLElement;
	toggle(): void;
	setOpen(open: boolean): void;
	isOpen(): boolean;
	setEditable(editable: boolean): void;
}

/**
 * A simple docked LaTeX equation panel (input + live MathML preview +
 * Insert/Cancel), mirroring `find-replace-panel.ts`'s idiom rather than
 * React's modal `EquationEditorDialog`. Converts the LaTeX source to OMML via
 * the shared `latex-to-omml` module on Insert; the live preview goes through
 * `omml-to-mathml` + `mathml-sanitize` so the injected markup is safe.
 */
export function createEquationPanel(
	doc: Document,
	t: Translator,
	onInsert: (omml: Record<string, unknown>) => void,
): EquationPanel {
	const el = createEl(doc, 'div', 'pptxv-equation-panel');
	el.hidden = true;
	el.setAttribute('role', 'dialog');
	el.setAttribute('aria-label', t('pptx.equation.insertTitle'));

	const preview = createEl(doc, 'div', 'pptxv-equation-preview');
	preview.textContent = t('pptx.equation.previewPlaceholder');

	const textarea = doc.createElement('textarea');
	textarea.className = 'pptxv-equation-input';
	textarea.rows = 3;
	textarea.placeholder = '\\frac{a}{b} + \\sqrt{c}';
	textarea.setAttribute('aria-label', t('pptx.equation.latexInput'));
	textarea.spellcheck = false;

	const hint = createEl(doc, 'span', 'pptxv-equation-hint');
	hint.textContent = t('pptx.equation.latexHint');

	const updatePreview = (): void => {
		const latex = textarea.value.trim();
		if (!latex) {
			preview.textContent = t('pptx.equation.previewPlaceholder');
			return;
		}
		try {
			const omml = convertLatexToOmml(latex);
			const mathml = convertOmmlToMathMl(omml as OmmlNode);
			preview.innerHTML = mathml ? sanitizeMathMl(mathml) : '';
		} catch {
			preview.textContent = t('pptx.equation.previewPlaceholder');
		}
	};

	const insertBtn = makeButton(doc, {
		label: t('pptx.equation.insert'),
		text: t('pptx.equation.insert'),
		onClick: () => {
			const latex = textarea.value.trim();
			if (!latex) {
				return;
			}
			const omml = convertLatexToOmml(latex);
			if (Object.keys(omml).length === 0) {
				return;
			}
			onInsert(omml);
			textarea.value = '';
			updatePreview();
			setOpen(false);
		},
	});
	const cancelBtn = makeButton(doc, {
		label: t('pptx.equation.cancel'),
		text: t('pptx.equation.cancel'),
		onClick: () => setOpen(false),
	});

	textarea.addEventListener('input', updatePreview);
	textarea.addEventListener('keydown', (event) => {
		event.stopPropagation();
		if (event.key === 'Escape') {
			setOpen(false);
		} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			insertBtn.btn.click();
		}
	});

	const row = createEl(doc, 'div', 'pptxv-equation-row');
	row.append(textarea, insertBtn.btn, cancelBtn.btn);
	el.append(row, hint, preview);

	let open = false;
	const setOpen = (next: boolean): void => {
		open = next;
		el.hidden = !open;
		if (open) {
			textarea.focus();
		}
	};

	return {
		el,
		toggle: () => setOpen(!open),
		setOpen,
		isOpen: () => open,
		setEditable(editable) {
			textarea.disabled = !editable;
			insertBtn.setDisabled(!editable);
		},
	};
}
