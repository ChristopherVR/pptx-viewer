import { normalizeNotesLinkUrl } from '../render';
import type { NotesToolbarTranslate } from '../render';

export interface LinkPopover {
	el: HTMLElement;
	readonly isOpen: boolean;
	setLabels(t: NotesToolbarTranslate): void;
	/** Open next to `anchor`, remembering the editor selection that the popover's inputs would clear. */
	open(anchor: HTMLElement): void;
	close(restoreFocus: boolean): void;
	dispose(): void;
}

const EDITABLE = '[contenteditable]:not([contenteditable="false"])';

function savedEditorRange(doc: Document): { range: Range; text: string } | undefined {
	const selection = doc.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return undefined;
	}
	const range = selection.getRangeAt(0);
	const node = range.commonAncestorContainer;
	const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
	// Only a selection inside an editable surface is meaningful to restore.
	return element?.closest(EDITABLE)
		? { range: range.cloneRange(), text: selection.toString() }
		: undefined;
}

/** The in-toolbar hyperlink form shared by every binding (replaces `window.prompt`). */
export function createLinkPopover(
	doc: Document,
	submit: (url: string, text: string) => void,
	closed: (restoreFocus: boolean) => void,
): LinkPopover {
	const el = doc.createElement('div');
	el.className = 'popover';
	el.setAttribute('role', 'dialog');
	el.hidden = true;
	const form = doc.createElement('form');
	form.noValidate = true;
	const field = (name: string) => {
		const label = doc.createElement('label');
		const caption = doc.createElement('span');
		const input = doc.createElement('input');
		input.type = 'text';
		input.name = name;
		input.autocomplete = 'off';
		label.append(caption, input);
		return { label, caption, input };
	};
	const url = field('url');
	url.input.placeholder = 'https://...';
	url.input.inputMode = 'url';
	const text = field('text');
	const actions = doc.createElement('div');
	actions.className = 'actions';
	const cancel = doc.createElement('button');
	cancel.type = 'button';
	cancel.className = 'cancel';
	const insert = doc.createElement('button');
	insert.type = 'submit';
	insert.className = 'insert';
	actions.append(cancel, insert);
	form.append(url.label, text.label, actions);
	el.append(form);

	let saved: { range: Range; text: string } | undefined;
	let anchorEl: HTMLElement | undefined;
	let isOpen = false;

	const onOutside = (event: Event) => {
		const path = event.composedPath();
		if (!path.includes(el) && !(anchorEl && path.includes(anchorEl))) {
			popover.close(false);
		}
	};
	const place = () => {
		if (!anchorEl) {
			return;
		}
		const view = doc.defaultView;
		const box = anchorEl.getBoundingClientRect();
		const own = el.getBoundingClientRect();
		const width = view?.innerWidth ?? 1024;
		const height = view?.innerHeight ?? 768;
		const left = Math.max(8, Math.min(box.left, width - own.width - 8));
		const above = box.top - own.height - 4;
		el.style.left = `${left}px`;
		el.style.top = `${above >= 8 ? above : Math.min(box.bottom + 4, Math.max(8, height - own.height - 8))}px`;
	};

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		if (url.input.value.trim().length === 0) {
			url.input.setAttribute('aria-invalid', 'true');
			url.input.focus();
			return;
		}
		const href = normalizeNotesLinkUrl(url.input.value);
		const label = text.input.value.trim() || href;
		const range = saved?.range;
		const selection = doc.getSelection();
		popover.close(false);
		if (range?.startContainer.isConnected && selection) {
			selection.removeAllRanges();
			selection.addRange(range);
		}
		submit(href, label);
	});
	cancel.addEventListener('click', () => popover.close(true));
	el.addEventListener('keydown', (event) => {
		// Typing in the form must never reach the viewer's slide shortcuts.
		event.stopPropagation();
		if (event.key === 'Escape') {
			event.preventDefault();
			popover.close(true);
		}
	});
	url.input.addEventListener('input', () => url.input.removeAttribute('aria-invalid'));

	const popover: LinkPopover = {
		el,
		get isOpen() {
			return isOpen;
		},
		setLabels(t) {
			el.setAttribute('aria-label', t('pptx.notes.insertLink'));
			url.caption.textContent = t('pptx.notes.linkUrl');
			text.caption.textContent = t('pptx.notes.linkDisplayText');
			cancel.textContent = t('pptx.common.cancel');
			insert.textContent = t('pptx.notes.insertLink');
		},
		open(anchor) {
			saved = savedEditorRange(doc);
			anchorEl = anchor;
			url.input.value = '';
			url.input.removeAttribute('aria-invalid');
			text.input.value = saved?.text ?? '';
			el.hidden = false;
			isOpen = true;
			place();
			url.input.focus();
			doc.addEventListener('pointerdown', onOutside, true);
		},
		close(restoreFocus) {
			if (!isOpen) {
				return;
			}
			isOpen = false;
			el.hidden = true;
			doc.removeEventListener('pointerdown', onOutside, true);
			closed(restoreFocus);
		},
		dispose() {
			doc.removeEventListener('pointerdown', onOutside, true);
		},
	};
	return popover;
}
