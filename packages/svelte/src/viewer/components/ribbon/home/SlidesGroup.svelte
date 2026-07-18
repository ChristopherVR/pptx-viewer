<script lang="ts">
	/**
	 * SlidesGroup: the Home tab's Slides group, mirroring React's
	 * `SlidesGroup.tsx` layout and labels: a "New Slide" split button, a
	 * "Layout" dropdown (re-map the current slide onto another layout), a
	 * "Reset" button (re-apply the slide's own layout), and "Section". Every op
	 * is history-integrated through `EditorState.slidesOps`; slide-mutating ops
	 * return the new active index so the caller can navigate the viewer to it.
	 *
	 * React keeps Duplicate/Delete out of this group (they live in the thumbnail
	 * context menu). This binding has no such menu, so those two ops are
	 * re-housed into the New Slide split button's dropdown rather than dropped.
	 */
	import type { PptxLayoutOption } from 'pptx-viewer-core';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup } from '../anchored-popup';

	const { editor, onnavigate }: { editor: EditorState; onnavigate: (index: number) => void } =
		$props();
	const t = useTranslator();

	let openMenu = $state<'new' | 'layout' | null>(null);
	let layouts = $state<PptxLayoutOption[]>([]);
	// eslint-disable-next-line prefer-const
	let newSplitEl: HTMLElement | undefined = $state();
	// eslint-disable-next-line prefer-const
	let layoutSplitEl: HTMLElement | undefined = $state();

	function run(action: () => number | null): void {
		const index = action();
		if (index !== null) {
			onnavigate(index);
		}
		openMenu = null;
	}

	async function runAsync(action: () => Promise<number | null>): Promise<void> {
		const index = await action();
		if (index !== null) {
			onnavigate(index);
		}
		openMenu = null;
	}

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			openMenu = null;
		}
	}

	async function toggleLayoutMenu(): Promise<void> {
		if (openMenu === 'layout') {
			openMenu = null;
			return;
		}
		layouts = await editor.slidesOps.availableLayouts();
		openMenu = 'layout';
	}
</script>

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.ribbon.slides')}>
	<div class="pptx-svelte-rgroup-row">
		<!-- New Slide split button: primary inserts a blank slide; the chevron
		     dropdown re-houses Duplicate / Delete (no thumbnail context menu). -->
		<div class="pptx-svelte-rgroup-split" bind:this={newSplitEl} onfocusout={onFocusOut}>
			<button
				type="button"
				class="pptx-svelte-rgroup-main"
				disabled={!editor.editable}
				aria-label={t('pptx.home.newSlide')}
				title={t('pptx.home.newSlide')}
				onclick={() => run(() => editor.slidesOps.insertSlideAfterCurrent())}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="9" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M11 6h2.5M12.25 4.75v2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
				<span>{t('pptx.home.newSlide')}</span>
			</button>
			<button
				type="button"
				class="pptx-svelte-rgroup-caret"
				disabled={!editor.editable}
				aria-haspopup="menu"
				aria-expanded={openMenu === 'new'}
				aria-label={t('pptx.ribbon.duplicateSlide')}
				title={t('pptx.ribbon.duplicateSlide')}
				onclick={() => (openMenu = openMenu === 'new' ? null : 'new')}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
			{#if openMenu === 'new'}
				<div class="pptx-svelte-rgroup-pop" role="menu" use:anchoredPopup={{ anchor: newSplitEl }}>
					<button type="button" role="menuitem" onclick={() => run(() => editor.slidesOps.duplicateCurrentSlide())}>{t('pptx.ribbon.duplicateSlide')}</button>
					<button type="button" role="menuitem" class="pptx-svelte-rgroup-pop-danger" onclick={() => run(() => editor.slidesOps.deleteCurrentSlide())}>{t('pptx.arrange.delete')}</button>
				</div>
			{/if}
		</div>

		<!-- Layout dropdown: re-map the current slide onto another layout. -->
		<div class="pptx-svelte-rgroup-split" bind:this={layoutSplitEl} onfocusout={onFocusOut}>
			<button
				type="button"
				class="pptx-svelte-rgroup-main"
				disabled={!editor.editable}
				aria-haspopup="menu"
				aria-expanded={openMenu === 'layout'}
				aria-label={t('pptx.master.layout')}
				title={t('pptx.master.layout')}
				onclick={() => void toggleLayoutMenu()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M2.5 6.5h11M6.5 6.5v7" stroke="currentColor" stroke-width="1.2" /></svg>
				<span>{t('pptx.master.layout')}</span>
			</button>
			{#if openMenu === 'layout'}
				<div class="pptx-svelte-rgroup-pop" role="menu" use:anchoredPopup={{ anchor: layoutSplitEl }}>
					{#if layouts.length === 0}
						<span class="pptx-svelte-rgroup-pop-empty">{t('pptx.statusBar.noSlides')}</span>
					{:else}
						{#each layouts as layout (layout.path)}
							<button type="button" role="menuitem" onclick={() => void runAsync(() => editor.slidesOps.applyLayout(layout.path))}>{layout.name}</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<button
			type="button"
			class="pptx-svelte-rgroup-main"
			disabled={!editor.editable}
			aria-label={t('pptx.sections.resetSlideTitle')}
			title={t('pptx.sections.resetSlideTitle')}
			onclick={() => void runAsync(() => editor.slidesOps.resetSlide())}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 3v2.4h-2.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
			<span>{t('pptx.animations.reset')}</span>
		</button>

		<button
			type="button"
			class="pptx-svelte-rgroup-main"
			disabled={!editor.editable || editor.slides.length === 0}
			aria-label={t('pptx.sections.addSection')}
			title={t('pptx.sections.addSection')}
			onclick={() => editor.sectionOps.add(t('pptx.sections.defaultName'))}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10M3 8h6M3 13h10M11.5 6v4M9.5 8h4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
			<span>{t('pptx.sections.sectionButtonLabel')}</span>
		</button>
	</div>
	<span class="pptx-svelte-rgroup-label">{t('pptx.ribbon.slides')}</span>
</div>

<style>
	.pptx-svelte-rgroup {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-rgroup-label {
		font-size: 9px;
		color: var(--pptx-muted-foreground, #94a3b8);
		line-height: 1;
	}

	.pptx-svelte-rgroup-row {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-rgroup-split {
		position: relative;
		display: inline-flex;
		align-items: stretch;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		overflow: visible;
	}

	.pptx-svelte-rgroup-main,
	.pptx-svelte-rgroup-caret {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
	}

	.pptx-svelte-rgroup-caret {
		min-width: 18px;
		padding: 0 4px;
		border-left: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 50%, transparent);
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.pptx-svelte-rgroup-main {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}

	.pptx-svelte-rgroup-main:hover:not(:disabled),
	.pptx-svelte-rgroup-caret:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rgroup-main:disabled,
	.pptx-svelte-rgroup-caret:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-rgroup-main svg,
	.pptx-svelte-rgroup-caret svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-rgroup-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		min-width: 168px;
		max-height: 260px;
		overflow-y: auto;
		flex-direction: column;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 4px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-rgroup-pop button {
		display: block;
		width: 100%;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		padding: 6px 10px;
		text-align: left;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.pptx-svelte-rgroup-pop button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rgroup-pop-danger:hover {
		background: #7f1d1d !important;
		color: #fecaca !important;
	}

	.pptx-svelte-rgroup-pop-empty {
		padding: 6px 10px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}
</style>
