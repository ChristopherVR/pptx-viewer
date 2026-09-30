import type { PptxTheme } from 'pptx-viewer-core';

import { createThemeEditorEdit } from '../render';
import type { ThemeEditorEdit, ThemeEditorLabels } from '../render';
import { attachControlStyles } from './control-styles';
import { attachThemeEditorDock } from './theme-editor-dock';
import { THEME_EDITOR_STYLES } from './theme-editor-styles';
import { createThemeEditorView } from './theme-editor-view';

export interface PptxUiThemeEditorElement extends HTMLElement {
	theme: PptxTheme | undefined;
	labels: ThemeEditorLabels;
	disabled: boolean;
}
export type ThemeEditorApplyEvent = CustomEvent<ThemeEditorEdit>;
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-theme-editor': PptxUiThemeEditorElement;
	}
}

/** Shared draft and view; document mutation/history/persistence belong to the host. */
export function definePptxThemeEditor(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-theme-editor')) {
		return;
	}
	class ThemeEditorElement extends HTMLElement implements PptxUiThemeEditorElement {
		private current: PptxTheme | undefined;
		private draft = createThemeEditorEdit();
		private text: ThemeEditorLabels = {};
		private locked = false;
		private dirty = false;
		private opener: HTMLElement | undefined;
		private undock?: () => void;
		private readonly view;
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, THEME_EDITOR_STYLES);
			this.view = createThemeEditorView(root, {
				edit: (update) => {
					if (!this.locked) {
						this.draft = update(this.draft);
						this.dirty = true;
						this.paint();
					}
				},
				apply: () => {
					if (!this.locked) {
						this.dispatchEvent(
							new CustomEvent('theme-editor-apply', {
								detail: structuredClone(this.draft),
								bubbles: true,
								composed: true,
							}),
						);
					}
				},
				reset: () => {
					if (!this.locked) {
						this.draft = createThemeEditorEdit(this.current);
						this.dirty = false;
						this.paint();
					}
				},
				close: () => this.close(),
			});
			root.addEventListener('keydown', (event) => {
				const key = event as KeyboardEvent;
				key.stopPropagation();
				if (key.key === 'Escape' && !key.defaultPrevented) {
					key.preventDefault();
					this.close();
				}
			});
		}
		get theme(): PptxTheme | undefined {
			return this.current;
		}
		set theme(value: PptxTheme | undefined) {
			this.current = value;
			if (!this.dirty) {
				this.draft = createThemeEditorEdit(value);
			}
			this.paint();
		}
		get labels(): ThemeEditorLabels {
			return this.text;
		}
		set labels(value: ThemeEditorLabels) {
			this.text = { ...value };
			this.paint();
		}
		get disabled(): boolean {
			return this.locked;
		}
		set disabled(value: boolean) {
			this.locked = value;
			this.paint();
		}
		connectedCallback(): void {
			let active = document.activeElement;
			while (active?.shadowRoot?.activeElement) {
				active = active.shadowRoot.activeElement;
			}
			this.opener = active instanceof HTMLElement ? active : undefined;
			this.undock = attachThemeEditorDock(this);
			this.paint();
			if (!this.hasAttribute('inline')) {
				queueMicrotask(() => {
					if (this.isConnected) {
						this.view.focus();
					}
				});
			}
		}
		disconnectedCallback(): void {
			this.undock?.();
			if (document.activeElement === this) {
				this.opener?.focus();
			}
		}
		private close(): void {
			this.opener?.focus();
			this.dispatchEvent(new CustomEvent('theme-editor-close', { bubbles: true, composed: true }));
		}
		private paint(): void {
			this.view.paint(this.draft, this.text, this.locked);
		}
	}
	registry.define('pptx-ui-theme-editor', ThemeEditorElement);
}
