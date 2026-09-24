<script lang="ts">
	/**
	 * PasteOptionsToolbar: the small icon-strip PowerPoint anchors to the
	 * bottom-right corner of a just-pasted element, offering the same four
	 * formats as the Paste Special dialog as a one-click follow-up. Dismissed
	 * by any subsequent pointerdown or keydown, same as the element context
	 * menu.
	 */
	import type { PasteSpecialFormat } from 'pptx-viewer-shared';
	import { PASTE_SPECIAL_OPTIONS } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';

	const { elementId, onchoose, ondismiss }: {
		elementId: string | null;
		onchoose: (format: PasteSpecialFormat) => void;
		ondismiss: () => void;
	} = $props();
	const t = useTranslator();

	let rect = $state<{ left: number; top: number } | null>(null);

	function onOutsideEvent(): void {
		ondismiss();
	}

	$effect(() => {
		const id = elementId;
		if (!id) {
			rect = null;
			return;
		}
		let removeListeners: (() => void) | undefined;
		const frame = requestAnimationFrame(() => {
			const node = document.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
			if (!node) {
				rect = null;
				return;
			}
			const box = node.getBoundingClientRect();
			rect = { left: box.right, top: box.bottom };
			// Deferred so the paste action's OWN pointerdown/keydown does not
			// immediately dismiss the toolbar it just opened.
			const timer = window.setTimeout(() => {
				window.addEventListener('pointerdown', onOutsideEvent, true);
				window.addEventListener('keydown', onOutsideEvent, true);
			}, 0);
			removeListeners = () => {
				window.clearTimeout(timer);
				window.removeEventListener('pointerdown', onOutsideEvent, true);
				window.removeEventListener('keydown', onOutsideEvent, true);
			};
		});
		return () => {
			cancelAnimationFrame(frame);
			removeListeners?.();
		};
	});
</script>

{#if elementId && rect}
	<div
		role="toolbar"
		tabindex="-1"
		aria-label={t('pptx.pasteSpecial.optionsLabel')}
		data-pptx-paste-options
		style="position: fixed; left: {rect.left + 4}px; top: {rect.top + 4}px;"
		onmousedown={(e) => e.stopPropagation()}
	>
		{#each PASTE_SPECIAL_OPTIONS as option (option.id)}
			<button type="button" title={t(option.labelKey)} onclick={() => onchoose(option.id)}>
				{t(option.labelKey)}
			</button>
		{/each}
	</div>
{/if}

<style>
	div { z-index: 1100; display: flex; align-items: center; gap: 2px; padding: 4px; border: 1px solid var(--pptx-border, #3f3f52); border-radius: 6px; background: var(--pptx-card, #1e1e2e); box-shadow: 0 10px 25px #0009; }
	button { border: none; border-radius: 4px; padding: 4px 8px; background: transparent; color: inherit; font-size: 11px; white-space: nowrap; }
	button:hover { background: var(--pptx-muted, #2a2a3d); }
</style>
