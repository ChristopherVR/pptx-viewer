import type { MobileSheetKey } from 'pptx-viewer-shared';
import { createSheetDismissGesture, toggleSheet } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { RibbonHandlers } from './ribbon/ribbon-types';

export interface MobileActionSheets {
	el: HTMLElement;
	update(current: number, total: number, comments: readonly { text: string }[]): void;
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
	let total = 0;
	let comments: readonly { text: string }[] = [];
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
		if (key === 'slides') {
			const list = createEl(doc, 'div', 'pptxv-mobile-slide-list');
			for (let index = 0; index < total; index += 1) {
				const button = doc.createElement('button');
				button.type = 'button';
				button.textContent = `${index + 1}`;
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
				const p = doc.createElement('p');
				p.textContent = comment.text;
				body.appendChild(p);
			}
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
	el.appendChild(bar);
	return {
		el,
		update(nextCurrent, nextTotal, nextComments) {
			current = nextCurrent;
			total = nextTotal;
			comments = nextComments;
			if (active) {
				render(active);
			}
		},
	};
}
