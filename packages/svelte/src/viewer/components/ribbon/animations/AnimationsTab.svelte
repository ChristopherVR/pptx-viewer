<script lang="ts">
	/**
	 * AnimationsTab: the ribbon's Animations tab, a thin adapter over the shared
	 * `pptx-ui-ribbon-animations` view (Preview, the full preset and motion-path
	 * galleries, Advanced Animation and the inert Timing fields).
	 *
	 * Effects are added to the currently selected element through
	 * `EditorState.animationOps`, which writes `PptxSlide.animations` (keyed by
	 * `elementId`), the exact field the presentation-mode click-stepped playback
	 * already reads (see `buildClickGroups` in
	 * `presentation/animation-playback.svelte.ts`). Preview playback, the
	 * inspector lifecycle and this binding's own play-order timeline stay native.
	 */
	import type { PptxAnimationPreset } from 'pptx-viewer-core';
	import type { RibbonAnimationsRequestEvent } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { ChromeUiState } from '../../../state/chrome-ui.svelte';
	import { previewElementAnimation } from './animation-preview-player';
	import AnimationTimeline from './AnimationTimeline.svelte';

	const { editor, chromeUi }: { editor: EditorState; chromeUi?: ChromeUiState } = $props();
	const t = useTranslator();

	const selectedAnimation = $derived(
		editor.slides[editor.currentSlideIndex]?.animations?.find(
			(animation) => animation.elementId === editor.selectedElementId,
		),
	);
	const state = $derived({
		editable: editor.editable,
		hasSelection: Boolean(editor.selectedElementId),
		paneOpen: chromeUi?.inspectorOpen,
		translate: t,
	});

	/** Reveal the inspector's Animation panel, the home of per-effect options. */
	function openAnimationPanel(): void {
		chromeUi?.setInspectorTab('properties');
		if (chromeUi && !chromeUi.inspectorOpen) {
			chromeUi.toggleInspector();
		}
	}

	function request(event: RibbonAnimationsRequestEvent): void {
		const intent = event.detail;
		if (intent.kind === 'add') {
			if (intent.group === 'motionPath') {
				editor.animationOps.applyMotionPath(intent.preset);
			} else {
				editor.animationOps.addAnimation(intent.group, intent.preset as PptxAnimationPreset);
			}
		} else if (intent.value === 'preview') {
			if (selectedAnimation) {
				previewElementAnimation(selectedAnimation);
			}
		} else if (intent.value === 'remove') {
			editor.animationOps.removeAnimation();
		} else {
			openAnimationPanel();
		}
	}
</script>

<div class="pptx-svelte-animationstab" role="group" aria-label={t('pptx.ribbon.tab.animations')}>
	<pptx-ui-ribbon-animations {state} onanimations-request={request}></pptx-ui-ribbon-animations>

	<AnimationTimeline {editor} />
</div>

<style>
	.pptx-svelte-animationstab {
		display: flex;
		align-items: stretch;
		flex-wrap: nowrap;
		gap: 4px;
		max-width: 100%;
		overflow-x: auto;
	}
</style>
