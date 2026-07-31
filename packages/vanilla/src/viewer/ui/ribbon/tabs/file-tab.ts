import { Settings } from 'lucide';
import {
	BACKSTAGE_NAV,
	BACKSTAGE_TEMPLATES,
	formatBackstageDate,
	formatBackstageSize,
	listBackstageRecentFiles,
} from 'pptx-viewer-shared';
import type {
	AccountAuthConfig,
	BackstagePage,
	BackstageRecentFile,
	ToolbarActionId,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { RibbonFileHandlers } from '../ribbon-types';
import { renderAccountPage } from './file-tab-account';
import { createFileActionGrid } from './file-tab-actions';
import { button, iconButton, labeledIconButton } from './file-tab-dom';
import { createLucideIcon } from './file-tab-icons';

export interface FileTab {
	el: HTMLElement;
	setHasMacros(hasMacros: boolean): void;
}

/** A `<span>` carrying translated text, built as a node so the label is never
 * interpolated into an HTML string. */
function span(doc: Document, text: string): HTMLSpanElement {
	const el = doc.createElement('span');
	el.textContent = text;
	return el;
}

export function createFileTab(
	doc: Document,
	t: Translator,
	handlers: RibbonFileHandlers,
	onClose: () => void,
	hiddenActions?: readonly ToolbarActionId[],
	accountAuth?: AccountAuthConfig,
): FileTab {
	const el = createEl(doc, 'div', 'pptxv-backstage');
	el.setAttribute('role', 'dialog');
	el.setAttribute('aria-modal', 'true');
	el.setAttribute('aria-label', t('pptx.backstage.title'));
	const aside = doc.createElement('aside');
	const back = iconButton(doc, 'back', onClose, 'pptxv-bs-back');
	back.setAttribute('aria-label', t('pptx.backstage.back'));
	const nav = doc.createElement('nav');
	aside.append(back, nav);
	const main = doc.createElement('main');
	el.append(aside, main);
	let page: BackstagePage = 'home';
	let hasMacros = false;
	let query = '';
	let recent: BackstageRecentFile[] = [];
	void (async () => {
		recent = await listBackstageRecentFiles(t);
		render();
	})();

	function run(callback: (() => void) | undefined): void {
		callback?.();
		if (callback) {
			onClose();
		}
	}
	function setPage(next: BackstagePage): void {
		if (next === 'close') {
			return onClose();
		}
		if (next === 'save') {
			return run(handlers.save);
		}
		if (next === 'options') {
			return run(handlers.openSettings);
		}
		page = next;
		render();
	}
	function renderNav(): void {
		nav.replaceChildren();
		for (const item of BACKSTAGE_NAV) {
			if (item.group && !nav.querySelector('i')) {
				nav.appendChild(doc.createElement('i'));
			}
			const itemButton = labeledIconButton(doc, item.id, t(item.labelKey), () => setPage(item.id));
			itemButton.classList.toggle('active', page === item.id);
			nav.appendChild(itemButton);
		}
	}
	function renderTemplates(): void {
		const heading = doc.createElement('h2');
		heading.textContent = t('pptx.backstage.newHeading');
		const grid = createEl(doc, 'div', 'pptxv-bs-templates');
		for (const template of BACKSTAGE_TEMPLATES) {
			const item = button(doc, '', () => run(() => handlers.createPresentation(template.id)));
			const preview = doc.createElement('b');
			preview.style.background = template.preview;
			const name = doc.createElement('strong');
			name.textContent = t(template.nameKey);
			const description = doc.createElement('small');
			description.textContent = t(template.descriptionKey);
			item.append(preview, name, description);
			grid.appendChild(item);
		}
		main.append(heading, grid);
	}
	function renderRecent(): void {
		const search = doc.createElement('input');
		search.className = 'pptxv-bs-search';
		search.type = 'search';
		search.placeholder = t('pptx.backstage.searchPlaceholder');
		search.value = query;
		search.addEventListener('input', () => {
			query = search.value;
			render();
		});
		main.appendChild(search);
		if (page === 'open') {
			main.appendChild(
				button(
					doc,
					t('pptx.backstage.browseDevice'),
					() => run(handlers.openFile),
					'pptxv-bs-primary',
				),
			);
		}
		const heading = doc.createElement('h2');
		heading.textContent = t('pptx.backstage.recentHeading');
		const list = createEl(doc, 'div', 'pptxv-bs-recent');
		const header = doc.createElement('header');
		header.replaceChildren(
			span(doc, t('pptx.backstage.columnName')),
			span(doc, t('pptx.backstage.columnModified')),
			span(doc, t('pptx.backstage.columnSize')),
		);
		list.appendChild(header);
		const needle = query.trim().toLowerCase();
		const files = needle
			? recent.filter((file) => `${file.name} ${file.location}`.toLowerCase().includes(needle))
			: recent;
		for (const file of files) {
			const row = button(doc, '', () => run(() => handlers.openRecentFile(file.key)));
			const name = createEl(doc, 'span', 'name');
			const badge = doc.createElement('b');
			badge.textContent = 'P';
			const labels = doc.createElement('span');
			const strong = doc.createElement('strong');
			strong.textContent = file.name;
			const small = doc.createElement('small');
			small.textContent = file.location;
			labels.append(strong, small);
			name.append(badge, labels);
			const date = doc.createElement('span');
			date.textContent = formatBackstageDate(file.timestamp, Date.now(), t);
			const size = doc.createElement('span');
			size.textContent = formatBackstageSize(file.size);
			row.append(name, date, size);
			list.appendChild(row);
		}
		if (!files.length) {
			const empty = doc.createElement('p');
			empty.textContent = t('pptx.backstage.noRecent');
			list.appendChild(empty);
		}
		main.append(heading, list);
	}
	function renderActions(): void {
		main.appendChild(createFileActionGrid(doc, page, handlers, hasMacros, run, t, hiddenActions));
	}
	function renderOptionsCard(): void {
		const card = createEl(doc, 'section', 'pptxv-bs-card');
		const avatar = doc.createElement('b');
		avatar.appendChild(createLucideIcon(doc, Settings, 24));
		const heading = doc.createElement('h2');
		heading.textContent = t('pptx.backstage.optionsTitle');
		const copy = doc.createElement('p');
		copy.textContent = t('pptx.backstage.optionsBody');
		card.append(avatar, heading, copy);
		card.appendChild(
			button(
				doc,
				t('pptx.backstage.openOptions'),
				() => run(handlers.openSettings),
				'pptxv-bs-primary',
			),
		);
		main.appendChild(card);
	}
	function render(): void {
		renderNav();
		main.replaceChildren();
		const heading = doc.createElement('h1');
		heading.textContent =
			page === 'home'
				? t('pptx.backstage.greeting')
				: t(BACKSTAGE_NAV.find((item) => item.id === page)?.labelKey ?? 'pptx.backstage.nav.home');
		main.appendChild(heading);
		if (page === 'home' || page === 'new') {
			renderTemplates();
		}
		if (page === 'home' || page === 'open') {
			renderRecent();
		}
		if (['info', 'saveAs', 'print', 'share', 'export'].includes(page)) {
			renderActions();
		}
		if (page === 'options') {
			renderOptionsCard();
		}
		if (page === 'account') {
			renderAccountPage(doc, t, main, accountAuth);
		}
		const footer = doc.createElement('footer');
		footer.textContent = `${t('pptx.backstage.untitled')} · ${t('pptx.backstage.savedToBrowser')}`;
		main.appendChild(footer);
	}
	render();
	return {
		el,
		setHasMacros(value) {
			hasMacros = value;
			if (page === 'saveAs') {
				render();
			}
		},
	};
}
