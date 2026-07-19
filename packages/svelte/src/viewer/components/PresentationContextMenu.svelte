<script lang="ts">
	/**
	 * The slide-show right-click menu, shown while presenting when Options >
	 * Advanced > "Show menu on right mouse click" is on: Previous / Next /
	 * End Show, PowerPoint style.
	 */
	import { useTranslator } from '../../i18n/context';

	const {
		x,
		y,
		onprev,
		onnext,
		onend,
		onclose,
	}: {
		x: number;
		y: number;
		onprev: () => void;
		onnext: () => void;
		onend: () => void;
		onclose: () => void;
	} = $props();
	const t = useTranslator();

	function run(action: () => void): void {
		action();
		onclose();
	}
</script>

<button class="scrim" type="button" aria-label={t('pptx.settings.close')} onclick={onclose} oncontextmenu={(event) => { event.preventDefault(); onclose(); }}></button>
<div class="menu" role="menu" style={`left:${x}px;top:${y}px`}>
	<button type="button" role="menuitem" onclick={() => run(onprev)}>{t('pptx.presenter.previousSlide')}</button>
	<button type="button" role="menuitem" onclick={() => run(onnext)}>{t('pptx.presenter.nextSlide')}</button>
	<hr />
	<button type="button" role="menuitem" onclick={() => run(onend)}>{t('pptx.presenter.endPresentation')}</button>
</div>

<style>
	.scrim { position: fixed; inset: 0; z-index: 95; border: 0; background: transparent; }
	.menu { position: fixed; z-index: 96; display: flex; min-width: 168px; flex-direction: column; border: 1px solid var(--pptx-border, #3f3f52); border-radius: 7px; background: var(--pptx-popover, #1e1e2e); box-shadow: 0 14px 28px #0008; padding: 4px; }
	.menu button { border: 0; border-radius: 4px; padding: 7px 12px; background: transparent; color: var(--pptx-popover-foreground, #e2e8f0); font: 12px system-ui, sans-serif; text-align: left; cursor: pointer; }
	.menu button:hover { background: var(--pptx-accent, #33334d); }
	hr { margin: 3px 4px; border: 0; border-top: 1px solid var(--pptx-border, #3f3f52); }
</style>
