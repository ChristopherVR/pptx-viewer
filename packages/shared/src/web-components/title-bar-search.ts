import { filterCommands } from '../render';
import type { CommandSearchEntry, TitleBarSearchDetail, TitleBarViewState } from '../render';
import { TITLE_BAR_ICON_PATHS } from './title-bar-icons';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The dropdown shows at most this many commands so it never outgrows its box. */
export const TITLE_BAR_SEARCH_LIMIT = 8;

export interface TitleBarSearchView {
	box: HTMLElement;
	render(state: TitleBarViewState): void;
	close(): void;
}

/**
 * The centred command search: a `pptx-ui-search` plus its result list. The query
 * is local to the view, so hosts never round-trip keystrokes; they receive one
 * `command-search` request per commit.
 */
export function createTitleBarSearch(
	doc: Document,
	request: (detail: TitleBarSearchDetail) => void,
): TitleBarSearchView {
	let model: TitleBarViewState | undefined;
	const box = doc.createElement('div');
	box.className = 'box';
	const input = doc.createElement('pptx-ui-search') as HTMLElement & { value: string };
	input.setAttribute('variant', 'titlebar');
	input.setAttribute('data-pptx-search-surface', '');
	input.setAttribute('data-pptx-search-input', '');
	const results = doc.createElement('div');
	results.className = 'results';
	results.id = 'title-bar-results';
	results.setAttribute('role', 'listbox');
	results.hidden = true;
	const live = doc.createElement('div');
	live.className = 'sr';
	live.setAttribute('role', 'status');
	box.append(input, results, live);

	let matches: CommandSearchEntry[] = [];
	let active = 0;
	const t = (key: string): string => (model?.translate ?? ((k: string) => k))(key);

	const close = (): void => {
		results.hidden = true;
		results.replaceChildren();
		live.textContent = '';
		matches = [];
	};
	const commit = (entry?: CommandSearchEntry): void => {
		const query = input.value;
		input.value = '';
		close();
		request(entry ? { query, command: entry.command } : { query });
	};
	const row = (className: string, text: string): HTMLElement => {
		const node = doc.createElement('div');
		node.className = className;
		node.textContent = text;
		return node;
	};
	const paint = (): void => {
		[...results.querySelectorAll('[role="option"]')].forEach((node, index) =>
			node.setAttribute('aria-selected', String(index === active)),
		);
	};
	const open = (): void => {
		const query = input.value;
		if (!model || !query.trim()) {
			close();
			return;
		}
		matches = filterCommands(query, t, model.commands).slice(0, TITLE_BAR_SEARCH_LIMIT);
		active = Math.min(active, Math.max(matches.length - 1, 0));
		results.replaceChildren();
		if (matches.length > 0) {
			results.append(row('heading', t('pptx.titleBar.searchCommands')));
			matches.forEach((entry, index) => {
				const button = doc.createElement('button');
				button.type = 'button';
				button.tabIndex = -1;
				button.setAttribute('role', 'option');
				const label = doc.createElement('span');
				label.textContent = t(entry.labelKey);
				const category = doc.createElement('span');
				category.className = 'cat';
				category.textContent = entry.category ?? '';
				button.append(label, category);
				// mousedown (not click) so the choice lands before the input blurs.
				button.addEventListener('mousedown', (event) => {
					event.preventDefault();
					commit(entry);
				});
				button.addEventListener('mouseenter', () => {
					active = index;
					paint();
				});
				results.append(button);
			});
		} else {
			results.append(row('empty', t('pptx.titleBar.searchNoResults')));
		}
		if (model.contentSearch !== false) {
			const content = doc.createElement('button');
			content.type = 'button';
			content.tabIndex = -1;
			content.className = 'content';
			const svg = doc.createElementNS(SVG_NS, 'svg');
			svg.setAttribute('viewBox', '0 0 16 16');
			svg.setAttribute('aria-hidden', 'true');
			const path = doc.createElementNS(SVG_NS, 'path');
			path.setAttribute('d', TITLE_BAR_ICON_PATHS.search ?? '');
			svg.append(path);
			const text = doc.createElement('span');
			text.textContent = `${t('pptx.titleBar.searchContent')} \u201c${query}\u201d`;
			content.append(svg, text);
			content.addEventListener('mousedown', (event) => {
				event.preventDefault();
				commit();
			});
			results.append(content);
		}
		results.hidden = false;
		live.textContent =
			matches.length > 0 ? t('pptx.titleBar.searchCommands') : t('pptx.titleBar.searchNoResults');
		paint();
	};

	input.addEventListener('input', () => {
		active = 0;
		open();
	});
	input.addEventListener('focusin', open);
	box.addEventListener('focusout', (event) => {
		const next = event.relatedTarget as Node | null;
		if (!next || !box.contains(next)) {
			close();
		}
	});
	input.addEventListener('keydown', (event) => {
		const key = (event as KeyboardEvent).key;
		const typing = !(event as KeyboardEvent).ctrlKey && !(event as KeyboardEvent).metaKey;
		if (key === 'Enter' && input.value.trim()) {
			commit(matches[active]);
		} else if (key === 'Escape' && input.value) {
			input.value = '';
			close();
		} else if ((key === 'ArrowDown' || key === 'ArrowUp') && matches.length > 0) {
			event.preventDefault();
			active = (active + (key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length;
			paint();
		}
		// Typing must not reach the viewer's slide shortcuts.
		if (typing) {
			event.stopPropagation();
		}
	});

	return {
		box,
		render(state) {
			model = state;
			input.setAttribute('placeholder', t('pptx.titleBar.searchPlaceholder'));
			input.setAttribute('aria-label', t('pptx.titleBar.search'));
			if (!results.hidden) {
				open();
			}
		},
		close,
	};
}
