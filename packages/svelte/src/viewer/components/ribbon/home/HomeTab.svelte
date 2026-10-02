<script lang="ts">
	/**
	 * HomeTab: composes the Home tab's ribbon groups (Clipboard, Slides,
	 * Font, Paragraph, Drawing, Arrange, Editing) into React's layout: one horizontal
	 * non-wrapping row of group columns, each with its controls on top and a
	 * tiny muted label below, separated by thin vertical rules, scrolling
	 * horizontally when the viewport is narrow. Every group is thin
	 * presentation; all logic lives in the editor modules each group imports.
	 * Every group wrapper carries its catalogue `data-ribbon-group` id so a
	 * host customisation can hide it (shared `ribbonCustomizationCss`).
	 */
	import { isActionHidden } from 'pptx-viewer-shared';
	import type { ToolbarActionId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { FindReplaceState } from '../../../editor/editor-find-replace.svelte';
	import ShapeFormatGroup from '../../ShapeFormatGroup.svelte';
	import FontFormattingGroup from './FontFormattingGroup.svelte';
	import FontSizeSelect from './FontSizeSelect.svelte';
	import ArrangeExtras from './ArrangeExtras.svelte';
	import ArrangeHomeStrip from './ArrangeHomeStrip.svelte';
	import ClipboardGroup from './ClipboardGroup.svelte';
	import CropControls from './CropControls.svelte';
	import DrawingGroup from './DrawingGroup.svelte';
	import EditingGroup from './EditingGroup.svelte';
	import FontFamilySelect from './FontFamilySelect.svelte';
	import MergeShapesButton from './MergeShapesButton.svelte';
	import ParagraphDropdowns from './ParagraphDropdowns.svelte';
	import ParagraphGroup from './ParagraphGroup.svelte';
	import SlidesGroup from './SlidesGroup.svelte';

	const {
		editor,
		findReplace,
		onnavigateslide,
		hiddenActions,
	}: {
		editor: EditorState;
		findReplace: FindReplaceState;
		onnavigateslide: (index: number) => void;
		/** Toolbar buttons the host hid (legacy prop folded with `customization`). */
		hiddenActions?: readonly ToolbarActionId[];
	} = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-hometab" data-pptx-chrome="home-content">
	<ClipboardGroup {editor} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<SlidesGroup {editor} onnavigate={onnavigateslide} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<div class="pptx-svelte-hometab-group" data-pptx-chrome="home-group" data-ribbon-group="home.font">
		<div data-pptx-chrome="font-picker-controls"><FontFamilySelect {editor} /><FontSizeSelect {editor} /></div>
		<span data-pptx-chrome="ribbon-group-label">{t('pptx.ribbon.font')}</span>
	</div>
	<div class="pptx-svelte-hometab-group" data-pptx-chrome="home-group" data-ribbon-group="home.font">
		<FontFormattingGroup {editor} />
		<span data-pptx-chrome="ribbon-group-label">{t('pptx.ribbon.font')}</span>
	</div>
	<div class="pptx-svelte-hometab-group" data-ribbon-group="home.paragraph">
		<div class="pptx-svelte-hometab-row" data-pptx-chrome="paragraph-controls">
			<ParagraphGroup {editor} />
			<ParagraphDropdowns {editor} />
		</div>
		<span class="pptx-svelte-hometab-label" data-pptx-chrome="ribbon-group-label">{t('pptx.ribbon.paragraph')}</span>
	</div>
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<EditingGroup {editor} {findReplace} />
	<div class="pptx-svelte-hometab-group" data-ribbon-group="home.drawing">
		<div class="pptx-svelte-hometab-row" data-pptx-chrome="drawing-controls">
			<DrawingGroup {editor} />
		</div>
		<span class="pptx-svelte-hometab-label" data-pptx-chrome="ribbon-group-label">{t('pptx.ribbon.groupDrawing')}</span>
	</div>
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<div class="pptx-svelte-hometab-group" data-ribbon-group="home.arrange">
		<div class="pptx-svelte-hometab-row" data-pptx-chrome="arrange-controls">
			<ArrangeExtras {editor} />
			{#if !isActionHidden('mergeShapes', hiddenActions)}<MergeShapesButton {editor} />{/if}
			{#if !isActionHidden('crop', hiddenActions)}<CropControls {editor} />{/if}
			<ShapeFormatGroup {editor} section="width" />
			<ArrangeHomeStrip {editor} strip="order" /><ArrangeHomeStrip {editor} strip="edit" />
		</div>
		<span class="pptx-svelte-hometab-label" data-pptx-chrome="ribbon-group-label">{t('pptx.ribbon.arrange')}</span>
	</div>
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
</div>

<style>
	.pptx-svelte-hometab {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 6px;
	}

	.pptx-svelte-hometab-sep {
		width: 1px;
		align-self: stretch;
		margin: 2px 0;
		flex: none;
		background: color-mix(in srgb, var(--pptx-border, #33334d) 40%, transparent);
	}

	.pptx-svelte-hometab-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		flex: none;
	}

	.pptx-svelte-hometab-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-hometab-label {
		font-size: 9px;
		color: var(--pptx-muted-foreground, #94a3b8);
		line-height: 1;
		white-space: nowrap;
	}
</style>
