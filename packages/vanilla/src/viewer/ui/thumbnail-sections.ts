import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { groupSlidesBySection, sectionAddAfterSlideIndex } from 'pptx-viewer-shared';
import type { SectionContextMenuCommandId } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { openSectionContextMenu } from './section-context-menu';

export interface ThumbnailSectionActions {
	toggle(sectionId: string): void;
	rename(sectionId: string, name: string): void;
	delete(sectionId: string): void;
	move(sectionId: string, direction: 'up' | 'down'): void;
	/** Add a new section starting at `slideIndex` (the slide after the section's last). */
	addAfter(slideIndex: number): void;
}

interface SectionRendererOptions {
	doc: Document;
	t: Translator;
	sections: readonly PptxSection[];
	slides: readonly PptxSlide[];
	actions?: ThumbnailSectionActions;
	buildSlide(slide: PptxSlide, index: number): HTMLButtonElement;
}

/**
 * Replace the toggle's label with an inline text field. Enter or blur commits
 * a non-empty name, Escape restores the label; the rail re-renders on commit.
 */
function startInlineRename(
	doc: Document,
	toggle: HTMLButtonElement,
	label: string,
	currentName: string,
	commit: (name: string) => void,
): void {
	const input = createEl(doc, 'input', 'pptxv-thumb-section-rename');
	input.type = 'text';
	input.value = currentName;
	let finished = false;
	const finish = (save: boolean): void => {
		if (finished) {
			return;
		}
		finished = true;
		const name = input.value.trim();
		if (save && name.length > 0) {
			commit(name);
		} else {
			toggle.textContent = label;
		}
	};
	input.addEventListener('keydown', (event) => {
		event.stopPropagation();
		if (event.key === 'Enter') {
			event.preventDefault();
			finish(true);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			finish(false);
		}
	});
	input.addEventListener('click', (event) => event.stopPropagation());
	input.addEventListener('blur', () => finish(true));
	toggle.replaceChildren(input);
	input.focus();
	input.select();
}

/** Build the sectioned rail while keeping the main thumbnail renderer focused. */
export function renderThumbnailSections(options: SectionRendererOptions): HTMLElement[] {
	const { doc, t, actions } = options;
	const groups = groupSlidesBySection(options.sections, options.slides);
	const declared = groups.filter((group) => group.section);
	return groups.map((group) => {
		const section = createEl(doc, 'section', 'pptxv-thumb-section');
		const header = createEl(doc, 'header', 'pptxv-thumb-section-header');
		header.dataset.pptxChrome = 'section-header';
		const toggle = createEl(doc, 'button', 'pptxv-thumb-section-toggle');
		toggle.type = 'button';
		toggle.setAttribute('aria-expanded', String(!group.section?.collapsed));
		const toggleLabel = `${group.section?.collapsed ? '▸' : '▾'} ${group.section?.name ?? t('pptx.slides.ungroupedSlides')} (${group.slides.length})`;
		toggle.textContent = toggleLabel;
		if (group.section) {
			const id = group.section.id;
			section.dataset.sectionId = id;
			toggle.addEventListener('click', () => actions?.toggle(id));
			if (actions) {
				const runCommand = (command: SectionContextMenuCommandId): void => {
					switch (command) {
						case 'rename':
							startInlineRename(doc, toggle, toggleLabel, group.section!.name, (name) =>
								actions.rename(id, name),
							);
							break;
						case 'delete':
							actions.delete(id);
							break;
						case 'move-up':
							actions.move(id, 'up');
							break;
						case 'move-down':
							actions.move(id, 'down');
							break;
						case 'add-after':
							actions.addAfter(
								sectionAddAfterSlideIndex(
									group.slideIndexes[group.slideIndexes.length - 1],
									options.slides.length,
								),
							);
							break;
						default:
							break;
					}
				};
				header.addEventListener('contextmenu', (event) => {
					event.preventDefault();
					openSectionContextMenu({
						doc,
						t,
						host: header,
						x: event.clientX,
						y: event.clientY,
						sectionIndex: declared.findIndex((candidate) => candidate.section?.id === id),
						totalSections: declared.length,
						onCommand: runCommand,
					});
				});
				toggle.addEventListener('dblclick', () => runCommand('rename'));
			}
		}
		// `p15:sectionPr/@clr`: parsed and round-tripped by core, but shown by
		// React alone until this. The dot leads the header, as React's does.
		if (group.section?.color) {
			const swatch = createEl(doc, 'span', 'pptxv-thumb-section-color');
			swatch.dataset.pptxSectionColor = group.section.color;
			swatch.style.background = group.section.color;
			header.appendChild(swatch);
		}
		header.appendChild(toggle);
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
