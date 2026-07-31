<script lang="ts">
	/**
	 * HomeTab: composes the Home tab's ribbon groups (Clipboard, Slides,
	 * Font, Paragraph, Arrange, Editing) into React's layout: one horizontal
	 * non-wrapping row of group columns, each with its controls on top and a
	 * tiny muted label below, separated by thin vertical rules, scrolling
	 * horizontally when the viewport is narrow. Every group is thin
	 * presentation; all logic lives in the editor modules each group imports.
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { FindReplaceState } from '../../../editor/editor-find-replace.svelte';
	import ArrangeGroup from '../../ArrangeGroup.svelte';
	import ShapeFormatGroup from '../../ShapeFormatGroup.svelte';
	import TextFormatGroup from '../../TextFormatGroup.svelte';
	import ArrangeExtras from './ArrangeExtras.svelte';
	import ClipboardGroup from './ClipboardGroup.svelte';
	import DrawingGroup from './DrawingGroup.svelte';
	import EditingGroup from './EditingGroup.svelte';
	import FontExtrasGroup from './FontExtrasGroup.svelte';
	import ParagraphDropdowns from './ParagraphDropdowns.svelte';
	import ParagraphGroup from './ParagraphGroup.svelte';
	import SlidesGroup from './SlidesGroup.svelte';
	import TextShadowToggle from './TextShadowToggle.svelte';

	const {
		editor,
		findReplace,
		onnavigateslide,
	}: {
		editor: EditorState;
		findReplace: FindReplaceState;
		onnavigateslide: (index: number) => void;
	} = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-hometab">
	<ClipboardGroup {editor} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<SlidesGroup {editor} onnavigate={onnavigateslide} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<div class="pptx-svelte-hometab-group">
		<div class="pptx-svelte-hometab-row">
			<TextFormatGroup {editor} />
			<FontExtrasGroup {editor} />
			<TextShadowToggle {editor} />
		</div>
		<span class="pptx-svelte-hometab-label">{t('pptx.ribbon.font')}</span>
	</div>
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<div class="pptx-svelte-hometab-group">
		<div class="pptx-svelte-hometab-row">
			<ParagraphGroup {editor} />
			<ParagraphDropdowns {editor} />
		</div>
		<span class="pptx-svelte-hometab-label">{t('pptx.ribbon.paragraph')}</span>
	</div>
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<div class="pptx-svelte-hometab-group">
		<div class="pptx-svelte-hometab-row">
			<DrawingGroup {editor} />
			<ShapeFormatGroup {editor} />
			<ArrangeGroup {editor} />
			<ArrangeExtras {editor} />
		</div>
		<span class="pptx-svelte-hometab-label">{t('pptx.ribbon.arrange')}</span>
	</div>
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<EditingGroup {editor} {findReplace} />
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
