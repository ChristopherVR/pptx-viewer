/**
 * Classify the element a key press came from, for {@link ./editor-keymap}.
 *
 * Split out of `editor-keymap.ts` (file-size limit) and kept together because
 * both predicates answer the same question for every binding: "is this key
 * press aimed at the editor, or at some other control that owns it?"
 *
 * @module render/editor-key-target
 */

const FORM_FIELD_TAGS = /^(?:INPUT|TEXTAREA|SELECT)$/u;

/** Minimal element shape the predicates read; `unknown` targets are narrowed to it. */
interface KeyTargetElement {
	tagName?: string;
	isContentEditable?: boolean;
	closest?: (selector: string) => unknown;
}

function asElement(target: unknown): (KeyTargetElement & { tagName: string }) | null {
	const element = target as KeyTargetElement | null;
	if (!element || typeof element.tagName !== 'string') {
		return null;
	}
	return element as KeyTargetElement & { tagName: string };
}

/**
 * True when a key press is the user typing into a field rather than driving the
 * editor. Kept here so every binding classifies the same targets: a binding that
 * forgot `<select>` would swallow the arrow keys of its own dropdowns.
 */
export function isEditorTextInputTarget(target: unknown): boolean {
	const element = asElement(target);
	if (!element) {
		return false;
	}
	return FORM_FIELD_TAGS.test(element.tagName) || element.isContentEditable === true;
}

/** The slide canvas: Tab there cycles the selection, PowerPoint-style. */
const CANVAS_SELECTOR = '[data-pptx-viewport]';

/**
 * Keyboard-navigable chrome: native controls, ARIA widgets and the containers
 * that own their own Tab order (dialogs, menus, toolbars, tab lists).
 */
const CONTROL_SELECTOR = [
	'button',
	'a[href]',
	'summary',
	'[aria-modal="true"]',
	...[
		'button',
		'checkbox',
		'combobox',
		'dialog',
		'alertdialog',
		'grid',
		'gridcell',
		'link',
		'listbox',
		'menu',
		'menubar',
		'menuitem',
		'menuitemcheckbox',
		'menuitemradio',
		'option',
		'radio',
		'slider',
		'spinbutton',
		'switch',
		'tab',
		'tablist',
		'toolbar',
		'tree',
		'treeitem',
	].map((role) => `[role="${role}"]`),
].join(',');

/**
 * True when a key press came from a focusable chrome control (a ribbon button,
 * a File-backstage row, a dialog field, a web-component control) rather than
 * from the slide canvas or the page itself.
 *
 * Tab on such a target is the browser's focus navigation and must not be
 * claimed: when the keymap mapped a bare Tab to selection cycling for every
 * non-text target, it `preventDefault()`ed Tab on every button in every
 * binding, so keyboard users could no longer move through the ribbon, the
 * File backstage or any dialog.
 */
export function isEditorControlTarget(target: unknown): boolean {
	const element = asElement(target);
	if (!element) {
		return false;
	}
	const tag = element.tagName.toUpperCase();
	if (tag === 'BODY' || tag === 'HTML') {
		return false;
	}
	if (typeof element.closest !== 'function') {
		return false;
	}
	if (element.closest(CANVAS_SELECTOR)) {
		return false;
	}
	// A custom element (`pptx-ui-select`, `pptx-ui-search`, ...) hides its real
	// control in a shadow root, so the event is retargeted to the host.
	if (tag.includes('-')) {
		return true;
	}
	return Boolean(element.closest(CONTROL_SELECTOR));
}
