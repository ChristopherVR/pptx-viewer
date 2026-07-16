import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxSlide,
} from 'pptx-viewer-core';
import { computeDocumentStatistics } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface DocumentPropertiesDialogOptions {
	slides: readonly PptxSlide[];
	core?: PptxCoreProperties;
	app?: PptxAppProperties;
	custom: readonly PptxCustomProperty[];
	editable: boolean;
	onSave(core: PptxCoreProperties, app: PptxAppProperties, custom: PptxCustomProperty[]): void;
}

type DialogTab = 'summary' | 'statistics' | 'custom';

/** Open the React-style Document Properties modal and return its overlay. */
export function openDocumentPropertiesDialog(
	doc: Document,
	t: Translator,
	options: DocumentPropertiesDialogOptions,
): HTMLElement {
	const overlay = createEl(doc, 'div', 'pptxv-props-overlay');
	const scrim = createEl(doc, 'button', 'pptxv-props-scrim');
	scrim.setAttribute('aria-label', t('pptx.common.close'));
	const dialog = createEl(doc, 'div', 'pptxv-props-dialog');
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');
	dialog.setAttribute('aria-labelledby', 'pptxv-props-title');
	const core: PptxCoreProperties = structuredClone(options.core ?? {});
	const app: PptxAppProperties = structuredClone(options.app ?? {});
	let custom: PptxCustomProperty[] = options.custom.map((property) => ({ ...property }));
	const original = JSON.stringify({ core, app, custom });

	const close = (): void => overlay.remove();
	scrim.addEventListener('click', close);
	const header = createEl(doc, 'header');
	const title = createEl(doc, 'h2');
	title.id = 'pptxv-props-title';
	title.textContent = t('pptx.documentProperties.dialogTitle');
	const closeButton = createEl(doc, 'button');
	closeButton.type = 'button';
	closeButton.setAttribute('aria-label', t('pptx.common.close'));
	closeButton.textContent = '×';
	closeButton.addEventListener('click', close);
	header.append(title, closeButton);

	const tabs = createEl(doc, 'nav', 'pptxv-props-tabs');
	tabs.setAttribute('aria-label', t('pptx.documentProperties.dialogTitle'));
	const body = createEl(doc, 'div', 'pptxv-props-body');
	let activeTab: DialogTab = 'summary';
	const save = createEl(doc, 'button', 'is-primary');
	const refreshSave = (): void => {
		if (save) {
			save.disabled = !options.editable || JSON.stringify({ core, app, custom }) === original;
		}
	};

	const input = (label: string, value: string, onInput: (value: string) => void) => {
		const wrapper = createEl(doc, 'label');
		const text = createEl(doc, 'span');
		text.textContent = label;
		const control = createEl(doc, 'input');
		control.value = value;
		control.disabled = !options.editable;
		control.addEventListener('input', () => {
			onInput(control.value);
			refreshSave();
		});
		wrapper.append(text, control);
		return wrapper;
	};

	const renderSummary = (): void => {
		const grid = createEl(doc, 'div', 'pptxv-props-grid');
		const fields: Array<[keyof PptxCoreProperties, string]> = [
			['title', 'pptx.documentProperties.summary.title'],
			['subject', 'pptx.documentProperties.summary.subject'],
			['creator', 'pptx.documentProperties.summary.author'],
			['keywords', 'pptx.documentProperties.summary.keywords'],
			['category', 'pptx.documentProperties.summary.category'],
			['description', 'pptx.documentProperties.summary.description'],
		];
		for (const [key, label] of fields) {
			grid.appendChild(input(t(label), core[key] ?? '', (value) => (core[key] = value)));
		}
		grid.append(
			input(t('pptx.documentProperties.summary.manager'), app.manager ?? '', (value) => {
				app.manager = value;
			}),
			input(t('pptx.documentProperties.summary.company'), app.company ?? '', (value) => {
				app.company = value;
			}),
		);
		body.replaceChildren(grid);
	};

	const renderStatistics = (): void => {
		const stats = computeDocumentStatistics(options.slides, options.core);
		const list = createEl(doc, 'dl', 'pptxv-props-stats');
		const rows: Array<[string, string | number]> = [
			['pptx.documentProperties.statistics.slides', stats.slideCount],
			['pptx.documentProperties.statistics.hiddenSlides', stats.hiddenSlideCount],
			['pptx.documentProperties.statistics.notes', stats.noteCount],
			['pptx.documentProperties.statistics.elements', stats.elementCount],
			['pptx.documentProperties.statistics.words', stats.wordCount],
			['pptx.documentProperties.statistics.paragraphs', stats.paragraphCount],
			['pptx.documentProperties.created', stats.created ?? '-'],
			['pptx.documentProperties.modified', stats.modified ?? '-'],
		];
		for (const [label, value] of rows) {
			const term = createEl(doc, 'dt');
			term.textContent = t(label);
			const detail = createEl(doc, 'dd');
			detail.textContent = String(value);
			list.append(term, detail);
		}
		body.replaceChildren(list);
	};

	const renderCustom = (): void => {
		const list = createEl(doc, 'div', 'pptxv-props-custom');
		custom.forEach((property, index) => {
			const row = createEl(doc, 'div', 'pptxv-props-custom-row');
			const name = createEl(doc, 'input');
			name.value = property.name;
			name.disabled = !options.editable;
			name.setAttribute('aria-label', t('pptx.documentProperties.custom.name'));
			name.addEventListener('input', () => {
				property.name = name.value;
				refreshSave();
			});
			const value = property.type === 'bool' ? createEl(doc, 'select') : createEl(doc, 'input');
			if (value instanceof HTMLInputElement) {
				value.type = property.type === 'i4' ? 'number' : 'text';
			}
			if (value instanceof HTMLSelectElement) {
				for (const [optionValue, label] of [
					['true', 'pptx.documentProperties.custom.yes'],
					['false', 'pptx.documentProperties.custom.no'],
				] as const) {
					const option = createEl(doc, 'option');
					option.value = optionValue;
					option.textContent = t(label);
					value.appendChild(option);
				}
			}
			value.value = property.value;
			value.disabled = !options.editable;
			value.setAttribute('aria-label', t('pptx.documentProperties.custom.value'));
			value.addEventListener('input', () => {
				property.value = value.value;
				refreshSave();
			});
			const type = createEl(doc, 'select');
			type.disabled = !options.editable;
			type.setAttribute('aria-label', t('pptx.documentProperties.custom.type'));
			for (const [optionValue, label] of [
				['lpwstr', 'pptx.documentProperties.custom.typeText'],
				['i4', 'pptx.documentProperties.custom.typeNumber'],
				['filetime', 'pptx.documentProperties.custom.typeDate'],
				['bool', 'pptx.documentProperties.custom.typeYesNo'],
			] as const) {
				const option = createEl(doc, 'option');
				option.value = optionValue;
				option.textContent = t(label);
				type.appendChild(option);
			}
			type.value = property.type;
			type.addEventListener('change', () => {
				property.type = type.value;
				if (property.type === 'bool' && !['true', 'false'].includes(property.value)) {
					property.value = 'true';
				}
				refreshSave();
				renderCustom();
			});
			const remove = createEl(doc, 'button');
			remove.type = 'button';
			remove.disabled = !options.editable;
			remove.textContent = '×';
			remove.setAttribute('aria-label', t('pptx.documentProperties.custom.deleteProperty'));
			remove.addEventListener('click', () => {
				custom = custom.filter((_item, itemIndex) => itemIndex !== index);
				refreshSave();
				renderCustom();
			});
			row.append(name, value, type, remove);
			list.appendChild(row);
		});
		const add = createEl(doc, 'button');
		add.type = 'button';
		add.disabled = !options.editable;
		add.textContent = t('pptx.documentProperties.custom.addProperty');
		add.addEventListener('click', () => {
			custom = [...custom, { name: '', value: '', type: 'lpwstr' }];
			refreshSave();
			renderCustom();
		});
		list.appendChild(add);
		body.replaceChildren(list);
	};

	const render = (): void => {
		if (activeTab === 'summary') {
			renderSummary();
		} else if (activeTab === 'statistics') {
			renderStatistics();
		} else {
			renderCustom();
		}
	};
	const appendTab = ([id, label]: [DialogTab, string]): void => {
		const button = createEl(doc, 'button');
		button.type = 'button';
		button.textContent = t(label);
		button.addEventListener('click', () => {
			activeTab = id;
			for (const tab of tabs.querySelectorAll('button')) {
				tab.classList.toggle('is-active', tab === button);
			}
			render();
		});
		button.classList.toggle('is-active', id === activeTab);
		tabs.appendChild(button);
	};
	const tabDefinitions: Array<[DialogTab, string]> = [
		['summary', 'pptx.documentProperties.tabs.general'],
		['statistics', 'pptx.documentProperties.tabs.statistics'],
		['custom', 'pptx.documentProperties.tabs.custom'],
	];
	tabDefinitions.forEach(appendTab);

	const footer = createEl(doc, 'footer');
	const cancel = createEl(doc, 'button');
	cancel.type = 'button';
	cancel.textContent = t('pptx.common.cancel');
	cancel.addEventListener('click', close);
	save.type = 'button';
	save.textContent = t('pptx.common.save');
	refreshSave();
	save.addEventListener('click', () => {
		options.onSave(core, app, custom);
		close();
	});
	footer.append(cancel, save);
	dialog.append(header, tabs, body, footer);
	overlay.append(scrim, dialog);
	render();
	doc.body.appendChild(overlay);
	return overlay;
}
