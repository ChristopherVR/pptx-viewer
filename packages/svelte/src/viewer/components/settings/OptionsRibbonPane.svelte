<script lang="ts">
	/**
	 * Options > Customize Ribbon: PowerPoint's "Main Tabs" checkbox tree over
	 * the shared `TOOLBAR_TABS` registry (the File tab can never be hidden),
	 * plus the keyboard-shortcut reference PowerPoint keeps behind "Keyboard
	 * shortcuts: Customize".
	 */
	import type { ToolbarTabId, ViewerOptions } from 'pptx-viewer-shared';
	import { SHORTCUT_REFERENCE_ITEMS, TOOLBAR_TABS } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';

	const {
		options,
		ontabhiddenchange,
		onreset,
	}: {
		options: ViewerOptions;
		ontabhiddenchange: (tabId: ToolbarTabId, hidden: boolean) => void;
		onreset: () => void;
	} = $props();
	const t = useTranslator();
	const hidden = $derived(new Set(options.ribbon.hiddenTabIds));
</script>

<div class="ribbon-pane">
	<section>
		<h3>{t('pptx.options.ribbon.tabsTitle')}</h3>
		<p class="hint">{t('pptx.options.ribbon.tabsDescription')}</p>
		<div class="tabs">
			{#each TOOLBAR_TABS as tab (tab.id)}
				{@const isFile = tab.id === 'file'}
				<label class:locked={isFile}>
					<input
						type="checkbox"
						checked={isFile || !hidden.has(tab.id)}
						disabled={isFile}
						onchange={(event) => ontabhiddenchange(tab.id, !event.currentTarget.checked)}
					/>
					<span>{t(tab.labelKey)}</span>
				</label>
			{/each}
		</div>
		<button type="button" class="reset" onclick={onreset}>{t('pptx.options.ribbon.reset')}</button>
	</section>
	<section>
		<h3>{t('pptx.settings.keyboardShortcuts')}</h3>
		{#each SHORTCUT_REFERENCE_ITEMS as shortcut, index (shortcut.actionKey)}
			<p class="shortcut" class:stripe={index % 2 === 0}>
				<span>{t(shortcut.actionKey)}</span>
				<kbd>{shortcut.shortcut}</kbd>
			</p>
		{/each}
	</section>
</div>

<style>
	.ribbon-pane { display: flex; flex-direction: column; gap: 18px; }
	h3 { margin: 0 0 4px; border-bottom: 1px solid color-mix(in srgb, var(--pptx-border, #3f3f52) 60%, transparent); padding-bottom: 4px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
	.hint { margin: 0 0 8px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 11px; }
	.tabs { display: flex; flex-direction: column; gap: 2px; border: 1px solid color-mix(in srgb, var(--pptx-border, #3f3f52) 60%, transparent); border-radius: 6px; padding: 6px; }
	.tabs label { display: flex; align-items: center; gap: 8px; border-radius: 4px; padding: 5px 8px; font-size: 12px; cursor: pointer; }
	.tabs label:hover { background: var(--pptx-accent, #33334d); }
	.tabs label.locked { opacity: 0.6; cursor: not-allowed; }
	.tabs label.locked:hover { background: transparent; }
	.tabs input { width: 15px; height: 15px; accent-color: var(--pptx-primary, #6366f1); }
	.reset { margin-top: 8px; border: 1px solid var(--pptx-border, #3f3f52); border-radius: 5px; padding: 6px 11px; background: transparent; color: var(--pptx-foreground, #e2e8f0); font-size: 11px; cursor: pointer; }
	.reset:hover { background: var(--pptx-accent, #33334d); }
	.shortcut { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0; border-radius: 5px; padding: 7px 10px; font-size: 12px; }
	.stripe { background: var(--pptx-muted, #2a2a3d); }
	kbd { color: var(--pptx-muted-foreground, #94a3b8); font: 11px ui-monospace, monospace; white-space: nowrap; }
</style>
