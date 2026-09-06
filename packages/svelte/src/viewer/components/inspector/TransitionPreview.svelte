<script lang="ts">
	/**
	 * TransitionPreview: click-to-play thumbnail of the configured transition,
	 * matching React's `inspector/TransitionPreview.tsx`.
	 *
	 * The two stacked layers ("A" outgoing, "B" incoming) are driven by the same
	 * shared `getSlideTransitionAnimations` resolver that the real presentation
	 * overlay uses, so what the author previews is what plays. `outgoingOnTop`
	 * decides the stacking order; without it, push/cover-family effects preview
	 * upside down relative to the real transition.
	 *
	 * `playKey` is bumped on every click and keys both layers, which forces
	 * Svelte to recreate the nodes so the CSS animation restarts even when the
	 * settings did not change. Keyframes are injected head-level (they are
	 * global rules) by {@link ensurePresentationKeyframes}.
	 */
	import type { PptxSlideTransition } from 'pptx-viewer-core';
	import { getSlideTransitionAnimations } from 'pptx-viewer-shared';
	import { onMount } from 'svelte';

	import { useTranslator } from '../../../i18n/context';
	import { ensurePresentationKeyframes } from '../../presentation/keyframes';

	const { transition }: { transition: PptxSlideTransition } = $props();
	const t = useTranslator();

	let playing = $state(false);
	let playKey = $state(0);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const durationMs = $derived(transition.durationMs ?? 500);
	const animations = $derived(
		getSlideTransitionAnimations(
			transition.type,
			durationMs,
			transition.direction,
			transition.orient,
			transition.spokes,
			transition.pattern,
		),
	);
	// 'none' and 'cut' have nothing to show: React hides the preview entirely.
	const previewable = $derived(transition.type !== 'none' && transition.type !== 'cut');

	onMount(() => {
		ensurePresentationKeyframes();
		return () => clearTimeout(timer);
	});

	function play(): void {
		playing = true;
		playKey += 1;
		clearTimeout(timer);
		timer = setTimeout(() => (playing = false), durationMs + 100);
	}
</script>

{#if previewable}
	<div class="pptx-svelte-transition-preview">
		<span class="pptx-svelte-transition-preview-label">{t('pptx.transition.preview')}</span>
		<button
			type="button"
			class="pptx-svelte-transition-preview-stage"
			title={t('pptx.transition.preview')}
			aria-label={t('pptx.transition.preview')}
			onclick={play}
		>
			{#key playKey}
				<span
					class="pptx-svelte-transition-layer pptx-svelte-transition-incoming"
					style={playing && animations.incoming !== 'none'
						? `animation:${animations.incoming}`
						: undefined}>B</span
				>
				<span
					class="pptx-svelte-transition-layer pptx-svelte-transition-outgoing"
					style={`z-index:${animations.outgoingOnTop ? 2 : 0}${
						playing
							? `;animation:${
									animations.outgoing !== 'none'
										? animations.outgoing
										: `pptx-tr-fade-out ${durationMs}ms ease-in-out forwards`
								}`
							: ''
					}`}>A</span
				>
			{/key}
		</button>
	</div>
{/if}

<style>
	.pptx-svelte-transition-preview {
		display: grid;
		gap: 3px;
	}

	.pptx-svelte-transition-preview-label {
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}

	.pptx-svelte-transition-preview-stage {
		position: relative;
		display: block;
		width: 100%;
		height: 64px;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		cursor: pointer;
	}

	.pptx-svelte-transition-layer {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 9px;
	}

	/* Translucent BACKGROUND, not element opacity: the transition animations
	   drive `opacity` themselves and would fight an inherited value. */
	.pptx-svelte-transition-incoming {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 20%, transparent);
	}

	.pptx-svelte-transition-outgoing {
		background: var(--pptx-card, #1e1e2e);
	}
</style>
