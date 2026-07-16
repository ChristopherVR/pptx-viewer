import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { groupSlidesBySection } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface ThumbnailSectionActions {
	toggle(sectionId: string): void;
	rename(sectionId: string, name: string): void;
	delete(sectionId: string): void;
	move(sectionId: string, direction: 'up' | 'down'): void;
}

interface SectionRendererOptions {
	doc: Document;
	t: Translator;
	sections: readonly PptxSection[];
	slides: readonly PptxSlide[];
	actions?: ThumbnailSectionActions;
	buildSlide(slide: PptxSlide, index: number): HTMLButtonElement;
}

/** Build the sectioned rail while keeping the main thumbnail renderer focused. */
export function renderThumbnailSections(options: SectionRendererOptions): HTMLElement[] {
	const { doc, t, actions } = options;
	const groups = groupSlidesBySection(options.sections, options.slides);
	return groups.map((group, groupIndex) => {
		const section = createEl(doc, 'section', 'pptxv-thumb-section');
		const header = createEl(doc, 'header', 'pptxv-thumb-section-header');
		const toggle = createEl(doc, 'button', 'pptxv-thumb-section-toggle');
		toggle.type = 'button';
		toggle.setAttribute('aria-expanded', String(!group.section?.collapsed));
		toggle.textContent = `${group.section?.collapsed ? '▸' : '▾'} ${group.section?.name ?? t('pptx.slides.ungroupedSlides')} (${group.slides.length})`;
		if (group.section) {
			section.dataset.sectionId = group.section.id;
			toggle.addEventListener('click', () => actions?.toggle(group.section!.id));
		}
		header.appendChild(toggle);
		if (group.section && actions) {
			const controls = createEl(doc, 'span', 'pptxv-thumb-section-actions');
			const add = (label: string, text: string, run: () => void, disabled = false) => {
				const button = createEl(doc, 'button');
				button.type = 'button';
				button.title = label;
				button.setAttribute('aria-label', label);
				button.textContent = text;
				button.disabled = disabled;
				button.addEventListener('click', run);
				controls.appendChild(button);
			};
			add(t('pptx.sections.rename'), '✎', () => {
				const name = doc.defaultView?.prompt(t('pptx.sections.rename'), group.section!.name);
				if (name !== null && name !== undefined) {
					actions.rename(group.section!.id, name);
				}
			});
			add(
				t('pptx.sections.moveUp'),
				'↑',
				() => actions.move(group.section!.id, 'up'),
				groupIndex === 0,
			);
			add(
				t('pptx.sections.moveDown'),
				'↓',
				() => actions.move(group.section!.id, 'down'),
				groupIndex === groups.length - 1,
			);
			add(t('pptx.sectionList.deleteSection'), '×', () => actions.delete(group.section!.id));
			header.appendChild(controls);
		}
		section.appendChild(header);
		if (!group.section?.collapsed) {
			const slides = createEl(doc, 'div', 'pptxv-thumb-section-slides');
			group.slides.forEach((slide, index) =>
				slides.appendChild(options.buildSlide(slide, group.slideIndexes[index])),
			);
			section.appendChild(slides);
		}
		return section;
	});
}
