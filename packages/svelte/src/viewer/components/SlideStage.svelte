<script lang="ts">
	/**
	 * SlideStage: the fixed-size slide surface (resolved background +
	 * absolutely-positioned elements) rendered at a given `scale` (Svelte port
	 * of Vue's `SlideStage`). Reused at full size by the main canvas and at
	 * tiny scale by the thumbnail rail; it owns no chrome, the host decides
	 * layout.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		applyRenderedElementAccessibility,
		deriveSlideFieldContext,
		getSlideBackgroundStyle,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { getFieldContextGetter, provideFieldContext } from '../state/field-context';
	import { styleToString } from '../style';
	import ElementRenderer from './ElementRenderer.svelte';
	import type { SlideStageProps } from './props';

	const {
		slide,
		canvasSize,
		mediaDataUrls,
		scale = 1,
		presenting = false,
		interactive = false,
		editTemplateMode = false,
		transparentBackground = false,
		ontablecellcommit,
		onsmartartnodecommit,
		onsmartartnodefill,
	}: SlideStageProps = $props();

	const t = useTranslator();

	// Re-point the deck-wide field context at THIS stage's slide before the
	// element renderers read it: the date / header / footer / document-property
	// fields are presentation-wide, but the slide number and title are not, so a
	// thumbnail or presenter preview must resolve them from the slide it paints
	// rather than the active one. Both calls must happen at init (Svelte context
	// is captured once), hence the getter closure over the reactive `slide` prop.
	const getDeckFieldContext = getFieldContextGetter();
	provideFieldContext(() => deriveSlideFieldContext(getDeckFieldContext?.(), slide));

	const stageStyle = $derived(
		styleToString({
			width: `${canvasSize.width}px`,
			height: `${canvasSize.height}px`,
			transform: `scale(${scale})`,
			transformOrigin: 'top left',
			position: 'relative',
			overflow: 'hidden',
			// Resolved slide background: image -> gradient -> pattern -> solid.
			// A stage stacked over another one opts out entirely and stays
			// see-through, so it cannot hide what it is animating over.
			...(transparentBackground
				? { background: 'none', backgroundColor: 'transparent' }
				: getSlideBackgroundStyle(slide)),
		}),
	);

	function accessibleStage(node: HTMLElement, elements: readonly PptxElement[]) {
		function apply(): void {
			queueMicrotask(() => applyRenderedElementAccessibility(node, elements));
		}
		apply();
		return {
			update(next: readonly PptxElement[]): void {
				elements = next;
				apply();
			},
		};
	}
</script>

<!-- Non-interactive stages (thumbnail rail, presenter previews) get no
     role/label but are NOT aria-hidden: they can contain real interactive
     controls (e.g. the OLE Download/Open action bar), and hiding a subtree
     with focusable controls is an accessibility violation that also removed
     those controls from the accessibility tree. Matches the other bindings,
     which only withhold the region role from thumbnail stages. -->
<div
	class="pptx-svelte-stage"
	use:accessibleStage={slide?.elements ?? []}
	style={stageStyle}
	role={interactive ? 'region' : undefined}
	aria-roledescription={interactive ? 'slide' : undefined}
	aria-label={interactive ? t('pptx.canvas.slide') : undefined}
>
	{#each slide?.elements ?? [] as element, index (element.id)}
		<ElementRenderer {element} {mediaDataUrls} zIndex={index} {presenting} {interactive} {editTemplateMode} {ontablecellcommit} {onsmartartnodecommit} {onsmartartnodefill} />
	{/each}
</div>
