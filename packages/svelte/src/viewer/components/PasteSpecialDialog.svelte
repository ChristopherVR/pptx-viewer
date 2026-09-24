<script lang="ts">
	/**
	 * PasteSpecialDialog: Ctrl/Cmd+Alt+V. Offers the four Paste Special formats
	 * PowerPoint's own dialog offers (Keep Source Formatting, Use Destination
	 * Theme, Picture, Keep Text Only), sourced from `pptx-viewer-shared` so the
	 * option set and its labels cannot drift from the post-paste "Paste
	 * Options" toolbar or the other four bindings.
	 */
	import type { PasteSpecialFormat } from 'pptx-viewer-shared';
	import { PASTE_SPECIAL_OPTIONS } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';

	const { oncancel, onconfirm }: { oncancel: () => void; onconfirm: (format: PasteSpecialFormat) => void } =
		$props();
	const t = useTranslator();
	let selected = $state<PasteSpecialFormat>('keep-source-formatting');
</script>

<div class="backdrop">
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<section role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="paste-special-title" data-pptx-paste-special-dialog>
		<h2 id="paste-special-title">{t('pptx.pasteSpecial.dialogTitle')}</h2>
		<ul>
			{#each PASTE_SPECIAL_OPTIONS as option (option.id)}
				<li>
					<label>
						<input type="radio" name="paste-special-format" value={option.id} bind:group={selected} />
						{t(option.labelKey)}
					</label>
				</li>
			{/each}
		</ul>
		<footer>
			<button type="button" onclick={oncancel}>{t('pptx.common.cancel')}</button>
			<button class="primary" type="button" onclick={() => onconfirm(selected)}>{t('pptx.common.ok')}</button>
		</footer>
	</section>
</div>

<style>
	.backdrop { position: fixed; inset: 0; z-index: 1250; display: grid; place-items: center; background: #0009; }
	section { width: min(360px, calc(100vw - 32px)); padding: 20px; border: 1px solid var(--pptx-border, #3f3f52); border-radius: 12px; background: var(--pptx-card, #1e1e2e); box-shadow: 0 24px 80px #0009; }
	h2 { margin: 0 0 12px; font-size: 15px; }
	ul { margin: 0 0 16px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
	label { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; font-size: 13px; cursor: pointer; }
	label:hover { background: var(--pptx-muted, #2a2a3d); }
	footer { display: flex; justify-content: flex-end; gap: 8px; }
	button { border: 1px solid var(--pptx-border, #3f3f52); border-radius: 6px; padding: 8px 14px; background: var(--pptx-muted, #2a2a3d); color: inherit; font-size: 13px; }
	.primary { background: var(--pptx-primary, #c43b32); color: #fff; border-color: var(--pptx-primary, #c43b32); }
</style>
