import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';

/**
 * The title bar's centred "Tell me what you want to do" command search box.
 *
 * The shared `filterCommands` catalogue (see `pptx-viewer-shared`
 * render/command-search) maps to command ids the React binding dispatches;
 * the vanilla binding wires a small local command list to its own chrome
 * callbacks instead, filtered with the same case-insensitive
 * label-substring match. Enter or click executes the first/clicked match
 * and closes the dropdown.
 */
export interface CommandSearchCommand {
	/** Existing `pptx.*` translation key for the visible label. */
	labelKey: string;
	run(): void;
}

export interface CommandSearch {
	el: HTMLElement;
}

/** Case-insensitive label-substring filter over the local command list. */
export function filterSearchCommands(
	query: string,
	commands: readonly CommandSearchCommand[],
	t: Translator,
): CommandSearchCommand[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) {
		return [];
	}
	return commands.filter((command) => t(command.labelKey).toLowerCase().includes(trimmed));
}

export function createCommandSearch(
	doc: Document,
	t: Translator,
	commands: readonly CommandSearchCommand[],
): CommandSearch {
	const el = createEl(doc, 'div', 'pptxv-cmdsearch');

	const box = createEl(doc, 'div', 'pptxv-cmdsearch-box');
	box.appendChild(createIcon(doc, 'search'));
	const input = doc.createElement('input');
	input.type = 'text';
	input.className = 'pptxv-cmdsearch-input';
	input.placeholder = t('pptx.titleBar.searchPlaceholder');
	input.setAttribute('aria-label', t('pptx.titleBar.search'));
	box.appendChild(input);
	el.appendChild(box);

	const menu = createEl(doc, 'div', 'pptxv-cmdsearch-menu');
	menu.hidden = true;
	el.appendChild(menu);

	const close = (): void => {
		menu.hidden = true;
		menu.replaceChildren();
	};

	const execute = (command: CommandSearchCommand): void => {
		input.value = '';
		close();
		command.run();
	};

	let matches: CommandSearchCommand[] = [];
	const render = (): void => {
		matches = filterSearchCommands(input.value, commands, t);
		if (input.value.trim().length === 0) {
			close();
			return;
		}
		menu.replaceChildren();
		if (matches.length === 0) {
			const emptyItem = createEl(doc, 'div', 'pptxv-cmdsearch-empty');
			emptyItem.textContent = t('pptx.titleBar.searchNoResults');
			menu.appendChild(emptyItem);
		}
		for (const command of matches) {
			const item = createEl(doc, 'button', 'pptxv-cmdsearch-item');
			item.type = 'button';
			item.textContent = t(command.labelKey);
			// mousedown (not click) so the action runs before the input blurs.
			item.addEventListener('mousedown', (event) => {
				event.preventDefault();
				execute(command);
			});
			menu.appendChild(item);
		}
		menu.hidden = false;
	};

	input.addEventListener('input', render);
	input.addEventListener('focus', render);
	input.addEventListener('blur', close);
	input.addEventListener('keydown', (event) => {
		event.stopPropagation();
		if (event.key === 'Enter' && matches.length > 0) {
			execute(matches[0]);
		} else if (event.key === 'Escape') {
			input.value = '';
			close();
		}
	});

	return { el };
}
