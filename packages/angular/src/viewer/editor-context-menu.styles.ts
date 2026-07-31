/**
 * editor-context-menu.styles.ts: CSS for the canvas right-click menu.
 *
 * Lifted out of the component so the component file stays a template plus its
 * wiring: the menu now renders from the shared command list, and keeping ~60
 * lines of unchanging CSS next to that made the interesting part hard to find.
 * The look is unchanged; every rule moved verbatim.
 *
 * @module angular-viewer/editor-context-menu.styles
 */

/** Styles for `pptx-editor-context-menu` (floating panel, items, dividers). */
export const EDITOR_CONTEXT_MENU_STYLES = `
	:host {
		position: fixed;
		left: var(--pptx-ctx-x, 0px);
		top: var(--pptx-ctx-y, 0px);
		z-index: 9000;
		display: block;
	}

	.pptx-ctx__menu {
		list-style: none;
		margin: 0;
		padding: 4px 0;
		min-width: 160px;
		background: var(--pptx-ctx-bg, #252526);
		color: var(--pptx-ctx-fg, #e0e0e0);
		border: 1px solid var(--pptx-ctx-border, #454545);
		border-radius: 4px;
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.4),
			0 1px 3px rgba(0, 0, 0, 0.3);
		font-size: 13px;
		user-select: none;
	}

	.pptx-ctx__item {
		display: block;
		width: 100%;
		padding: 5px 14px;
		background: transparent;
		border: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
		font-size: inherit;
		white-space: nowrap;
	}

	.pptx-ctx__item:hover:not(:disabled) {
		background: var(--pptx-ctx-hover, #094771);
		color: var(--pptx-ctx-hover-fg, #ffffff);
	}

	.pptx-ctx__item:disabled {
		opacity: 0.4;
		pointer-events: none;
		cursor: default;
	}

	.pptx-ctx__item--danger {
		color: var(--pptx-ctx-danger, #f47c7c);
	}

	.pptx-ctx__item--danger:hover:not(:disabled) {
		background: var(--pptx-ctx-danger-hover, #4a1a1a);
		color: var(--pptx-ctx-danger-fg, #ffaaaa);
	}

	.pptx-ctx__divider {
		height: 1px;
		background: var(--pptx-ctx-divider, #454545);
		margin: 3px 0;
	}
`;
