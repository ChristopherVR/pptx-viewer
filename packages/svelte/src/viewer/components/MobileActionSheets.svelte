<script lang="ts">
	import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
	import type {
		CanvasSize,
		MobileBarRequestEvent,
		MobileBarViewState,
		MobileSheetKey,
	} from 'pptx-viewer-shared';
	import { toggleSheet } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { newTextElement } from '../editor';
	import type { EditorState } from '../editor/editor-state.svelte';
	import InsertMenu from './InsertMenu.svelte';
	import InspectorPanel from './inspector/InspectorPanel.svelte';
	import MobileSheet from './MobileSheet.svelte';
	import ReviewCommentsPanel from './ribbon/review/ReviewCommentsPanel.svelte';
	import ThumbnailRail from './ThumbnailRail.svelte';

	const { active, onactivechange, editor, handler, presentationTheme, onthemechange, slides, canvasSize, mediaDataUrls, current, onselect }: {
		active: MobileSheetKey;
		onactivechange: (active: MobileSheetKey) => void;
		editor: EditorState;
		handler?: PptxHandler | null;
		presentationTheme?: PptxTheme;
		onthemechange?: (theme: PptxTheme) => void;
		slides: PptxSlide[];
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		current: number;
		onselect: (index: number) => void;
	} = $props();
	const t = useTranslator();
	const open = (key: Exclude<MobileSheetKey, null>) => {
		onactivechange(toggleSheet(active, key));
	};
	const close = () => { onactivechange(null); };
	const selectSlide = (index: number) => { onselect(index); close(); };
	/** A thin adapter around the shared `pptx-ui-mobile-bar` (markup, gating, pressed state). */
	const barState = $derived<MobileBarViewState>({
		slideCount: slides.length,
		activeSheet: active === 'menu' ? null : active,
		translate: t,
	});
	function request(event: MobileBarRequestEvent): void {
		const key = event.detail.id;
		if (key === 'insert') {
			editor.insertElement(newTextElement());
			onactivechange(null);
		} else {
			open(key);
		}
	}
</script>

<div class="pptx-svelte-mobile-actions">
	{#if active === 'slides'}
		<MobileSheet title={t('pptx.sections.slides')} onclose={close}>
			<ThumbnailRail {slides} {canvasSize} {mediaDataUrls} {current} onselect={selectSlide} />
		</MobileSheet>
	{:else if active === 'insert'}
		<MobileSheet title={t('pptx.mobileBar.insert')} onclose={close}><InsertMenu {editor} /></MobileSheet>
	{:else if active === 'inspector'}
		<MobileSheet title={t('pptx.field.format')} onclose={close}><InspectorPanel {editor} {handler} {presentationTheme} {onthemechange} {mediaDataUrls} /></MobileSheet>
	{:else if active === 'comments'}
		<MobileSheet title={t('pptx.toolbar.comments')} onclose={close}><ReviewCommentsPanel {editor} embedded /></MobileSheet>
	{/if}
	<pptx-ui-mobile-bar state={barState} onmobile-bar-request={request}></pptx-ui-mobile-bar>
</div>

<style>
	.pptx-svelte-mobile-actions { display: none; }
	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		.pptx-svelte-mobile-actions { display: contents; }
		.pptx-svelte-mobile-actions pptx-ui-mobile-bar { position: absolute; z-index: 50; right: 0; bottom: 0; left: 0; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-thumbs) { display:flex !important; max-height:55dvh; border:0; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-insert) { display: flex; flex-wrap: wrap; gap: 8px; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-insert-btn) { min-width: 44px; min-height: 44px; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-inspector) { display:flex !important; width:100%; max-height:55dvh; border:0; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-comments) { box-sizing: border-box; width: 100%; padding: 0; border: 0; }
	}
</style>
