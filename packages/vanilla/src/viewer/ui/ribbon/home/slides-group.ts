import type { SlideTemplateId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { createIcon } from '../../icons';
import type { LayoutOption } from '../ribbon-types';
import { createSlideTemplateDialog } from './slide-template-dialog';

export interface SlidesGroupHandlers {
	addSlide(): void;
	insertSlideFromLayout(layoutPath: string, layoutName?: string): void;
	/** Insert a pre-designed starter slide from the shared template catalog. */
	insertSlideFromTemplate(templateId: SlideTemplateId): void;
	applyLayout(layoutPath: string): void;
	resetSlide(): void;
	addSection(): void;
	/** Deck scheme map so template previews show the deck's theme colours. */
	getTemplateScheme?(): Record<string, string> | undefined;
}

export interface SlidesGroupState {
	editable: boolean;
	slideCount: number;
	layouts: readonly LayoutOption[];
}

export interface SlidesGroup {
	el: HTMLElement;
	update(state: SlidesGroupState): void;
}

/** A layout picker popover: repopulated on every `setItems`, closes on select/outside. */
interface LayoutMenu {
	el: HTMLElement;
	setItems(layouts: readonly LayoutOption[]): void;
	toggle(): void;
	close(): void;
}

function createLayoutMenu(
	doc: Document,
	ariaLabel: string,
	onPick: (layout: LayoutOption) => void,
): LayoutMenu {
	const el = createEl(doc, 'div', 'pptxv-primary-menu pptxv-layout-menu');
	el.setAttribute('role', 'menu');
	el.setAttribute('aria-label', ariaLabel);
	el.hidden = true;

	let open = false;
	const setOpen = (next: boolean): void => {
		open = next;
		el.hidden = !next;
	};

	doc.addEventListener('pointerdown', (event) => {
		if (open && !el.parentElement?.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	return {
		el,
		setItems(layouts) {
			el.replaceChildren();
			for (const layout of layouts) {
				const btn = createEl(doc, 'button', 'pptxv-primary-menu-item');
				btn.type = 'button';
				btn.setAttribute('role', 'menuitem');
				btn.textContent = layout.name;
				btn.addEventListener('click', () => {
					setOpen(false);
					onPick(layout);
				});
				el.appendChild(btn);
			}
		},
		toggle: () => setOpen(!open),
		close: () => setOpen(false),
	};
}

/**
 * The ribbon Home tab's Slides group, mirroring React's `SlidesGroup`: a New
 * Slide split button (with a layout dropdown), a Layout dropdown, a Reset
 * button, and a Section button. Duplicate/delete are reached elsewhere (context
 * menu / thumbnail rail), matching React.
 */
export function createSlidesGroup(
	doc: Document,
	t: Translator,
	handlers: SlidesGroupHandlers,
): SlidesGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.sections.slides');
	el.appendChild(label);

	// -- New Slide split button (main + layout-dropdown caret) ----------------
	const newSlideSplit = createEl(doc, 'div', 'pptxv-slides-split');
	const add = makeButton(doc, {
		label: t('pptx.home.newSlide'),
		icon: 'new-slide',
		textLabel: t('pptx.home.newSlide'),
		onClick: handlers.addSlide,
	});
	const caret = createEl(doc, 'button', 'pptxv-slides-caret');
	caret.type = 'button';
	caret.title = t('pptx.home.chooseLayout');
	caret.setAttribute('aria-label', t('pptx.home.chooseLayout'));
	caret.setAttribute('aria-haspopup', 'menu');
	caret.appendChild(createIcon(doc, 'chevron-down'));
	const newSlideMenu = createLayoutMenu(doc, t('pptx.home.chooseLayout'), (layout) =>
		handlers.insertSlideFromLayout(layout.path, layout.name),
	);
	caret.addEventListener('click', (event) => {
		event.stopPropagation();
		newSlideMenu.toggle();
	});
	newSlideSplit.append(add.btn, caret, newSlideMenu.el);

	// -- Slide Templates gallery (React's LuLayoutTemplate pill) ---------------
	const templateDialog = createSlideTemplateDialog(doc, t, {
		onInsert: (templateId) => handlers.insertSlideFromTemplate(templateId),
		getScheme: () => handlers.getTemplateScheme?.(),
	});
	const templates = makeButton(doc, {
		label: t('pptx.home.slideTemplates'),
		icon: 'slide-templates',
		textLabel: t('pptx.home.slideTemplates'),
		onClick: () => {
			const host = templates.btn.closest<HTMLElement>('.pptxv') ?? doc.body;
			templateDialog.open(host);
		},
	});

	// -- Layout dropdown -------------------------------------------------------
	const layoutHost = createEl(doc, 'div', 'pptxv-slides-menu-host');
	const layout = makeButton(doc, {
		label: t('pptx.master.layout'),
		icon: 'layout',
		textLabel: t('pptx.master.layout'),
		onClick: () => layoutMenu.toggle(),
	});
	layout.btn.setAttribute('aria-haspopup', 'menu');
	const layoutMenu = createLayoutMenu(doc, t('pptx.master.layout'), (l) =>
		handlers.applyLayout(l.path),
	);
	layoutHost.append(layout.btn, layoutMenu.el);

	// -- Reset + Section pills -------------------------------------------------
	// The accessible name is the visible pill text in every binding; the longer
	// phrasing stays as the hover tooltip.
	const reset = makeButton(doc, {
		label: t('pptx.animations.reset'),
		icon: 'undo',
		textLabel: t('pptx.animations.reset'),
		onClick: handlers.resetSlide,
	});
	reset.btn.title = t('pptx.sections.resetSlideTitle');
	const section = makeButton(doc, {
		label: t('pptx.sections.sectionButtonLabel'),
		icon: 'folder-plus',
		textLabel: t('pptx.sections.sectionButtonLabel'),
		onClick: handlers.addSection,
	});
	section.btn.title = t('pptx.sections.addSection');

	row.append(newSlideSplit, templates.btn, layoutHost, reset.btn, section.btn);

	return {
		el,
		update({ editable, slideCount, layouts }) {
			const hasLayouts = layouts.length > 0;
			newSlideMenu.setItems(layouts);
			layoutMenu.setItems(layouts);
			add.setDisabled(!editable);
			// The caret only appears when there are layouts to choose (React parity).
			caret.hidden = !hasLayouts;
			caret.disabled = !editable;
			templates.setDisabled(!editable);
			layout.setDisabled(!editable || !hasLayouts);
			reset.setDisabled(!editable || slideCount === 0);
			section.setDisabled(!editable || slideCount === 0);
			if (!editable) {
				newSlideMenu.close();
				layoutMenu.close();
				templateDialog.close();
			}
		},
	};
}
