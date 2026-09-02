import type { MasterViewTab, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import { masterViewBackgroundColor, masterViewPseudoSlide } from 'pptx-viewer-shared';
import type { CanvasSize, MasterViewCrudAction, MasterViewCrudActionId } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

const THUMB_WIDTH = 128;
const HANDOUT_COUNTS = [1, 2, 3, 4, 6, 9] as const;

export interface MasterViewSidebarOptions {
	tab: MasterViewTab;
	masters: readonly PptxSlideMaster[];
	active: { masterIndex: number; layoutIndex: number | null };
	canvasSize: CanvasSize;
	notesBackground?: string;
	notesPlaceholders?: readonly { type: string; idx?: string }[];
	notesMasterPresent: boolean;
	handoutBackground?: string;
	handoutPlaceholders?: readonly { type: string; idx?: string }[];
	handoutMasterPresent: boolean;
	handoutSlidesPerPage: number;
	/** Editing affordances are offered only on an editable deck. */
	editable?: boolean;
	/** B4: the sidebar's CRUD command list for the current target (`[]` when there is none). */
	crudActions: readonly MasterViewCrudAction[];
	onCrudAction(id: MasterViewCrudActionId): void;
	renderStage(slide: PptxSlide, scale: number): HTMLElement;
	onSelect(masterIndex: number, layoutIndex: number | null): void;
	onTabChange(tab: MasterViewTab): void;
	onCollapse(): void;
	onHandoutSlidesPerPageChange(count: number): void;
	onMasterBackgroundColorChange(color: string): void;
}

export interface MasterViewSidebar {
	el: HTMLElement;
	render(options: MasterViewSidebarOptions): void;
	setVisible(visible: boolean): void;
}

const placeholderKeys: Record<string, string> = {
	body: 'pptx.master.notesMasterBody',
	sldImg: 'pptx.master.notesMasterSlideImage',
	hdr: 'pptx.master.notesMasterHeader',
	ftr: 'pptx.master.notesMasterFooter',
	dt: 'pptx.master.notesMasterDate',
	sldNum: 'pptx.master.notesMasterPageNumber',
};

function addBackgroundCard(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	color: string,
	onChange: (color: string) => void,
): void {
	const card = createEl(doc, 'section', 'pptxv-master-card');
	const label = createEl(doc, 'div', 'pptxv-master-card-label');
	label.textContent = t('pptx.master.notesMasterBackground');
	const input = createEl(doc, 'input', 'pptxv-master-background');
	input.type = 'color';
	input.value = /^#[\da-f]{6}$/i.test(color) ? color : '#ffffff';
	input.setAttribute('aria-label', t('pptx.master.backgroundColorLabel'));
	input.addEventListener('input', () => onChange(input.value));
	card.append(label, input);
	parent.appendChild(card);
}

function addPlaceholderCard(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	placeholders: readonly { type: string; idx?: string }[],
	accent: 'notes' | 'handout',
): void {
	const card = createEl(doc, 'section', 'pptxv-master-card');
	const label = createEl(doc, 'div', 'pptxv-master-card-label');
	label.textContent = t('pptx.master.notesMasterPlaceholders');
	card.appendChild(label);
	if (placeholders.length === 0) {
		const empty = createEl(doc, 'div', 'pptxv-master-empty');
		empty.textContent = t('pptx.master.noPlaceholders');
		card.appendChild(empty);
	}
	for (const ph of placeholders) {
		const row = createEl(doc, 'div', 'pptxv-master-placeholder');
		const dot = createEl(doc, 'span', `pptxv-master-dot is-${accent}`);
		row.append(dot, doc.createTextNode(t(placeholderKeys[ph.type] ?? ph.type)));
		card.appendChild(row);
	}
	parent.appendChild(card);
}

/** The same pseudo-slide the master canvas paints, from the shared rule. */
function slideFromMaster(master: PptxSlideMaster, layoutIndex: number | null): PptxSlide {
	return (
		masterViewPseudoSlide(
			{ slideMasters: [master] },
			{ tab: 'slides', masterIndex: 0, layoutIndex },
		) ?? { id: master.path, rId: '', slideNumber: 0, elements: [] }
	);
}

/** One CRUD button per {@link MasterViewCrudAction} (Insert/Duplicate/Delete/Rename x2). */
function addCrudActionsRow(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	actions: readonly MasterViewCrudAction[],
	onAction: (id: MasterViewCrudActionId) => void,
): void {
	if (actions.length === 0) {
		return;
	}
	const row = createEl(doc, 'div', 'pptxv-master-crud');
	for (const action of actions) {
		const button = createEl(doc, 'button', 'pptxv-master-crud-btn');
		button.type = 'button';
		button.dataset.testid = `pptx-master-crud-${action.id}`;
		button.textContent = t(action.labelKey);
		button.disabled = !action.enabled;
		if (action.disabledReasonKey) {
			button.title = t(action.disabledReasonKey);
		}
		button.addEventListener('click', () => onAction(action.id));
		row.appendChild(button);
	}
	parent.appendChild(row);
}

function renderSlides(
	doc: Document,
	t: Translator,
	body: HTMLElement,
	o: MasterViewSidebarOptions,
): void {
	// Format Background for the selected master or layout. PowerPoint writes an
	// explicit `p:bgPr` here, deliberately replacing a themed `p:bgRef`; the
	// shared rule decides which part the colour lands on.
	if (o.editable) {
		addBackgroundCard(
			doc,
			t,
			body,
			masterViewBackgroundColor(
				{ slideMasters: o.masters },
				{ tab: 'slides', masterIndex: o.active.masterIndex, layoutIndex: o.active.layoutIndex },
			) ?? '#ffffff',
			o.onMasterBackgroundColorChange,
		);
		addCrudActionsRow(doc, t, body, o.crudActions, o.onCrudAction);
	}
	const scale = THUMB_WIDTH / Math.max(o.canvasSize.width, 1);
	for (const [masterIndex, master] of o.masters.entries()) {
		const entries: Array<{ layoutIndex: number | null; label: string }> = [
			{ layoutIndex: null, label: master.name || t('pptx.master.master') },
			...(master.layouts?.map((layout, layoutIndex) => ({
				layoutIndex,
				label: layout.name || t('pptx.master.layout'),
			})) ?? []),
		];
		for (const entry of entries) {
			const button = createEl(
				doc,
				'button',
				`pptxv-master-thumb${entry.layoutIndex === null ? '' : ' is-layout'}`,
			);
			button.type = 'button';
			button.setAttribute('aria-label', entry.label);
			const active =
				o.active.masterIndex === masterIndex && o.active.layoutIndex === entry.layoutIndex;
			button.classList.toggle('is-active', active);
			if (active) {
				button.setAttribute('aria-current', 'page');
			}
			const name = createEl(doc, 'span', 'pptxv-master-thumb-name');
			name.textContent = entry.label;
			const frame = createEl(doc, 'span', 'pptxv-master-thumb-frame');
			frame.style.width = `${THUMB_WIDTH}px`;
			frame.style.height = `${Math.round(o.canvasSize.height * scale)}px`;
			frame.appendChild(o.renderStage(slideFromMaster(master, entry.layoutIndex), scale));
			button.append(name, frame);
			button.addEventListener('click', () => o.onSelect(masterIndex, entry.layoutIndex));
			body.appendChild(button);
		}
	}
}

export function createMasterViewSidebar(doc: Document, t: Translator): MasterViewSidebar {
	const el = createEl(doc, 'aside', 'pptxv-master-sidebar');
	el.hidden = true;
	el.setAttribute('aria-label', t('pptx.view.masterViews'));
	return {
		el,
		render(o) {
			el.replaceChildren();
			const header = createEl(doc, 'header', 'pptxv-master-header');
			const title = createEl(doc, 'span', 'pptxv-master-title');
			title.textContent = t(
				o.tab === 'slides'
					? 'pptx.masterView.slideMastersTitle'
					: o.tab === 'notes'
						? 'pptx.masterView.notesMasterTitle'
						: 'pptx.masterView.handoutMasterTitle',
			);
			const collapse = createEl(doc, 'button', 'pptxv-master-collapse');
			collapse.type = 'button';
			collapse.textContent = '‹';
			collapse.title = t('pptx.masterView.collapse');
			collapse.setAttribute('aria-label', t('pptx.masterView.collapse'));
			collapse.addEventListener('click', o.onCollapse);
			header.append(title, collapse);

			const tabs = createEl(doc, 'div', 'pptxv-master-tabs');
			tabs.setAttribute('role', 'tablist');
			for (const [tab, key] of [
				['slides', 'pptx.sections.slides'],
				['notes', 'pptx.notes.title'],
				['handout', 'pptx.masterView.tabHandout'],
			] as const) {
				const button = createEl(doc, 'button', 'pptxv-master-tab');
				button.type = 'button';
				button.role = 'tab';
				button.textContent = t(key);
				button.setAttribute('aria-selected', String(o.tab === tab));
				button.classList.toggle('is-active', o.tab === tab);
				button.addEventListener('click', () => o.onTabChange(tab));
				tabs.appendChild(button);
			}

			const body = createEl(doc, 'div', 'pptxv-master-body');
			body.setAttribute('role', 'tabpanel');
			if (o.tab === 'slides') {
				renderSlides(doc, t, body, o);
			} else if (o.tab === 'notes') {
				if (!o.notesMasterPresent) {
					body.textContent = t('pptx.master.noNotesMaster');
					body.classList.add('pptxv-master-empty');
				} else {
					addBackgroundCard(
						doc,
						t,
						body,
						o.notesBackground ?? '#ffffff',
						o.onMasterBackgroundColorChange,
					);
					addPlaceholderCard(doc, t, body, o.notesPlaceholders ?? [], 'notes');
				}
			} else if (!o.handoutMasterPresent) {
				body.textContent = t('pptx.master.noHandoutMaster');
				body.classList.add('pptxv-master-empty');
			} else {
				const card = createEl(doc, 'section', 'pptxv-master-card');
				const label = createEl(doc, 'div', 'pptxv-master-card-label');
				label.textContent = t('pptx.master.handoutSlidesPerPage');
				const grid = createEl(doc, 'div', 'pptxv-master-counts');
				for (const count of HANDOUT_COUNTS) {
					const button = createEl(doc, 'button', 'pptxv-master-count');
					button.type = 'button';
					button.textContent = String(count);
					button.setAttribute('aria-pressed', String(o.handoutSlidesPerPage === count));
					button.classList.toggle('is-active', o.handoutSlidesPerPage === count);
					button.addEventListener('click', () => o.onHandoutSlidesPerPageChange(count));
					grid.appendChild(button);
				}
				card.append(label, grid);
				body.appendChild(card);
				addBackgroundCard(
					doc,
					t,
					body,
					o.handoutBackground ?? '#ffffff',
					o.onMasterBackgroundColorChange,
				);
				addPlaceholderCard(doc, t, body, o.handoutPlaceholders ?? [], 'handout');
			}
			el.append(header, tabs, body);
		},
		setVisible(visible) {
			el.hidden = !visible;
		},
	};
}
