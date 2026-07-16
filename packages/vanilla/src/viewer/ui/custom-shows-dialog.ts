import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendDialogButton, createParityDialogShell } from './parity-dialog-shell';

export function openCustomShowsDialog(
	doc: Document,
	t: Translator,
	shows: readonly PptxCustomShow[],
	slides: readonly PptxSlide[],
	onSave: (shows: PptxCustomShow[]) => void,
	onRun: (show: PptxCustomShow) => void,
): void {
	const shell = createParityDialogShell(doc, t, t('pptx.customShows.title'));
	let draft = structuredClone(shows) as PptxCustomShow[];
	const list = createEl(doc, 'div', 'pptxv-custom-shows');
	shell.body.appendChild(list);
	const render = (): void => {
		list.replaceChildren();
		draft.forEach((show) => {
			const row = createEl(doc, 'article');
			const name = createEl(doc, 'input');
			name.value = show.name;
			name.setAttribute('aria-label', t('pptx.customShows.editNameLabel'));
			name.addEventListener('change', () => {
				show.name = name.value.trim() || show.name;
			});
			const count = createEl(doc, 'span');
			count.textContent = `${show.slideRIds.length}/${slides.length}`;
			const run = createEl(doc, 'button');
			run.type = 'button';
			run.textContent = t('pptx.slideShow.fromBeginning');
			run.addEventListener('click', () => {
				onRun(show);
				shell.close();
			});
			const remove = createEl(doc, 'button');
			remove.type = 'button';
			remove.textContent = t('pptx.customShows.delete');
			remove.addEventListener('click', () => {
				draft = draft.filter(({ id }) => id !== show.id);
				render();
			});
			const slideList = createEl(doc, 'div');
			slides.forEach((slide) => {
				const label = createEl(doc, 'label', 'pptxv-parity-check');
				const check = doc.createElement('input');
				check.type = 'checkbox';
				check.checked = show.slideRIds.includes(slide.rId);
				check.addEventListener('change', () => {
					show.slideRIds = check.checked
						? [...show.slideRIds, slide.rId]
						: show.slideRIds.filter((id) => id !== slide.rId);
					count.textContent = `${show.slideRIds.length}/${slides.length}`;
				});
				label.append(check, doc.createTextNode(`${t('pptx.rehearse.slide')} ${slide.slideNumber}`));
				slideList.appendChild(label);
			});
			row.append(name, count, run, remove, slideList);
			list.appendChild(row);
		});
	};
	appendDialogButton(doc, shell.footer, t('pptx.customShows.createNew'), () => {
		draft.push({
			id: crypto.randomUUID(),
			name: t('pptx.customShows.createNew'),
			slideRIds: slides.map(({ rId }) => rId),
		});
		render();
	});
	appendDialogButton(doc, shell.footer, t('common.cancel'), shell.close);
	appendDialogButton(
		doc,
		shell.footer,
		t('common.ok'),
		() => {
			onSave(draft);
			shell.close();
		},
		true,
	);
	render();
}
