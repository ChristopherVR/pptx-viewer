import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { createActionSection } from './action-section';
import { createAnimationPanel } from './animation-panel';
import { createChartSection } from './chart-section';
import { createCommentsTab } from './comments-tab';
import { createDeckPanel } from './deck-panel';
import { createElementsTab } from './elements-tab';
import { createFillSection } from './fill-section';
import { createGroupInfoSection } from './group-info-section';
import { createImageSection } from './image-section';
import { createMediaSection } from './media-section';
import { createOlePropertiesSection } from './ole-properties-section';
import { createPositionSection } from './position-section';
import { createQuickStylesGallery } from './quick-styles-gallery';
import { createSmartArtSection } from './smartart-section';
import { createTableDataGrid } from './table-data-grid';
import { createTableSection } from './table-section';
import { createText3DSection } from './text-3d-section';
import { createTextSection } from './text-section';
import type { Inspector, InspectorHandlers } from './types';

type InspectorTabId = 'elements' | 'properties' | 'comments';

/**
 * The property inspector: a right-hand panel with React's three-tab strip
 * (Elements | Properties | Comments). The Properties tab shows the
 * element-type-aware sections when something is selected and a deck-level
 * panel (presentation / slide size / document) otherwise; Elements lists the
 * slide's layer order; Comments carries the slide's review comments. Vanilla
 * counterpart of React's `InspectorPane`, scoped to the highest-traffic
 * panels. All labels from the shared `pptx.*` dictionary.
 */
export function createInspector(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): Inspector {
	const el = createEl(doc, 'aside', 'pptxv-inspector');
	el.setAttribute('data-pptx-inspector', '');
	el.setAttribute('aria-label', t('pptx.inspector.properties'));

	// -- Tab strip (React's InspectorPaneHeader) ------------------------------
	const header = createEl(doc, 'div', 'pptxv-inspector-tabs');
	header.setAttribute('role', 'tablist');
	el.appendChild(header);
	const tabButtons = new Map<InspectorTabId, HTMLButtonElement>();
	const tabDefs: Array<{ id: InspectorTabId; label: string }> = [
		{ id: 'elements', label: t('pptx.documentProperties.statistics.elements') },
		{ id: 'properties', label: t('pptx.inspector.properties') },
		{ id: 'comments', label: t('pptx.toolbar.comments') },
	];
	for (const tab of tabDefs) {
		const btn = createEl(doc, 'button', 'pptxv-inspector-tab');
		btn.type = 'button';
		btn.setAttribute('role', 'tab');
		btn.textContent = tab.label;
		btn.addEventListener('click', () => setActiveTab(tab.id));
		header.appendChild(btn);
		tabButtons.set(tab.id, btn);
	}

	// -- Tab panes ------------------------------------------------------------
	const elementsTab = createElementsTab(doc, t, (id) => handlers.selectElement(id));
	elementsTab.el.classList.add('pptxv-inspector-body');
	el.appendChild(elementsTab.el);

	const body = createEl(doc, 'div', 'pptxv-inspector-body');
	el.appendChild(body);

	const commentsTab = createCommentsTab(doc, t, handlers);
	commentsTab.el.classList.add('pptxv-inspector-body');
	el.appendChild(commentsTab.el);

	// Docked per-element Animation panel: always at the bottom of the pane,
	// visible (on any tab) whenever an element is selected, matching React's
	// `InspectorPane` placement below the tab body.
	const animationPanel = createAnimationPanel(doc, t, handlers);
	el.appendChild(animationPanel.el);

	let activeTab: InspectorTabId = 'properties';
	const setActiveTab = (tab: InspectorTabId): void => {
		activeTab = tab;
		for (const [id, btn] of tabButtons) {
			btn.classList.toggle('is-active', id === tab);
			btn.setAttribute('aria-selected', String(id === tab));
		}
		elementsTab.el.hidden = tab !== 'elements';
		body.hidden = tab !== 'properties';
		commentsTab.el.hidden = tab !== 'comments';
	};

	// -- Properties tab content ----------------------------------------------
	// Deck-level (no selection) sections, React's default inspector view.
	const deckPanel = createDeckPanel(doc, t, handlers);
	body.appendChild(deckPanel.el);

	const section = (label: string): HTMLElement => {
		const wrap = createEl(doc, 'div', 'pptxv-inspector-section');
		const caption = createEl(doc, 'h4', 'pptxv-inspector-section-title');
		caption.textContent = label;
		wrap.appendChild(caption);
		body.appendChild(wrap);
		return wrap;
	};

	const position = createPositionSection(
		doc,
		t,
		section,
		handlers.setGeometry,
		handlers.toggleElementLock,
	);
	const groupInfo = createGroupInfoSection(doc, t, section);
	const oleProperties = createOlePropertiesSection(doc, t, section, handlers);
	const fill = createFillSection(doc, t, section, handlers);
	const quickStyles = createQuickStylesGallery(doc, t, section, handlers);
	const text = createTextSection(doc, t, section, handlers);
	const text3d = createText3DSection(doc, t, section, handlers);
	const image = createImageSection(doc, t, section, handlers);
	// The cell-text spreadsheet sits ABOVE the table's styling section, matching
	// React's inspector order. It builds its own <section> (rather than using the
	// `section()` factory) because it needs an aria-labelled landmark, so it is
	// appended to the body by hand at exactly this point.
	const tableDataGrid = createTableDataGrid(doc, t, handlers);
	body.appendChild(tableDataGrid.el);
	const table = createTableSection(doc, t, section, handlers);
	const smartArt = createSmartArtSection(doc, t, section, handlers);
	const action = createActionSection(doc, t, section, handlers);
	const chart = createChartSection(doc, t, section, handlers);
	const media = createMediaSection(doc, t, section, handlers);
	const sections = [
		position,
		groupInfo,
		oleProperties,
		fill,
		quickStyles,
		text,
		text3d,
		image,
		tableDataGrid,
		table,
		smartArt,
		action,
		chart,
		media,
	];

	setActiveTab(activeTab);

	return {
		el,
		update(state) {
			deckPanel.setVisible(!state.hasSelection);
			for (const s of sections) {
				s.update(state);
			}
		},
		updateDeck(state) {
			action.setSlideCount(state.slideCount);
			action.setCustomShows(state.customShows);
			elementsTab.update(state);
			commentsTab.update(state);
			deckPanel.update(state);
			animationPanel.update({
				editable: state.editable,
				selectedElementId: state.selectedElementId,
				elements: state.elements,
				animations: state.activeSlide?.animations ?? [],
				animationTimelineAnchors: state.activeSlide?.animationTimelineAnchors ?? [],
			});
		},
		setEditable(editable) {
			el.hidden = !editable;
			tableDataGrid.setEditable(editable);
		},
	};
}
