import {
	compileEquationTemplateMathMl,
	convertLatexToOmml,
	convertOmmlToLatex,
	EQUATION_TEMPLATES,
	latexToMathMl,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeButton } from '../controls';

export interface EquationPanel {
	el: HTMLElement;
	toggle(): void;
	setOpen(open: boolean): void;
	isOpen(): boolean;
	setEditable(editable: boolean): void;
	openEdit(id: string, omml: Record<string, unknown>): void;
}

/**
 * Modal LaTeX equation editor mirroring React's `EquationEditorDialog`: a
 * live MathML preview, a LaTeX textarea, and the shared template gallery
 * (`EQUATION_TEMPLATES`), with Ctrl+Enter to insert and Escape/backdrop to
 * dismiss. Converts the LaTeX source to OMML via the shared `latex-to-omml`
 * module on Insert; every rendered MathML string goes through
 * `mathml-sanitize` before `innerHTML`.
 *
 * The persistent root element idiom (create once, toggle `hidden`) matches
 * `find-replace-panel.ts` so the ribbon keeps one stable instance to route
 * `openEquationEditor` calls to.
 */
export function createEquationPanel(
	doc: Document,
	t: Translator,
	onSubmit: (omml: Record<string, unknown>, id?: string) => void,
): EquationPanel {
	const el = createEl(doc, 'div', 'pptxv-eqdlg-root');
	el.hidden = true;

	const backdrop = createEl(doc, 'button', 'pptxv-eqdlg-backdrop') as HTMLButtonElement;
	backdrop.type = 'button';
	backdrop.setAttribute('aria-label', t('pptx.equation.cancel'));

	const dialog = createEl(doc, 'section', 'pptxv-eqdlg');
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');
	dialog.setAttribute('aria-label', t('pptx.equation.insertTitle'));

	const header = createEl(doc, 'header', 'pptxv-eqdlg-header');
	const heading = createEl(doc, 'h2');
	heading.textContent = t('pptx.equation.insertTitle');
	const closeButton = createEl(doc, 'button', 'pptxv-eqdlg-close') as HTMLButtonElement;
	closeButton.type = 'button';
	closeButton.textContent = '×';
	closeButton.setAttribute('aria-label', t('pptx.settings.close'));
	header.append(heading, closeButton);

	const preview = createEl(doc, 'div', 'pptxv-eqdlg-preview');

	const field = createEl(doc, 'label', 'pptxv-eqdlg-field');
	const fieldLabel = createEl(doc, 'span', 'pptxv-eqdlg-label');
	fieldLabel.textContent = t('pptx.equation.latexInput');
	const textarea = doc.createElement('textarea');
	textarea.className = 'pptxv-eqdlg-input';
	textarea.rows = 3;
	textarea.placeholder = '\\frac{a}{b} + \\sqrt{c}';
	textarea.spellcheck = false;
	const hint = createEl(doc, 'span', 'pptxv-eqdlg-hint');
	hint.textContent = t('pptx.equation.latexHint');
	field.append(fieldLabel, textarea, hint);

	// Shared template gallery: each tile renders its formula as MathML and
	// seeds the textarea with the template's LaTeX when clicked.
	const templates = createEl(doc, 'div', 'pptxv-eqdlg-field');
	const templatesTitle = createEl(doc, 'span', 'pptxv-eqdlg-label');
	templatesTitle.textContent = t('pptx.equation.templates');
	const grid = createEl(doc, 'div', 'pptxv-eqdlg-grid');
	const tiles: HTMLButtonElement[] = [];
	const templateMathMl = compileEquationTemplateMathMl();
	for (const [tmplIndex, tmpl] of EQUATION_TEMPLATES.entries()) {
		const tile = createEl(doc, 'button', 'pptxv-eqdlg-template') as HTMLButtonElement;
		tile.type = 'button';
		tile.title = t(tmpl.i18nKey);
		const math = createEl(doc, 'span', 'pptxv-eqdlg-template-math');
		math.innerHTML = templateMathMl[tmplIndex] ?? '';
		const label = createEl(doc, 'span', 'pptxv-eqdlg-template-label');
		label.textContent = t(tmpl.i18nKey);
		tile.append(math, label);
		tile.addEventListener('click', () => {
			textarea.value = tmpl.latex;
			onLatexChanged();
			textarea.focus();
		});
		grid.appendChild(tile);
		tiles.push(tile);
	}
	templates.append(templatesTitle, grid);

	/** OMML compiled from the current LaTeX; null when empty or invalid. */
	const compileOmml = (): Record<string, unknown> | null => {
		const latex = textarea.value.trim();
		if (!latex) {
			return null;
		}
		try {
			const omml = convertLatexToOmml(latex);
			return Object.keys(omml).length > 0 ? omml : null;
		} catch {
			return null;
		}
	};

	let editable = true;
	let editingId: string | undefined;

	const footer = createEl(doc, 'footer', 'pptxv-eqdlg-footer');
	const cancelBtn = makeButton(doc, {
		label: t('pptx.equation.cancel'),
		text: t('pptx.equation.cancel'),
		onClick: () => setOpen(false),
	});
	const insertBtn = makeButton(doc, {
		label: t('pptx.equation.insert'),
		text: t('pptx.equation.insert'),
		onClick: () => {
			const omml = compileOmml();
			if (!omml) {
				return;
			}
			onSubmit(omml, editingId);
			textarea.value = '';
			onLatexChanged();
			setOpen(false);
		},
	});
	insertBtn.btn.classList.add('is-primary');
	footer.append(cancelBtn.btn, insertBtn.btn);

	dialog.append(header, preview, field, templates, footer);
	el.append(backdrop, dialog);

	/** Refresh preview, active-tile highlight, and Insert enabling. */
	const onLatexChanged = (): void => {
		const mathml = latexToMathMl(textarea.value);
		if (mathml) {
			preview.classList.remove('is-empty');
			preview.innerHTML = mathml;
		} else {
			preview.classList.add('is-empty');
			preview.textContent = t('pptx.equation.previewPlaceholder');
		}
		const latex = textarea.value;
		for (const [index, tile] of tiles.entries()) {
			tile.classList.toggle('is-active', EQUATION_TEMPLATES[index]?.latex === latex);
		}
		insertBtn.setDisabled(!editable || compileOmml() === null);
	};

	textarea.addEventListener('input', onLatexChanged);
	el.addEventListener('keydown', (event) => {
		event.stopPropagation();
		if (event.key === 'Escape') {
			setOpen(false);
		} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			insertBtn.btn.click();
		}
	});
	backdrop.addEventListener('click', () => setOpen(false));
	closeButton.addEventListener('click', () => setOpen(false));

	let open = false;
	const setOpen = (next: boolean): void => {
		open = next;
		el.hidden = !open;
		if (open) {
			textarea.focus();
		} else {
			editingId = undefined;
		}
	};
	const syncMode = (): void => {
		const editing = editingId !== undefined;
		const title = t(editing ? 'pptx.equation.editTitle' : 'pptx.equation.insertTitle');
		const action = t(editing ? 'pptx.equation.update' : 'pptx.equation.insert');
		dialog.setAttribute('aria-label', title);
		heading.textContent = title;
		insertBtn.btn.textContent = action;
		insertBtn.btn.title = action;
		insertBtn.btn.setAttribute('aria-label', action);
	};
	onLatexChanged();

	return {
		el,
		toggle: () => {
			if (!open) {
				// Fresh insert session: never leak a previous session's LaTeX.
				editingId = undefined;
				textarea.value = '';
				syncMode();
				onLatexChanged();
			}
			setOpen(!open);
		},
		setOpen,
		isOpen: () => open,
		setEditable(next) {
			editable = next;
			textarea.disabled = !next;
			insertBtn.setDisabled(!next || compileOmml() === null);
		},
		openEdit(id, omml) {
			editingId = id;
			textarea.value = convertOmmlToLatex(omml);
			syncMode();
			onLatexChanged();
			setOpen(true);
		},
	};
}
