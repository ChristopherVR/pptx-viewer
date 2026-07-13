import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
import type { MobileSheetKey } from 'pptx-viewer-shared';
import { createSheetDismissGesture, slideTitle, toggleSheet } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { RibbonHandlers } from './ribbon/ribbon-types';

export interface MobileActionSheets {
	el: HTMLElement;
	update(current: number, slides: readonly PptxSlide[], comments: readonly PptxComment[]): void;
}

export function createMobileActionSheets(
	doc: Document,
	t: Translator,
	handlers: RibbonHandlers,
	onSelectSlide: (index: number) => void,
	inspector: HTMLElement | null,
): MobileActionSheets {
	const el = createEl(doc, 'div', 'pptxv-mobile-actions');
	const sheetHost = createEl(doc, 'div', 'pptxv-mobile-sheet-host');
	sheetHost.setAttribute('role', 'dialog');
	sheetHost.setAttribute('aria-modal', 'true');
	const backdrop = doc.createElement('button');
	backdrop.type = 'button';
	backdrop.className = 'pptxv-mobile-sheet-backdrop';
	backdrop.setAttribute('aria-label', 'Close');
	const sheet = createEl(doc, 'section', 'pptxv-mobile-sheet');
	const header = createEl(doc, 'header', 'pptxv-mobile-sheet-header');
	const handle = createEl(doc, 'span', 'pptxv-mobile-sheet-handle');
	const title = doc.createElement('strong');
	header.append(handle, title);
	const body = createEl(doc, 'div', 'pptxv-mobile-sheet-body');
	sheet.append(header, body);
	sheetHost.append(backdrop, sheet);
	sheetHost.hidden = true;
	el.appendChild(sheetHost);

	let active: MobileSheetKey = null;
	let current = 0;
	let slides: readonly PptxSlide[] = [];
	let comments: readonly PptxComment[] = [];
	const inspectorHome = inspector ? doc.createComment('inspector-home') : null;
	inspector?.parentNode?.insertBefore(inspectorHome!, inspector);

	const restoreInspector = () => {
		if (inspector && inspectorHome?.parentNode) {
			inspectorHome.parentNode.insertBefore(inspector, inspectorHome.nextSibling);
		}
	};
	const close = () => {
		active = null;
		sheetHost.hidden = true;
		sheet.style.transform = '';
		restoreInspector();
		for (const button of bar.querySelectorAll('button')) {
			button.setAttribute('aria-pressed', 'false');
		}
	};
	backdrop.addEventListener('click', close);
	const gesture = createSheetDismissGesture((offset, dragging) => {
		sheet.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
		sheet.style.transition = dragging ? 'none' : '';
	}, close);
	const pointer = (event: PointerEvent) => ({
		clientY: event.clientY,
		pointerId: event.pointerId,
		currentTarget: header,
	});
	header.addEventListener('pointerdown', (event) => gesture.pointerDown(pointer(event)));
	header.addEventListener('pointermove', (event) => gesture.pointerMove(pointer(event)));
	header.addEventListener('pointerup', (event) => gesture.pointerUp(pointer(event)));
	header.addEventListener('pointercancel', (event) => gesture.cancel(pointer(event)));

	const render = (key: Exclude<MobileSheetKey, null>) => {
		body.replaceChildren();
		title.textContent =
			key === 'inspector'
				? t('pptx.field.format')
				: t(
						`pptx.${key === 'slides' ? 'sections.slides' : key === 'comments' ? 'toolbar.comments' : key === 'insert' ? 'mobileBar.insert' : 'mobileToolbar.menu'}`,
					);
		sheetHost.setAttribute('aria-label', title.textContent);
		if (key === 'slides') {
			const list = createEl(doc, 'div', 'pptxv-mobile-slide-list');
			for (let index = 0; index < slides.length; index += 1) {
				const button = doc.createElement('button');
				button.type = 'button';
				button.textContent = slideTitle(slides[index], index);
				button.classList.toggle('is-active', index === current);
				button.addEventListener('click', () => {
					onSelectSlide(index);
					close();
				});
				list.appendChild(button);
			}
			body.appendChild(list);
		} else if (key === 'insert') {
			const buttons = [
				[t('pptx.insert.addTextBox'), () => handlers.insert.insert('text')],
				[t('pptx.ribbon.rectangle'), () => handlers.insert.insert('shape', 'rect')],
				[t('pptx.insert.insertTable'), () => handlers.insert.insert('table')],
			] as const;
			for (const [label, run] of buttons) {
				const button = doc.createElement('button');
				button.type = 'button';
				button.textContent = label;
				button.addEventListener('click', run);
				body.appendChild(button);
			}
		} else if (key === 'inspector' && inspector) {
			body.appendChild(inspector);
		} else if (key === 'comments') {
			if (comments.length === 0) {
				body.textContent = t('pptx.comments.noneOnSlide');
			}
			for (const comment of comments) {
				const row = createEl(doc, 'article', 'pptxv-mobile-comment');
				const input = doc.createElement('textarea');
				input.value = comment.text;
				input.setAttribute('aria-label', t('pptx.comments.edit'));
				const actions = createEl(doc, 'div', 'pptxv-mobile-comment-actions');
				const save = doc.createElement('button');
				save.type = 'button';
				save.textContent = t('pptx.comments.save');
				save.addEventListener('click', () =>
					handlers.edit.comments.editComment(comment.id, input.value),
				);
				const resolve = doc.createElement('button');
				resolve.type = 'button';
				resolve.textContent = comment.resolved
					? t('pptx.comments.unresolve')
					: t('pptx.comments.resolve');
				resolve.addEventListener('click', () =>
					handlers.edit.comments.toggleCommentResolved(comment.id),
				);
				const remove = doc.createElement('button');
				remove.type = 'button';
				remove.textContent = t('pptx.comments.delete');
				remove.addEventListener('click', () => handlers.edit.comments.deleteComment(comment.id));
				actions.append(save, resolve, remove);
				row.append(input, actions);
				body.appendChild(row);
			}
			const add = createEl(doc, 'div', 'pptxv-mobile-comment-add');
			const draft = doc.createElement('textarea');
			draft.placeholder = t('pptx.comments.addPlaceholder');
			const submit = doc.createElement('button');
			submit.type = 'button';
			submit.textContent = t('pptx.comments.addComment');
			submit.addEventListener('click', () => {
				if (handlers.edit.comments.addComment(draft.value)) {
					draft.value = '';
				}
			});
			add.append(draft, submit);
			body.appendChild(add);
		} else {
			const buttons = [
				[t('pptx.presenter.previousSlide'), handlers.nav.prev],
				[t('pptx.presenter.nextSlide'), handlers.nav.next],
				[t('pptx.statusBar.zoomOut'), handlers.nav.zoomOut],
				[t('pptx.statusBar.zoomIn'), handlers.nav.zoomIn],
				[t('pptx.notes.title'), handlers.nav.toggleNotes],
				[t('pptx.statusBar.slideShow'), handlers.nav.togglePresentation],
			] as const;
			for (const [label, run] of buttons) {
				const button = doc.createElement('button');
				button.type = 'button';
				button.textContent = label;
				button.addEventListener('click', run);
				body.appendChild(button);
			}
		}
	};

	const bar = doc.createElement('nav');
	bar.setAttribute('aria-label', t('pptx.mobileBar.ariaLabel'));
	const bindSheetButton = (button: HTMLButtonElement, key: Exclude<MobileSheetKey, null>): void => {
		button.addEventListener('click', () => {
			active = toggleSheet(active, key);
			if (!active) {
				close();
				return;
			}
			render(active);
			sheetHost.hidden = false;
			for (const item of bar.querySelectorAll('button')) {
				item.setAttribute('aria-pressed', String(item === button));
			}
		});
	};
	for (const key of ['slides', 'insert', 'inspector', 'comments', 'menu'] as const) {
		const button = doc.createElement('button');
		button.type = 'button';
		button.textContent =
			key === 'inspector'
				? t('pptx.field.format')
				: t(
						`pptx.${key === 'slides' ? 'sections.slides' : key === 'comments' ? 'toolbar.comments' : key === 'insert' ? 'mobileBar.insert' : 'mobileToolbar.menu'}`,
					);
		bindSheetButton(button, key);
		bar.appendChild(button);
	}
	const notesButton = doc.createElement('button');
	notesButton.type = 'button';
	notesButton.textContent = t('pptx.notes.title');
	notesButton.addEventListener('click', handlers.nav.toggleNotes);
	bar.appendChild(notesButton);
	el.appendChild(bar);
	return {
		el,
		update(nextCurrent, nextSlides, nextComments) {
			current = nextCurrent;
			slides = nextSlides;
			comments = nextComments;
			if (active) {
				render(active);
			}
		},
	};
}
