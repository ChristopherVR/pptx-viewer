<script lang="ts">
	import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
	import type { CanvasSize, MobileSheetKey } from 'pptx-viewer-shared';
	import { buildBarActions, toggleSheet } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { newTextElement } from '../editor';
	import type { EditorState } from '../editor/editor-state.svelte';
	import InsertMenu from './InsertMenu.svelte';
	import InspectorPanel from './inspector/InspectorPanel.svelte';
	import MobileSheet from './MobileSheet.svelte';
	import ReviewCommentsPanel from './ribbon/review/ReviewCommentsPanel.svelte';
	import ThumbnailRail from './ThumbnailRail.svelte';

	const { active, onactivechange, editor, handler, presentationTheme, onthemechange, slides, canvasSize, mediaDataUrls, current, onselect, onzoomin, onzoomout, onzoomfit }: {
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
		onzoomin: () => void;
		onzoomout: () => void;
		onzoomfit: () => void;
	} = $props();
	const t = useTranslator();
	const open = (key: Exclude<MobileSheetKey, null>) => {
		onactivechange(toggleSheet(active, key));
	};
	const close = () => { onactivechange(null); };
	const selectSlide = (index: number) => { onselect(index); close(); };
	const actionLabels = {
		slides: t('pptx.sections.slides'),
		insert: t('pptx.mobileBar.insert'),
		inspector: t('pptx.field.format'),
		comments: t('pptx.toolbar.comments'),
		notes: t('pptx.notes.title'),
	} as const;
	const actionIcons = { slides: '▣', insert: '+', inspector: '◇', comments: '▢', notes: '▤' } as const;
	const actions = $derived.by(() =>
		buildBarActions({ slideCount: slides.length }).map((action) => ({
			...action,
			key: action.key as Exclude<MobileSheetKey, null>,
			label: actionLabels[action.key as keyof typeof actionLabels],
			icon: actionIcons[action.key as keyof typeof actionIcons],
		})),
	);
</script>

<div class="pptx-svelte-mobile-actions">
	{#if active === 'slides'}
		<MobileSheet title={t('pptx.sections.slides')} onclose={close}>
			<ThumbnailRail {slides} {canvasSize} {mediaDataUrls} {current} onselect={selectSlide} />
		</MobileSheet>
	{:else if active === 'insert'}
		<MobileSheet title={t('pptx.mobileBar.insert')} onclose={close}><InsertMenu {editor} /></MobileSheet>
	{:else if active === 'inspector'}
		<MobileSheet title={t('pptx.field.format')} onclose={close}><InspectorPanel {editor} {handler} {presentationTheme} {onthemechange} /></MobileSheet>
	{:else if active === 'comments'}
		<MobileSheet title={t('pptx.toolbar.comments')} onclose={close}><ReviewCommentsPanel {editor} /></MobileSheet>
	{:else if active === 'menu'}
		<MobileSheet title={t('pptx.mobileToolbar.menu')} onclose={close}>
			<div class="pptx-svelte-mobile-menu-grid">
				<button type="button" onclick={() => open('insert')}>{t('pptx.ribbon.insert')}</button>
				<button type="button" onclick={onzoomout}>{t('pptx.statusBar.zoomOut')}</button>
				<button type="button" onclick={onzoomfit}>{t('pptx.statusBar.zoomToFit')}</button>
				<button type="button" onclick={onzoomin}>{t('pptx.statusBar.zoomIn')}</button>
			</div>
		</MobileSheet>
	{/if}
	<nav aria-label={t('pptx.mobileBar.ariaLabel')}>
		{#each actions as action}
			<button
				type="button"
				class:active={active === action.key}
				aria-pressed={active === action.key}
				aria-label={action.key === 'notes' ? t('pptx.statusBar.toggleNotes') : undefined}
				disabled={action.disabled}
				onclick={() => {
					if (action.key === 'insert') {
						editor.insertElement(newTextElement());
						onactivechange(null);
					} else {
						open(action.key);
					}
				}}
			>
				<span aria-hidden="true">{action.icon}</span><small>{action.label}</small>
			</button>
		{/each}
	</nav>
</div>

<style>
	.pptx-svelte-mobile-actions { display: none; }
	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		.pptx-svelte-mobile-actions { display: contents; }
		.pptx-svelte-mobile-actions nav { position: absolute; z-index: 50; right: 0; bottom: 0; left: 0; display: flex; min-height: 64px; padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid var(--pptx-border, #33334d); background: color-mix(in srgb, var(--pptx-card, #1e1e2e) 94%, transparent); }
		.pptx-svelte-mobile-actions nav button { display: grid; flex: 1; place-items: center; align-content: center; gap: 1px; min-width: 44px; border: 0; background: transparent; color: var(--pptx-muted-foreground, #94a3b8); touch-action: manipulation; }
		.pptx-svelte-mobile-actions nav button:focus-visible, .pptx-svelte-mobile-menu-grid button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: -2px; }
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
