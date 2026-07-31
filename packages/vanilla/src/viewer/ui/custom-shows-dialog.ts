import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendDialogButton, createParityDialogShell } from './parity-dialog-shell';

export interface CustomShowsDialogOptions {
	shows: readonly PptxCustomShow[];
	slides: readonly PptxSlide[];
	/** The show playback is currently restricted to, or null for the whole deck. */
	activeShowId: string | null;
	onSave(shows: PptxCustomShow[]): void;
	/** Restrict (or, with null, stop restricting) the slide show to one show. */
	onSetActive(id: string | null): void;
	/** Start the show, already restricted to `show`. */
	onRun(show: PptxCustomShow): void;
}

/**
 * The Custom Shows dialog: define named slide subsets, choose which one the
 * slide show is restricted to, and start it.
 *
 * The picker at the top is the piece that was missing. Shows were definable
 * here and PERSISTED correctly, but nothing in the binding held an active show,
 * so selecting one changed nothing about what presented: every show ran the
 * whole deck. It carries React's labels (`selectCustomShow` / `allSlides`)
 * because it is the same control, just hosted in this dialog rather than in the
 * ribbon's primary row.
 */
export function openCustomShowsDialog(
	doc: Document,
	t: Translator,
	options: CustomShowsDialogOptions,
): void {
	const { shows, slides, onSave, onSetActive, onRun } = options;
	const shell = createParityDialogShell(doc, t, t('pptx.customShows.title'));
	let draft = structuredClone(shows) as PptxCustomShow[];
	let activeShowId = options.activeShowId;

	// ── Active-show picker ──────────────────────────────────────────────────
	const picker = createEl(doc, 'label', 'pptxv-custom-shows-active');
	const pickerLabel = createEl(doc, 'span');
	pickerLabel.textContent = t('pptx.customShows.selectCustomShow');
	const select = doc.createElement('select');
	select.setAttribute('aria-label', t('pptx.customShows.selectCustomShow'));
	select.addEventListener('change', () => {
		activeShowId = select.value || null;
		onSetActive(activeShowId);
	});
	picker.append(pickerLabel, select);
	shell.body.appendChild(picker);

	const list = createEl(doc, 'div', 'pptxv-custom-shows');
	shell.body.appendChild(list);

	const renderPicker = (): void => {
		select.replaceChildren();
		const all = doc.createElement('option');
		all.value = '';
		all.textContent = t('pptx.customShows.allSlides');
		select.appendChild(all);
		for (const show of draft) {
			const option = doc.createElement('option');
			option.value = show.id;
			option.textContent = show.name;
			select.appendChild(option);
		}
		// A show can be renamed or deleted in this same dialog, so the selection
		// is re-derived rather than left pointing at a row that no longer exists.
		select.value = draft.some(({ id }) => id === activeShowId) ? (activeShowId ?? '') : '';
	};

	const render = (): void => {
		list.replaceChildren();
		draft.forEach((show) => {
			const row = createEl(doc, 'article');
			const name = createEl(doc, 'input');
			name.value = show.name;
			name.setAttribute('aria-label', t('pptx.customShows.editNameLabel'));
			name.addEventListener('change', () => {
				show.name = name.value.trim() || show.name;
				renderPicker();
			});
			const count = createEl(doc, 'span');
			count.textContent = `${show.slideRIds.length}/${slides.length}`;
			const run = createEl(doc, 'button');
			run.type = 'button';
			run.textContent = t('pptx.slideShow.fromBeginning');
			run.addEventListener('click', () => {
				// Running a show IS selecting it: the show that starts must be the
				// one whose membership the navigation rule then honours.
				activeShowId = show.id;
				onSetActive(show.id);
				onRun(show);
				shell.close();
			});
			const remove = createEl(doc, 'button');
			remove.type = 'button';
			remove.textContent = t('pptx.customShows.delete');
			remove.addEventListener('click', () => {
				draft = draft.filter(({ id }) => id !== show.id);
				if (activeShowId === show.id) {
					activeShowId = null;
					onSetActive(null);
				}
				render();
				renderPicker();
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
		renderPicker();
	});
	appendDialogButton(doc, shell.footer, t('pptx.common.cancel'), shell.close);
	appendDialogButton(
		doc,
		shell.footer,
		t('pptx.common.ok'),
		() => {
			onSave(draft);
			// A show deleted in this session must not leave the slide show pinned to
			// an id nothing resolves: that would silently present the whole deck.
			onSetActive(draft.some(({ id }) => id === activeShowId) ? activeShowId : null);
			shell.close();
		},
		true,
	);
	render();
	renderPicker();
}
