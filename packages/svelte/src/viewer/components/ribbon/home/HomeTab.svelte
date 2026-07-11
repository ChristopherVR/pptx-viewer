<script lang="ts">
	/**
	 * HomeTab: composes the Home tab's six ribbon groups (Clipboard, Slides,
	 * Font, Paragraph, Arrange, Editing), matching React's Home tab layout
	 * (React folds several dedicated section components into one visual
	 * "Home" row; this does the same via composition, not inheritance). Every
	 * group is thin presentation; all logic lives in the editor modules each
	 * group imports.
	 */
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { FindReplaceState } from '../../../editor/editor-find-replace.svelte';
	import ArrangeGroup from '../../ArrangeGroup.svelte';
	import ShapeFormatGroup from '../../ShapeFormatGroup.svelte';
	import TextFormatGroup from '../../TextFormatGroup.svelte';
	import ArrangeExtras from './ArrangeExtras.svelte';
	import ClipboardGroup from './ClipboardGroup.svelte';
	import EditingGroup from './EditingGroup.svelte';
	import FontExtrasGroup from './FontExtrasGroup.svelte';
	import ParagraphGroup from './ParagraphGroup.svelte';
	import SlidesGroup from './SlidesGroup.svelte';

	const {
		editor,
		findReplace,
		onnavigateslide,
	}: {
		editor: EditorState;
		findReplace: FindReplaceState;
		onnavigateslide: (index: number) => void;
	} = $props();
</script>

<div class="pptx-svelte-hometab">
	<ClipboardGroup {editor} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<SlidesGroup {editor} onnavigate={onnavigateslide} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<TextFormatGroup {editor} />
	<FontExtrasGroup {editor} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<ParagraphGroup {editor} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<ShapeFormatGroup {editor} />
	<ArrangeGroup {editor} />
	<ArrangeExtras {editor} />
	<span class="pptx-svelte-hometab-sep" aria-hidden="true"></span>
	<EditingGroup {editor} {findReplace} />
</div>

<style>
	.pptx-svelte-hometab {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.pptx-svelte-hometab-sep {
		width: 1px;
		height: 26px;
		background: var(--pptx-border, #33334d);
	}
</style>
