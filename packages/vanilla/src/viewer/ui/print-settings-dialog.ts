import type { PrintOptions } from '../export/export-print';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendCheckRow, appendDialogButton, createParityDialogShell } from './parity-dialog-shell';

export function openPrintSettingsDialog(
	doc: Document,
	t: Translator,
	slideCount: number,
	onPrint: (options: PrintOptions) => void,
): void {
	const shell = createParityDialogShell(doc, t, t('pptx.print.title'));
	const selectRow = (
		label: string,
		entries: readonly (readonly [string, string])[],
	): HTMLSelectElement => {
		const row = createEl(doc, 'label', 'pptxv-parity-select');
		const caption = createEl(doc, 'span');
		caption.textContent = label;
		const select = doc.createElement('select');
		for (const [value, text] of entries) {
			const option = doc.createElement('option');
			option.value = value;
			option.textContent = text;
			select.appendChild(option);
		}
		row.append(caption, select);
		shell.body.appendChild(row);
		return select;
	};
	const range = selectRow(t('pptx.print.slideRange'), [
		['all', t('pptx.print.allSlides')],
		['current', t('pptx.print.currentSlide')],
		['custom', t('pptx.print.customRange')],
	]);
	const custom = createEl(doc, 'div', 'pptxv-parity-range');
	custom.hidden = true;
	const from = doc.createElement('input');
	from.type = 'number';
	from.min = '1';
	from.max = String(slideCount);
	from.value = '1';
	const to = doc.createElement('input');
	to.type = 'number';
	to.min = '1';
	to.max = String(slideCount);
	to.value = String(slideCount);
	custom.append(from, doc.createTextNode(t('pptx.slideShow.to')), to);
	shell.body.appendChild(custom);
	range.addEventListener('change', () => {
		custom.hidden = range.value !== 'custom';
	});
	const what = selectRow(t('pptx.print.printWhat'), [
		['slides', t('pptx.print.fullPageSlides')],
		['notes', t('pptx.print.notesPages')],
		['handouts', t('pptx.print.handouts')],
		['outline', t('pptx.print.outline')],
	]);
	const orientation = selectRow(t('pptx.print.orientation'), [
		['landscape', t('pptx.print.landscape')],
		['portrait', t('pptx.print.portrait')],
	]);
	const color = selectRow(t('pptx.print.colorMode'), [
		['color', t('pptx.print.color')],
		['grayscale', t('pptx.print.grayscale')],
		['pureBlackWhite', t('pptx.print.blackAndWhite')],
	]);
	const frame = appendCheckRow(doc, shell.body, t('pptx.print.frameSlides'), false);
	appendDialogButton(doc, shell.footer, t('common.cancel'), shell.close);
	appendDialogButton(
		doc,
		shell.footer,
		t('pptx.print.title'),
		() => {
			onPrint({
				slideRange: range.value as PrintOptions['slideRange'],
				customRangeFrom: Number(from.value),
				customRangeTo: Number(to.value),
				printWhat: what.value as PrintOptions['printWhat'],
				orientation: orientation.value as PrintOptions['orientation'],
				colorMode: color.value as PrintOptions['colorMode'],
				frameSlides: frame.checked,
			});
			shell.close();
		},
		true,
	);
}
