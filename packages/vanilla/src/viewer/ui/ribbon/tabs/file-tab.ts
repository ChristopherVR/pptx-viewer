import { Settings } from 'lucide';
import {
	BACKSTAGE_NAV,
	BACKSTAGE_TEMPLATES,
	formatBackstageDate,
	formatBackstageSize,
	listBackstageRecentFiles,
} from 'pptx-viewer-shared';
import type { AccountAuthConfig, BackstagePage, BackstageRecentFile } from 'pptx-viewer-shared';

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

export function createFileTab(
	doc: Document,
	t: Translator,
	handlers: RibbonFileHandlers,
	onClose: () => void,
	accountAuth?: AccountAuthConfig,
): FileTab {
	const el = createEl(doc, 'div', 'pptxv-backstage');
	el.setAttribute('role', 'dialog');
	el.setAttribute('aria-modal', 'true');
	el.setAttribute('aria-label', 'File');
	const aside = doc.createElement('aside');
	const back = iconButton(doc, 'back', onClose, 'pptxv-bs-back');
	back.setAttribute('aria-label', 'Back to presentation');
	const nav = doc.createElement('nav');
	aside.append(back, nav);
	const main = doc.createElement('main');
	el.append(aside, main);
	let page: BackstagePage = 'home';
	let hasMacros = false;
	let query = '';
	let recent: BackstageRecentFile[] = [];
	void (async () => {
		recent = await listBackstageRecentFiles();
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
			const itemButton = labeledIconButton(doc, item.id, item.label, () => setPage(item.id));
			itemButton.classList.toggle('active', page === item.id);
			nav.appendChild(itemButton);
		}
	}
	function renderTemplates(): void {
		const heading = doc.createElement('h2');
		heading.textContent = 'New';
		const grid = createEl(doc, 'div', 'pptxv-bs-templates');
		for (const template of BACKSTAGE_TEMPLATES) {
			const item = button(doc, '', () => run(() => handlers.createPresentation(template.id)));
			const preview = doc.createElement('b');
			preview.style.background = template.preview;
			const name = doc.createElement('strong');
			name.textContent = template.name;
			const description = doc.createElement('small');
			description.textContent = template.description;
			item.append(preview, name, description);
			grid.appendChild(item);
		}
		main.append(heading, grid);
	}
	function renderRecent(): void {
		const search = doc.createElement('input');
		search.className = 'pptxv-bs-search';
		search.type = 'search';
		search.placeholder = 'Search recent presentations';
		search.value = query;
		search.addEventListener('input', () => {
			query = search.value;
			render();
		});
		main.appendChild(search);
		if (page === 'open') {
			main.appendChild(
				button(doc, 'Browse this device', () => run(handlers.openFile), 'pptxv-bs-primary'),
			);
		}
		const heading = doc.createElement('h2');
		heading.textContent = 'Recent';
		const list = createEl(doc, 'div', 'pptxv-bs-recent');
		const header = doc.createElement('header');
		header.innerHTML = '<span>Name</span><span>Date modified</span><span>Size</span>';
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
			date.textContent = formatBackstageDate(file.timestamp);
			const size = doc.createElement('span');
			size.textContent = formatBackstageSize(file.size);
			row.append(name, date, size);
			list.appendChild(row);
		}
		if (!files.length) {
			const empty = doc.createElement('p');
			empty.textContent = 'No recent presentations yet.';
			list.appendChild(empty);
		}
		main.append(heading, list);
	}
	function renderActions(): void {
		main.appendChild(createFileActionGrid(doc, page, handlers, hasMacros, run));
	}
	function renderOptionsCard(): void {
		const card = createEl(doc, 'section', 'pptxv-bs-card');
		const avatar = doc.createElement('b');
		avatar.appendChild(createLucideIcon(doc, Settings, 24));
		const heading = doc.createElement('h2');
		heading.textContent = 'PowerPoint Options';
		const copy = doc.createElement('p');
		copy.textContent =
			'Configure autosave, proofing, grid, rulers, language, theme, and keyboard shortcuts.';
		card.append(avatar, heading, copy);
		card.appendChild(
			button(doc, 'Open Options', () => run(handlers.openSettings), 'pptxv-bs-primary'),
		);
		main.appendChild(card);
	}
	function render(): void {
		renderNav();
		main.replaceChildren();
		const heading = doc.createElement('h1');
		heading.textContent =
			page === 'home'
				? 'Good evening'
				: (BACKSTAGE_NAV.find((item) => item.id === page)?.label ?? 'Home');
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
		footer.textContent = 'Presentation · Saved to this browser';
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
