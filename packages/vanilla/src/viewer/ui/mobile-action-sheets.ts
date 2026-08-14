import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
import type { MobileSheetKey, ToolbarActionId } from 'pptx-viewer-shared';
import {
	buildBarActions,
	createSheetDismissGesture,
	isActionHidden,
	slideTitle,
	toggleSheet,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';
import type { RibbonHandlers } from './ribbon/ribbon-types';

/** Paint one slide at `scale`, the same callback the desktop rail is given. */
export type MobileThumbnailRenderer = (slide: PptxSlide, scale: number) => HTMLElement;

export interface MobileActionSheets {
	el: HTMLElement;
	update(current: number, slides: readonly PptxSlide[], comments: readonly PptxComment[]): void;
	/**
	 * Hand the Slides sheet the deck renderer, so it can show the slides
	 * themselves rather than a list of their titles (which is all it had, and
	 * nothing like React's thumbnail list).
	 */
	setThumbnailRenderer(
		render: MobileThumbnailRenderer | null,
		canvasWidth: number,
		canvasHeight: number,
	): void;
	toggle(key: Exclude<MobileSheetKey, null>): void;
	close(): void;
	setEditable(editable: boolean): void;
	setNotesExpanded(expanded: boolean): void;
}

/** Thumbnail width in the sheet; the rail uses 128px in a narrower column. */
const MOBILE_THUMB_WIDTH = 148;

export function createMobileActionSheets(
	doc: Document,
	t: Translator,
	handlers: RibbonHandlers,
	onSelectSlide: (index: number) => void,
	inspector: HTMLElement | null,
	hiddenActions?: readonly ToolbarActionId[],
): MobileActionSheets {
	const el = createEl(doc, 'div', 'pptxv-mobile-actions');
	const sheetHost = createEl(doc, 'div', 'pptxv-mobile-sheet-host');
	sheetHost.setAttribute('role', 'dialog');
	sheetHost.setAttribute('aria-modal', 'true');
	const backdrop = doc.createElement('button');
	backdrop.type = 'button';
	backdrop.className = 'pptxv-mobile-sheet-backdrop';
	backdrop.setAttribute('aria-label', t('pptx.settings.close'));
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
	let editable = true;
	let notesExpanded = false;
	let renderThumbnail: MobileThumbnailRenderer | null = null;
	let canvasWidth = 960;
	let canvasHeight = 540;
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
			const scale = MOBILE_THUMB_WIDTH / Math.max(canvasWidth, 1);
			for (let index = 0; index < slides.length; index += 1) {
				const button = doc.createElement('button');
				button.type = 'button';
				const label = slideTitle(slides[index], index);
				button.setAttribute('aria-label', label);
				button.classList.toggle('is-active', index === current);
				if (index === current) {
					button.setAttribute('aria-current', 'true');
				}
				const number = createEl(doc, 'span', 'pptxv-mobile-slide-num');
				number.textContent = String(index + 1);
				button.appendChild(number);
				if (renderThumbnail) {
					const frame = createEl(doc, 'span', 'pptxv-mobile-slide-frame', {
						width: `${MOBILE_THUMB_WIDTH}px`,
						height: `${Math.round(canvasHeight * scale)}px`,
					});
					frame.appendChild(renderThumbnail(slides[index], scale));
					button.appendChild(frame);
				} else {
					// No renderer wired up (a host that never rendered a deck): the
					// title still names the slide.
					const caption = createEl(doc, 'span', 'pptxv-mobile-slide-title');
					caption.textContent = label;
					button.appendChild(caption);
				}
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
			draft.setAttribute('aria-label', t('pptx.comments.addPlaceholder'));
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
			const buttons: readonly [string, () => void, ToolbarActionId | null][] = [
				[t('pptx.ribbon.insert'), () => handlers.insert.insert('text'), null],
				[t('pptx.presenter.previousSlide'), handlers.nav.prev, 'navigation'],
				[t('pptx.presenter.nextSlide'), handlers.nav.next, 'navigation'],
				[t('pptx.statusBar.zoomOut'), handlers.nav.zoomOut, 'zoom'],
				[t('pptx.statusBar.zoomIn'), handlers.nav.zoomIn, 'zoom'],
				[t('pptx.notes.title'), handlers.nav.toggleNotes, 'notes'],
				[t('pptx.statusBar.slideShow'), handlers.nav.togglePresentation, 'fullscreen'],
			];
			for (const [label, run, actionId] of buttons) {
				if (actionId && isActionHidden(actionId, hiddenActions)) {
					continue;
				}
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
	const openSheet = (key: Exclude<MobileSheetKey, null>): void => {
		active = toggleSheet(active, key);
		if (!active) {
			close();
			return;
		}
		render(active);
		sheetHost.hidden = false;
		for (const item of bar.querySelectorAll<HTMLButtonElement>('button')) {
			item.setAttribute('aria-pressed', String(item.dataset.mobileAction === active));
		}
	};
	/** The same five lucide glyphs React's `MobileBottomBar` draws. */
	const actionIcons = {
		slides: 'layers',
		insert: 'plus',
		inspector: 'sliders',
		comments: 'comment',
		notes: 'sticky-note',
	} as const;
	for (const descriptor of buildBarActions({ slideCount: 0 })) {
		const key = descriptor.key as 'slides' | 'insert' | 'inspector' | 'comments' | 'notes';
		if (key === 'notes' && isActionHidden('notes', hiddenActions)) {
			continue;
		}
		const button = doc.createElement('button');
		button.type = 'button';
		button.dataset.mobileAction = key;
		if (key === 'notes') {
			button.setAttribute('aria-label', t('pptx.statusBar.toggleNotes'));
		}
		button.appendChild(createIcon(doc, actionIcons[key]));
		const label = createEl(doc, 'span');
		label.textContent =
			key === 'inspector'
				? t('pptx.field.format')
				: t(
						`pptx.${key === 'slides' ? 'sections.slides' : key === 'comments' ? 'toolbar.comments' : key === 'insert' ? 'mobileBar.insert' : 'notes.title'}`,
					);
		button.appendChild(label);
		button.addEventListener('click', () => {
			if (key === 'notes') {
				handlers.nav.toggleNotes();
				return;
			}
			if (key === 'insert') {
				handlers.insert.insert('text');
				return;
			}
			openSheet(key);
		});
		bar.appendChild(button);
	}
	el.appendChild(bar);
	const syncBar = (): void => {
		const actions = buildBarActions({ slideCount: slides.length });
		for (const action of actions) {
			const button = bar.querySelector<HTMLButtonElement>(
				`button[data-mobile-action='${action.key}']`,
			);
			if (!button) {
				continue;
			}
			const editOnly =
				action.key === 'insert' || action.key === 'inspector' || action.key === 'comments';
			button.disabled =
				action.disabled || (editOnly && !editable) || (action.key === 'inspector' && !inspector);
			button.setAttribute(
				'aria-pressed',
				String(action.key === 'notes' ? notesExpanded : action.key === active),
			);
		}
	};
	return {
		el,
		update(nextCurrent, nextSlides, nextComments) {
			current = nextCurrent;
			slides = nextSlides;
			comments = nextComments;
			if (active) {
				render(active);
			}
			syncBar();
		},
		setThumbnailRenderer(renderer, width, height) {
			renderThumbnail = renderer;
			canvasWidth = width;
			canvasHeight = height;
			if (active === 'slides') {
				render(active);
			}
		},
		toggle: openSheet,
		close,
		setEditable(nextEditable) {
			editable = nextEditable;
			if (!editable && active && ['insert', 'inspector', 'comments'].includes(active)) {
				close();
			}
			syncBar();
		},
		setNotesExpanded(expanded) {
			notesExpanded = expanded;
			syncBar();
		},
	};
}
