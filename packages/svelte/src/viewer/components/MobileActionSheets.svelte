<script lang="ts">
	import type { PptxSlide } from 'pptx-viewer-core';
	import type { CanvasSize, MobileSheetKey } from 'pptx-viewer-shared';
	import { toggleSheet } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import InsertMenu from './InsertMenu.svelte';
	import InspectorPanel from './inspector/InspectorPanel.svelte';
	import MobileSheet from './MobileSheet.svelte';
	import ReviewCommentsPanel from './ribbon/review/ReviewCommentsPanel.svelte';
	import ThumbnailRail from './ThumbnailRail.svelte';

	const { editor, slides, canvasSize, mediaDataUrls, current, onselect, onprev, onnext, onnotes, onpresent, onzoomin, onzoomout }: {
		editor: EditorState;
		slides: PptxSlide[];
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		current: number;
		onselect: (index: number) => void;
		onprev: () => void;
		onnext: () => void;
		onnotes: () => void;
		onpresent: () => void;
		onzoomin: () => void;
		onzoomout: () => void;
	} = $props();
	const t = useTranslator();
	let active = $state<MobileSheetKey>(null);

	const open = (key: Exclude<MobileSheetKey, null>) => {
		active = toggleSheet(active, key);
	};
	const close = () => { active = null; };
	const selectSlide = (index: number) => { onselect(index); close(); };
	const actions = [
		['slides', t('pptx.sections.slides'), '▣'],
		['insert', t('pptx.mobileBar.insert'), '+'],
		['inspector', t('pptx.field.format'), '◇'],
		['comments', t('pptx.toolbar.comments'), '▢'],
		['menu', t('pptx.mobileToolbar.menu'), '⋯'],
	] as const;
</script>

<div class="pptx-svelte-mobile-actions">
	{#if active === 'slides'}
		<MobileSheet title={t('pptx.sections.slides')} onclose={close}>
			<ThumbnailRail {slides} {canvasSize} {mediaDataUrls} {current} onselect={selectSlide} />
		</MobileSheet>
	{:else if active === 'insert'}
		<MobileSheet title={t('pptx.mobileBar.insert')} onclose={close}><InsertMenu {editor} /></MobileSheet>
	{:else if active === 'inspector'}
		<MobileSheet title={t('pptx.field.format')} onclose={close}><InspectorPanel {editor} /></MobileSheet>
	{:else if active === 'comments'}
		<MobileSheet title={t('pptx.toolbar.comments')} onclose={close}><ReviewCommentsPanel {editor} /></MobileSheet>
	{:else if active === 'menu'}
		<MobileSheet title={t('pptx.mobileToolbar.menu')} onclose={close}>
			<div class="pptx-svelte-mobile-menu-grid">
				<button type="button" onclick={onprev} disabled={current <= 0}>{t('pptx.presenter.previousSlide')}</button>
				<button type="button" onclick={onnext} disabled={current >= slides.length - 1}>{t('pptx.presenter.nextSlide')}</button>
				<button type="button" onclick={onzoomout}>{t('pptx.statusBar.zoomOut')}</button>
				<button type="button" onclick={onzoomin}>{t('pptx.statusBar.zoomIn')}</button>
				<button type="button" onclick={onnotes}>{t('pptx.notes.title')}</button>
				<button type="button" onclick={onpresent}>{t('pptx.statusBar.slideShow')}</button>
			</div>
		</MobileSheet>
	{/if}
	<nav aria-label={t('pptx.mobileBar.ariaLabel')}>
		{#each actions as action}
			<button type="button" class:active={active === action[0]} aria-pressed={active === action[0]} onclick={() => open(action[0])}>
				<span aria-hidden="true">{action[2]}</span><small>{action[1]}</small>
			</button>
		{/each}
	</nav>
</div>

<style>
	.pptx-svelte-mobile-actions { display: none; }
	@media (max-width: 720px) {
		.pptx-svelte-mobile-actions { display: contents; }
		.pptx-svelte-mobile-actions nav { position: absolute; z-index: 50; right: 0; bottom: 0; left: 0; display: flex; min-height: 64px; padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid var(--pptx-border, #33334d); background: color-mix(in srgb, var(--pptx-card, #1e1e2e) 94%, transparent); }
		.pptx-svelte-mobile-actions nav button { display: grid; flex: 1; place-items: center; align-content: center; gap: 1px; min-width: 44px; border: 0; background: transparent; color: var(--pptx-muted-foreground, #94a3b8); touch-action: manipulation; }
		.pptx-svelte-mobile-actions nav button.active { color: var(--pptx-primary, #818cf8); }
		.pptx-svelte-mobile-actions nav span { font-size: 21px; line-height: 1; }
		.pptx-svelte-mobile-actions nav small { font-size: 10px; }
		.pptx-svelte-mobile-menu-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
		.pptx-svelte-mobile-menu-grid button { min-height: 44px; border: 1px solid var(--pptx-border, #33334d); border-radius: 8px; background: var(--pptx-muted, #2a2a3d); color: inherit; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-thumbs) { display:flex !important; max-height:55dvh; border:0; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-insert) { display: flex; flex-wrap: wrap; gap: 8px; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-insert-btn) { min-width: 44px; min-height: 44px; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-inspector) { display:flex !important; width:100%; max-height:55dvh; border:0; }
		:global(.pptx-svelte-mobile-sheet .pptx-svelte-comments) { box-sizing: border-box; width: 100%; padding: 0; border: 0; }
	}
</style>
