<script lang="ts">
	/**
	 * The slide-show right-click menu, shown while presenting when Options >
	 * Advanced > "Show menu on right mouse click" is on.
	 *
	 * Item order/grouping/i18n keys come from the shared
	 * `getPresentationContextMenuSections` (`pptx-viewer-shared`), the same
	 * source React's `PresentationContextMenu` and Vue's `PresentationMode`
	 * render from, so this menu cannot drift from theirs. The caller passes
	 * which capabilities are available (this binding has all of them) and a
	 * single `onaction` dispatch; it decides what each id does.
	 */
	import { getPresentationContextMenuSections } from 'pptx-viewer-shared';
	import type {
		PresentationContextMenuActionId,
		PresentationContextMenuCapabilities,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		x,
		y,
		capabilities,
		onaction,
		onclose,
	}: {
		x: number;
		y: number;
		capabilities: PresentationContextMenuCapabilities;
		onaction: (id: PresentationContextMenuActionId) => void;
		onclose: () => void;
	} = $props();
	const t = useTranslator();

	const sections = $derived(getPresentationContextMenuSections(capabilities));

	function run(id: PresentationContextMenuActionId): void {
		onaction(id);
		onclose();
	}
</script>

<button class="scrim" type="button" aria-label={t('pptx.settings.close')} onclick={onclose} oncontextmenu={(event) => { event.preventDefault(); onclose(); }}></button>
<div class="menu" role="menu" tabindex="-1" data-pptx-presentation-menu style={`left:${x}px;top:${y}px`} oncontextmenu={(event) => event.preventDefault()}>
	{#each sections as section, sectionIndex (section.id)}
		{#if sectionIndex > 0}<hr />{/if}
		{#each section.items as item (item.id)}
			<button type="button" role="menuitem" data-item-id={item.id} onclick={() => run(item.id)}>{t(item.labelKey)}</button>
		{/each}
	{/each}
</div>

<style>
	.scrim { position: fixed; inset: 0; z-index: 95; border: 0; background: transparent; }
	.menu { position: fixed; z-index: 96; display: flex; min-width: 168px; flex-direction: column; border: 1px solid var(--pptx-border, #3f3f52); border-radius: 7px; background: var(--pptx-popover, #1e1e2e); box-shadow: 0 14px 28px #0008; padding: 4px; }
	.menu button { border: 0; border-radius: 4px; padding: 7px 12px; background: transparent; color: var(--pptx-popover-foreground, #e2e8f0); font: 12px system-ui, sans-serif; text-align: left; cursor: pointer; }
	.menu button:hover { background: var(--pptx-accent, #33334d); }
	hr { margin: 3px 4px; border: 0; border-top: 1px solid var(--pptx-border, #3f3f52); }
</style>
