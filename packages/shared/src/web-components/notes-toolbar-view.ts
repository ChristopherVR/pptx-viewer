import type {
	NotesToolbarControlId,
	NotesToolbarIntent,
	NotesToolbarTranslate,
	NotesToolbarViewState,
} from '../render';
import { NOTES_TOOLBAR_ICON_PATHS } from './notes-toolbar-icons';
import type { NotesToolbarIcon } from './notes-toolbar-icons';
import { createLinkPopover } from './notes-toolbar-link';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface ButtonSpec {
	id: NotesToolbarControlId;
	icon: NotesToolbarIcon;
	labelKey: string;
	/** Draw a separator before this button. */
	sep?: boolean;
	intent?: NotesToolbarIntent;
}

const inline = (
	command: 'bold' | 'italic' | 'underline' | 'strikeThrough',
): NotesToolbarIntent => ({
	kind: 'inline',
	command,
});
const paragraph = (command: 'bullet' | 'numbered' | 'indent' | 'outdent'): NotesToolbarIntent => ({
	kind: 'paragraph',
	command,
});

/** Canonical order for every binding: character, list, indent, link, print. */
const SPECS: readonly ButtonSpec[] = [
	{ id: 'bold', icon: 'bold', labelKey: 'pptx.notes.bold', intent: inline('bold') },
	{ id: 'italic', icon: 'italic', labelKey: 'pptx.notes.italic', intent: inline('italic') },
	{
		id: 'underline',
		icon: 'underline',
		labelKey: 'pptx.notes.underline',
		intent: inline('underline'),
	},
	{
		id: 'strike',
		icon: 'strike',
		labelKey: 'pptx.notes.strikethrough',
		intent: inline('strikeThrough'),
	},
	{
		id: 'bullet',
		icon: 'bullet',
		labelKey: 'pptx.notes.bulletList',
		sep: true,
		intent: paragraph('bullet'),
	},
	{
		id: 'numbered',
		icon: 'numbered',
		labelKey: 'pptx.notes.numberedList',
		intent: paragraph('numbered'),
	},
	{
		id: 'indent',
		icon: 'indent',
		labelKey: 'pptx.notes.indent',
		sep: true,
		intent: paragraph('indent'),
	},
	{ id: 'outdent', icon: 'outdent', labelKey: 'pptx.notes.outdent', intent: paragraph('outdent') },
	{ id: 'link', icon: 'link', labelKey: 'pptx.notes.insertLink', sep: true },
	{ id: 'print', icon: 'print', labelKey: 'pptx.notes.printNotes', intent: { kind: 'print' } },
];

const identity: NotesToolbarTranslate = (key) => key;
const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

export interface NotesToolbarView {
	bar: HTMLElement;
	popover: HTMLElement;
	render(state: NotesToolbarViewState): void;
	dispose(): void;
}

/** Build the toolbar DOM once; `render` only patches labels, state and visibility. */
export function createNotesToolbarView(
	doc: Document,
	emit: (intent: NotesToolbarIntent) => void,
): NotesToolbarView {
	const bar = doc.createElement('div');
	bar.className = 'bar';
	bar.setAttribute('role', 'toolbar');
	bar.setAttribute('aria-orientation', 'horizontal');
	bar.setAttribute('part', 'bar');
	const group = doc.createElement('div');
	group.className = 'group';
	const buttons = {} as Record<NotesToolbarControlId, HTMLButtonElement>;
	let current: HTMLButtonElement | undefined;

	const popover = createLinkPopover(
		doc,
		(url, text) => emit({ kind: 'link', url, text }),
		(restoreFocus) => {
			if (restoreFocus) {
				buttons.link.focus();
			}
		},
	);
	const make = (id: NotesToolbarControlId, className = ''): HTMLButtonElement => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = className;
		button.dataset.notesControl = id;
		// Keep the editor's selection and focus while the pointer activates a button.
		button.addEventListener('mousedown', (event) => event.preventDefault());
		buttons[id] = button;
		return button;
	};
	for (const spec of SPECS) {
		if (spec.sep) {
			const sep = doc.createElement('i');
			sep.className = 'sep';
			sep.setAttribute('aria-hidden', 'true');
			group.append(sep);
		}
		const button = make(spec.id);
		const svg = doc.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const path = doc.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', NOTES_TOOLBAR_ICON_PATHS[spec.icon]);
		svg.append(path);
		button.append(svg);
		button.addEventListener('click', () => {
			if (spec.id === 'link') {
				if (popover.isOpen) {
					popover.close(false);
				} else {
					popover.open(button);
				}
			} else if (spec.intent) {
				emit(spec.intent);
			}
		});
		group.append(button);
	}
	const mode = make('toggleRich', 'mode');
	mode.addEventListener('click', () => emit({ kind: 'toggle-rich' }));
	bar.append(group, mode);

	const all = Object.values(buttons);
	const enabled = () => all.filter((b) => !b.hidden && !b.disabled);
	/** Roving tabindex: exactly one enabled button is a tab stop. */
	const syncTabStops = () => {
		const list = enabled();
		if (!current || !list.includes(current)) {
			current = list[0];
		}
		for (const button of all) {
			button.tabIndex = button === current ? 0 : -1;
		}
	};
	bar.addEventListener('focusin', (event) => {
		const target = event.composedPath()[0];
		if (target instanceof HTMLButtonElement && all.includes(target)) {
			current = target;
			syncTabStops();
		}
	});
	bar.addEventListener('keydown', (event) => {
		// Activation and arrow keys must not reach the viewer's slide shortcuts.
		if (event.key === ' ' || event.key === 'Enter') {
			if (!event.ctrlKey && !event.metaKey && !event.altKey) {
				event.stopPropagation();
			}
			return;
		}
		if (!NAV_KEYS.has(event.key)) {
			return;
		}
		const list = enabled();
		const at = current ? list.indexOf(current) : -1;
		if (at < 0) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? list.length - 1
					: (at + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
		current = list[next];
		syncTabStops();
		current.focus();
	});

	return {
		bar,
		popover: popover.el,
		render(state) {
			const t = state.translate ?? identity;
			const off = state.disabled === true;
			bar.setAttribute('aria-label', t('pptx.notesToolbar.ariaLabel'));
			for (const spec of SPECS) {
				const button = buttons[spec.id];
				const text = t(spec.labelKey);
				button.title = text;
				button.setAttribute('aria-label', text);
				button.disabled = off || (spec.id !== 'print' && !state.canFormat);
			}
			buttons.print.hidden = !state.showPrint;
			mode.disabled = off;
			mode.textContent = t(state.rich ? 'pptx.notes.plainEditor' : 'pptx.notes.richEditor');
			mode.title = t(
				state.rich ? 'pptx.notes.switchToPlainEditor' : 'pptx.notes.switchToRichEditor',
			);
			popover.setLabels(t);
			if (popover.isOpen && (off || !state.canFormat)) {
				popover.close(false);
			}
			syncTabStops();
		},
		dispose: () => popover.close(false),
	};
}
