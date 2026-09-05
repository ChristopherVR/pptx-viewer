<script lang="ts">
	/**
	 * InspectorPanel: right-hand inspector pane, structured like React's
	 * `InspectorPane`: an [Elements | Properties | Comments] tab strip with a
	 * close button, defaulting to Properties.
	 *
	 * - Elements: the active slide's layer-order list ({@link ElementsListSection}).
	 * - Properties: with a selection, the element-type-aware sections
	 *   (Position, Fill & Stroke, Text, Image, Table, SmartArt, Chart, Media);
	 *   with no selection, the deck-level sections in React's order
	 *   ({@link PresentationPropertiesPanel}: PRESENTATION, THEME, THEME
	 *   OVERRIDE, SLIDE SIZE, NOTES & HANDOUT, DOCUMENT).
	 * - Comments: the slide's comment thread ({@link ReviewCommentsPanel}).
	 *
	 * Every control routes edits through `EditorState.applyElementPatch` /
	 * `patchSelected`, so every change is undo/redo-integrated. Open state and
	 * the active tab live in {@link ChromeUiState} when the host passes `ui`
	 * (so the toolbar's comments/inspector toggles stay in sync); standalone
	 * mounts fall back to local state.
	 */
	import { hasShapeProperties, hasTextProperties, isImageLikeElement } from 'pptx-viewer-core';
	import type { PptxHandler, PptxTheme } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import type { ChromeUiState, InspectorTabId } from '../../state/chrome-ui.svelte';
	import { useInspectorDeck } from '../../state/inspector-deck';
	import ReviewCommentsPanel from '../ribbon/review/ReviewCommentsPanel.svelte';
	import ActionSettingsPanel from './ActionSettingsPanel.svelte';
	import AltTextSection from './AltTextSection.svelte';
	import AnimationPanel from './AnimationPanel.svelte';
	import ChartSection from './ChartSection.svelte';
	import ElementsListSection from './ElementsListSection.svelte';
	import GroupInfoSection from './GroupInfoSection.svelte';
	import ImageSection from './ImageSection.svelte';
	import OlePropertiesSection from './OlePropertiesSection.svelte';
	import PositionSection from './PositionSection.svelte';
	import PresentationPropertiesPanel from './PresentationPropertiesPanel.svelte';
	import ShapeInspectorSections from './ShapeInspectorSections.svelte';
	import SmartArtSection from './SmartArtSection.svelte';
	import MediaSection from './MediaSection.svelte';
	import TableDataGrid from './TableDataGrid.svelte';
	import TableSection from './TableSection.svelte';
	import TextSection from './TextSection.svelte';

	const { editor, handler, presentationTheme, onthemechange, mediaDataUrls = new Map(), ui, canvasSize }: { editor: EditorState; handler?: PptxHandler | null; presentationTheme?: PptxTheme; onthemechange?: (theme: PptxTheme) => void; mediaDataUrls?: Map<string, string>; ui?: ChromeUiState; canvasSize?: CanvasSize } = $props();
	const t = useTranslator();
	// Deck-level state/mutations for the no-selection Properties tab, provided
	// by `PowerPointViewer` (undefined in standalone mounts, e.g. tests).
	const deck = useInspectorDeck();

	// Standalone fallbacks when no ChromeUiState is provided (tests, hosts).
	let localTab = $state<InspectorTabId>('properties');
	const activeTab = $derived(ui ? ui.inspectorTab : localTab);
	function setTab(tab: InspectorTabId): void {
		if (ui) {
			ui.setInspectorTab(tab);
		} else {
			localTab = tab;
		}
	}

	// Same dictionary key the vanilla inspector uses for its Elements tab.
	const tabs = $derived<Array<{ id: InspectorTabId; label: string }>>([
		{ id: 'elements', label: t('pptx.documentProperties.statistics.elements') },
		{ id: 'properties', label: t('pptx.inspector.properties') },
		{ id: 'comments', label: t('pptx.toolbar.comments') },
	]);

	const el = $derived(editor.selectedElement);
	const activeSlide = $derived(editor.slides[editor.currentSlideIndex]);
	const canShape = $derived(el !== undefined && hasShapeProperties(el));
	const canText = $derived(el !== undefined && hasTextProperties(el));
	const isImage = $derived(el !== undefined && isImageLikeElement(el));
	const isTable = $derived(el?.type === 'table');
	const isSmartArt = $derived(el?.type === 'smartArt');
	const isChart = $derived(el?.type === 'chart');
	const isMedia = $derived(el?.type === 'media');
	const isGroup = $derived(el?.type === 'group');
	const isOle = $derived(el?.type === 'ole');
	// React gates Quick Styles on shape/text (FillStrokeProperties): the presets
	// are shape-fill recipes and mean nothing on a picture or a table.
	const canQuickStyle = $derived(el?.type === 'shape' || el?.type === 'text');
	// A picture's own alt text/title editor is mounted below under `isImage`;
	// this covers only the three kinds `PptxNonVisualDescription` was added
	// to, so it does not duplicate a table/chart/smartArt/media/ole section's
	// own alt-text UI (those graphic-frame kinds have no editor of their own
	// yet, tracked separately).
	const isTextShapeOrConnector = $derived(
		el?.type === 'text' || el?.type === 'shape' || el?.type === 'connector',
	);
