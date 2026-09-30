import { DESIGN_RIBBON_COMMANDS } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { createThemeEditorCard } from '../../inspector/theme-editor-card';
import type { ThemeEditorCard, ThemeEditorCardState } from '../../inspector/theme-editor-card';
import type { RibbonDesignHandlers } from '../ribbon-types';
import { createSharedRibbonCommand } from '../shared-command';

/** Design > Edit Theme opens on the right of the editor body, like React. */
export function createThemeEditorLauncher(
	doc: Document,
	t: Translator,
	handlers: Pick<RibbonDesignHandlers, 'applyThemeEdit'>,
) {
	const el = createEl(doc, 'div');
	const panel = createEl(doc, 'section');
	panel.dataset.deckThemeEditor = '';
	panel.setAttribute('aria-label', t('pptx.themeEditor.title'));
	panel.hidden = true;
	let editor: ThemeEditorCard | null = null;
	let state: ThemeEditorCardState = {
		editable: false,
		colorScheme: undefined,
		fontScheme: undefined,
		themeName: undefined,
	};
	const close = (): void => {
		const wasOpen = !panel.hidden;
		panel.hidden = true;
		editor?.el.remove();
		editor = null;
		button.setExpanded(false);
		if (wasOpen) {
			button.btn.focus();
		}
	};
	const command = DESIGN_RIBBON_COMMANDS.find((item) => item.id === 'design.themes.editTheme')!;
	const button = createSharedRibbonCommand(doc, {
		id: command.id,
		label: t(command.labelKey),
		title: t(command.titleKey),
		icon: command.icon,
		onCommand: () => {
			if (!panel.hidden) {
				close();
				return;
			}
			if (!editor) {
				editor = createThemeEditorCard(
					doc,
					t,
					{
						applyThemeEdit: async (payload) => {
							await handlers.applyThemeEdit(payload);
							close();
						},
					},
					{ inline: false, onClose: close },
				);
				panel.appendChild(editor.el);
			}
			editor.update(state);
			const body = el
				.closest('[data-pptx-editor-chrome]')
				?.querySelector('[data-pptx-chrome="body"]');
			(body ?? el).appendChild(panel);
			panel.hidden = false;
			button.setExpanded(true);
		},
	});
	button.setExpanded(false);
	panel.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			close();
		}
	});
	el.append(button.el, panel);
	return {
		el,
		button,
		panel,
		close,
		update(next: ThemeEditorCardState) {
			state = next;
			editor?.update(state);
		},
	};
}
