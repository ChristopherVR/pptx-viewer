import { NOTES_TOOLBAR_DEFAULT_STATE } from '../render';
import type { NotesToolbarIntent, NotesToolbarViewState } from '../render';
import { attachControlStyles } from './control-styles';
import { NOTES_TOOLBAR_STYLES } from './notes-toolbar-styles';
import { createNotesToolbarView } from './notes-toolbar-view';

export type NotesToolbarRequestEvent = CustomEvent<NotesToolbarIntent>;
export interface PptxUiNotesToolbarElement extends HTMLElement {
	state: NotesToolbarViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-notes-toolbar': PptxUiNotesToolbarElement;
	}
}

/**
 * Controlled speaker-notes formatting toolbar. Hosts supply state and own every
 * effect (the contenteditable editor, selection edits, printing, history);
 * user activation emits one bubbling, composed `notes-request` event. The link
 * popover lives inside the element and emits a single `link` intent on submit.
 */
export function definePptxNotesToolbar(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-notes-toolbar')) {
		return;
	}
	class NotesToolbar extends HTMLElement implements PptxUiNotesToolbarElement {
		private model: NotesToolbarViewState = NOTES_TOOLBAR_DEFAULT_STATE;
		private readonly view = createNotesToolbarView(this.ownerDocument, (intent) => {
			this.dispatchEvent(
				new CustomEvent('notes-request', { detail: intent, bubbles: true, composed: true }),
			);
		});
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, NOTES_TOOLBAR_STYLES);
			root.append(this.view.bar, this.view.popover);
			this.view.render(this.model);
		}
		get state() {
			return this.model;
		}
		set state(value: NotesToolbarViewState) {
			this.model = value;
			this.view.render(value);
		}
		connectedCallback(): void {
			this.view.render(this.model);
		}
		disconnectedCallback(): void {
			this.view.dispose();
		}
	}
	registry.define('pptx-ui-notes-toolbar', NotesToolbar);
}
