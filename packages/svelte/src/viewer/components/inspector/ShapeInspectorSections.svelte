<script lang="ts">
	/**
	 * ShapeInspectorSections: the "Fill & Stroke" + "Effects" inspector sections
	 * shown for any shape-property element (shape, connector, text box, image,
	 * ...). Split out of `InspectorPanel` purely to keep that dispatcher under
	 * the repo's file-size budget; it owns no state of its own.
	 */
	import type { PptxElement } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import EffectsPanel from './EffectsPanel.svelte';
	import FillStrokeSection from './FillStrokeSection.svelte';
	import QuickStylesGallery from './QuickStylesGallery.svelte';
	import ShapeSection from './ShapeSection.svelte';

	const {
		editor,
		el,
		canQuickStyle,
	}: { editor: EditorState; el: PptxElement; canQuickStyle: boolean } = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-inspector-section">
	<h4>{t('pptx.inspector.fillStroke')}</h4>
	{#if canQuickStyle}
		<QuickStylesGallery {editor} {el} />
	{/if}
	<ShapeSection {editor} {el} />
	<FillStrokeSection {editor} {el} />
</div>
<div class="pptx-svelte-inspector-section">
	<h4>{t('pptx.inspector.effects')}</h4>
	<EffectsPanel {editor} {el} />
</div>
