<script lang="ts">
	import type { SheetPointerEventLike } from 'pptx-viewer-shared';
	import { createSheetDismissGesture } from 'pptx-viewer-shared';

	const { title, onclose, children }: {
		title: string;
		onclose: () => void;
		children: import('svelte').Snippet;
	} = $props();

	let dragY = $state(0);
	let dragging = $state(false);
	const gesture = createSheetDismissGesture(
		(offset, active) => {
			dragY = offset;
			dragging = active;
		},
		() => onclose(),
	);
	const pointer = (event: PointerEvent): SheetPointerEventLike => ({
		clientY: event.clientY,
		pointerId: event.pointerId,
		currentTarget: event.currentTarget as HTMLElement,
	});
</script>

<div class="pptx-svelte-mobile-sheet-host" role="dialog" aria-modal="true" aria-label={title}>
	<button type="button" class="pptx-svelte-mobile-sheet-backdrop" aria-label="Close" onclick={onclose}></button>
	<section class="pptx-svelte-mobile-sheet" style:transform={dragY > 0 ? `translateY(${dragY}px)` : undefined} style:transition={dragging ? 'none' : undefined}>
		<header
			role="button"
			tabindex="0"
			aria-label={`Swipe down to close ${title}`}
			onpointerdown={(event) => gesture.pointerDown(pointer(event))}
			onpointermove={(event) => gesture.pointerMove(pointer(event))}
			onpointerup={(event) => gesture.pointerUp(pointer(event))}
			onpointercancel={(event) => gesture.cancel(pointer(event))}
		>
			<span class="pptx-svelte-mobile-sheet-handle" aria-hidden="true"></span>
			<strong>{title}</strong>
		</header>
		<div class="pptx-svelte-mobile-sheet-body">{@render children()}</div>
	</section>
</div>

<style>
	.pptx-svelte-mobile-sheet-host { position: absolute; z-index: 48; inset: 0 0 64px; display: flex; align-items: end; }
	.pptx-svelte-mobile-sheet-backdrop { position: absolute; inset: 0; width: 100%; border: 0; background: rgb(0 0 0 / 40%); }
	.pptx-svelte-mobile-sheet { position: relative; display: flex; flex-direction: column; width: 100%; max-height: min(70dvh, 620px); border: 1px solid var(--pptx-border, #33334d); border-bottom: 0; border-radius: 16px 16px 0 0; background: var(--pptx-background, #11111b); box-shadow: 0 -12px 36px rgb(0 0 0 / 35%); color: var(--pptx-foreground, #e2e8f0); transition: transform 150ms ease-out; }
	.pptx-svelte-mobile-sheet header { display: grid; justify-items: center; gap: 5px; padding: 8px 16px 10px; border-bottom: 1px solid var(--pptx-border, #33334d); cursor: grab; touch-action: none; }
	.pptx-svelte-mobile-sheet-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--pptx-muted-foreground, #94a3b8); opacity: .45; }
	.pptx-svelte-mobile-sheet-body { overflow: auto; padding: 12px; overscroll-behavior: contain; }
</style>