</script>

<aside
	class="pptx-svelte-inspector"
	data-pptx-inspector
	aria-label={t('pptx.inspector.properties')}
>
	<div class="pptx-svelte-inspector-header">
		<div class="pptx-svelte-inspector-tabs" role="tablist">
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === tab.id}
					class:pptx-svelte-inspector-tab-active={activeTab === tab.id}
					onclick={() => setTab(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="pptx-svelte-inspector-body">
			{#if activeTab === 'elements'}
				<ElementsListSection {editor} />
			{:else if activeTab === 'comments'}
				<ReviewCommentsPanel {editor} />
			{:else if el}
				<div class="pptx-svelte-inspector-section">
					<PositionSection {editor} {el} />
				</div>

				{#if isGroup}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.elementType.group')}</h4>
						<GroupInfoSection {el} />
					</div>
				{/if}

				{#if isOle}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.ole.title')}</h4>
						<OlePropertiesSection {editor} {el} />
					</div>
				{/if}

				{#if canShape}
					<ShapeInspectorSections {editor} {el} {canQuickStyle} />
				{/if}

				{#if canText}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.inspector.text')}</h4>
						<TextSection {editor} {el} />
					</div>
				{/if}

				{#if isImage}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.inspector.image')}</h4>
						<ImageSection {editor} {el} />
						<AltTextSection {editor} {el} />
					</div>
				{/if}

				{#if isTextShapeOrConnector}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.accessibility.heading')}</h4>
						<AltTextSection {editor} {el} />
					</div>
				{/if}

				{#if isTable}
					<!-- Cell text first (React's ElementInspectorBody renders the data
					     grid before the table properties panel), then the structure and
					     styling controls. -->
					<div class="pptx-svelte-inspector-section">
						<TableDataGrid {editor} {el} />
					</div>
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.inspector.table')}</h4>
						<TableSection
							{editor}
							{el}
							tableStyleMap={deck?.tableStyleMap}
							onTableStyleMapChange={deck?.updateTableStyleMap}
							onDeleteTableStyle={deck?.deleteTableStyle}
						/>
					</div>
				{/if}

				{#if isSmartArt && el?.type === 'smartArt'}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.smartart.title')}</h4>
						<SmartArtSection {editor} {el} />
					</div>
				{/if}
				{#if isChart}<div class="pptx-svelte-inspector-section"><h4>{t('pptx.inspector.chart')}</h4><ChartSection {editor} /></div>{/if}
				{#if isMedia}<div class="pptx-svelte-inspector-section"><h4>{t('pptx.inspector.media')}</h4><MediaSection {editor} {mediaDataUrls} /></div>{/if}

				<!-- Click / hover actions apply to every element type (React's
				     ElementInspectorBody renders ActionSettingsPanel unconditionally). -->
				<div class="pptx-svelte-inspector-section">
					<h4>{t('pptx.action.title')}</h4>
					<ActionSettingsPanel {editor} {el} />
				</div>
			{:else}
				<PresentationPropertiesPanel {editor} {deck} {canvasSize} {handler} {presentationTheme} {onthemechange} />
				{#if !activeSlide}
					<!-- React parity: only when there is genuinely no active slide. -->
					<p class="pptx-svelte-inspector-empty">{t('pptx.inspector.noSlideSelected')}</p>
				{/if}
			{/if}
	</div>

	<!-- Bottom dock: per-element animations, any tab (React InspectorPane parity). -->
	<AnimationPanel {editor} />
</aside>

<style>
	.pptx-svelte-inspector {
		display: flex;
		flex-direction: column;
		width: 288px;
		flex: none;
		border-left: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-card-foreground, #e2e8f0);
		font-family: system-ui, sans-serif;
		font-size: 12px;
		overflow: hidden;
		min-height: 0;
	}

	.pptx-svelte-inspector-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-bottom: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-inspector-tabs {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
	}

	.pptx-svelte-inspector-tabs button {
		padding: 3px 8px;
		border: none;
		border-radius: calc(var(--pptx-radius, 6px) - 2px);
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
		font: inherit;
		font-size: 11px;
		white-space: nowrap;
	}

	.pptx-svelte-inspector-tabs button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-inspector-tab-active {
		background: var(--pptx-primary, #6366f1) !important;
		color: #fff !important;
	}

	.pptx-svelte-inspector-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 0 12px 12px;
	}

	.pptx-svelte-inspector-body > :global(.pptx-svelte-comments) {
		width: 100%;
		padding-left: 0;
		border-left: none;
		margin-top: 12px;
	}

	.pptx-svelte-inspector-section {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-inspector-section:first-child {
		margin-top: 0;
		padding-top: 0;
		border-top: none;
	}

	.pptx-svelte-inspector-body > :global(.pptx-svelte-layers) {
		margin-top: 12px;
	}

	.pptx-svelte-inspector-section h4 {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-inspector-empty {
		margin: 12px 0 0;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
