<script lang="ts">
	/**
	 * PasteOptionsToolbar: the small icon-strip PowerPoint anchors to the
	 * bottom-right corner of a just-pasted element, offering the same four
	 * formats as the Paste Special dialog as a one-click follow-up. Dismissed
	 * by any subsequent pointerdown or keydown, same as the element context
	 * menu. A thin adapter around the shared `pptx-ui-paste-options`: this
	 * measures the pasted element and the element renders, positions and
	 * dismisses the strip.
	 */
	import type { PasteOptionsRequestEvent, PasteOptionsViewState, PasteSpecialFormat } from 'pptx-viewer-shared';
	import { findCanvasElementNode } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';

	const { elementId, onchoose, ondismiss }: {
		elementId: string | null;
		onchoose: (format: PasteSpecialFormat) => void;
		ondismiss: () => void;
	} = $props();
	const t = useTranslator();

	let rect = $state<{ left: number; top: number } | null>(null);

	$effect(() => {
		const id = elementId;
		rect = null;
		if (!id) {
			return;
		}
		// One frame for the pasted element to mount before measuring it.
		const frame = requestAnimationFrame(() => {
			const box = findCanvasElementNode(document, id, { canvasOnly: true })?.getBoundingClientRect();
			rect = box ? { left: box.right, top: box.bottom } : null;
		});
		return () => cancelAnimationFrame(frame);
	});

	const view = $derived<PasteOptionsViewState>({
		left: rect?.left ?? 0,
		top: rect?.top ?? 0,
		translate: t,
	});
</script>

{#if elementId && rect}
	<pptx-ui-paste-options
		state={view}
		onpaste-options-request={(event: PasteOptionsRequestEvent) => onchoose(event.detail.format)}
		onpaste-options-dismiss={() => ondismiss()}
	></pptx-ui-paste-options>
{/if}
