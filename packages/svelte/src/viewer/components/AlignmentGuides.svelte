<script lang="ts">
	/**
	 * AlignmentGuides: draggable horizontal/vertical alignment guides (View >
	 * H/V Guides). Svelte port of Vue's `CanvasGuides.vue` / React's
	 * `CanvasGuides` (`CanvasOverlays.tsx`).
	 *
	 * Rendered inside the scaled slide stage, so guide `position`s are authored
	 * slide pixels; the parent's `transform: scale()` handles zoom. Move/delete
	 * are addressed by the guide's stable `id` (shared's `moveGuide`/
	 * `removeGuide` semantics), not by array index: an index went stale the
	 * moment a guide was removed or the array was re-sorted, silently
	 * retargeting whichever drag/delete followed onto the wrong guide.
	 * Previously Svelte imported neither helper and had no delete at all.
	 *
	 * Double-click removes a guide, matching every other binding. The Delete /
	 * Backspace key also removes the FOCUSED guide (it is a `<button>`, so Tab
	 * reaches it): the other bindings only wire the mouse gesture, but a guide
	 * with no keyboard-reachable delete was a real accessibility gap, not scope
	 * creep, so it stays here for Svelte too.
	 */
	import type { Guide } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		guides,
		scale,
		onchange,
		ondelete,
	}: {
		guides: readonly Guide[];
		scale: number;
		onchange: (id: string, position: number) => void;
		ondelete?: (id: string) => void;
	} = $props();

	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let active = $state<{ id: string; axis: 'h' | 'v' } | null>(null);
	// eslint-disable-next-line prefer-const
	let holder = $state<HTMLDivElement>();

	function move(event: PointerEvent): void {
		if (!active) {
			return;
		}
		const rect = holder?.parentElement?.getBoundingClientRect();
		if (!rect) {
			return;
		}
		const raw = active.axis === 'v' ? event.clientX - rect.left : event.clientY - rect.top;
		onchange(active.id, Math.max(0, raw / scale));
	}

	function startDrag(event: PointerEvent, guide: Guide): void {
		event.stopPropagation();
		active = { id: guide.id, axis: guide.axis };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function endDrag(event: PointerEvent): void {
		if (!active) {
			return;
		}
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {
			// Capture may already be released; ignore.
		}
		active = null;
	}

	function removeGuide(event: Event, id: string): void {
		event.stopPropagation();
		ondelete?.(id);
	}

	function onKeydown(event: KeyboardEvent, id: string): void {
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.stopPropagation();
			event.preventDefault();
			ondelete?.(id);
		}
	}
</script>

<svelte:window onpointerup={() => (active = null)} />
<div class="guides" bind:this={holder} aria-label={t('pptx.guides.dragHint')}>
	{#each guides as guide (guide.id)}
		<button
			type="button"
			class:vertical={guide.axis === 'v'}
			class:horizontal={guide.axis === 'h'}
			aria-label={`${guide.axis === 'v' ? 'Vertical' : 'Horizontal'} guide ${Math.round(guide.position)}`}
			title={t('pptx.guides.dragHint')}
			data-testid="pptx-alignment-guide"
			data-guide-id={guide.id}
			style={guide.axis === 'v' ? `left:${guide.position * scale}px` : `top:${guide.position * scale}px`}
			data-pptx-compact
			onpointerdown={(event) => startDrag(event, guide)}
			onpointermove={move}
			onpointerup={endDrag}
			ondblclick={(event) => removeGuide(event, guide.id)}
			onkeydown={(event) => onKeydown(event, guide.id)}
		></button>
	{/each}
</div>

<style>
	.guides {
		position: absolute;
		inset: 0;
		z-index: 25;
		pointer-events: none;
	}
	.guides button {
		position: absolute;
		margin: 0;
		padding: 0;
		border: 0;
		background: #06b6d4;
		pointer-events: auto;
	}
	.vertical {
		top: 0;
		bottom: 0;
		width: 2px;
		cursor: ew-resize;
	}
	.horizontal {
		left: 0;
		right: 0;
		height: 2px;
		cursor: ns-resize;
	}
</style>
