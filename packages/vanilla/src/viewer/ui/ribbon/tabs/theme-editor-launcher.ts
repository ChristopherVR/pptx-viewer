import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { createThemeEditorCard } from '../../inspector/theme-editor-card';
import type { ThemeEditorCard, ThemeEditorCardState } from '../../inspector/theme-editor-card';
import type { RibbonDesignHandlers } from '../ribbon-types';

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
		button.btn.setAttribute('aria-expanded', 'false');
		if (wasOpen) {
			button.btn.focus();
		}
	};
	const button = makeButton(doc, {
		label: t('pptx.ribbon.editTheme'),
		icon: 'wrench',
		textLabel: t('pptx.ribbon.editTheme'),
		onClick: () => {
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
			button.btn.setAttribute('aria-expanded', 'true');
		},
	});
	button.btn.title = t('pptx.ribbon.editThemeTitle');
	button.btn.setAttribute('aria-expanded', 'false');
	panel.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			close();
		}
	});
	el.append(button.btn, panel);
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
