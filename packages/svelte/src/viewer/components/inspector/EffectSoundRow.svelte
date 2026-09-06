<script lang="ts">
	/**
	 * EffectSoundRow: the animation panel's effect sound row, Svelte port of
	 * React's `inspector/EffectSoundRow.tsx`. PowerPoint's own gallery of 19
	 * built-in stock sounds, "No Sound", and "Other Sound..." (a custom audio
	 * file picked from disk), plus a Preview button for the currently-selected
	 * stock sound. Picking a file (or a stock sound) stages it as a pending
	 * `data:` URL that the core save pipeline embeds and mints a relationship
	 * for.
	 */
	import { EFFECT_SOUND_CATALOGUE, getEffectSoundAsset } from 'pptx-viewer-shared';
	import type { EffectSoundState } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import { playAnimationSound } from '../../presentation/animation-sound';

	const NONE_VALUE = 'none';
	const CURRENT_VALUE = 'current';
	const OTHER_VALUE = 'other';

	const {
		soundState,
		canEdit,
		onpick,
		onpickstock,
	}: {
		soundState: EffectSoundState;
		canEdit: boolean;
		/** `undefined` clears the sound ("No Sound"); otherwise a freshly-picked custom file. */
		onpick: (pick: { dataUrl: string; fileName?: string } | undefined) => void;
		/** Picks one of PowerPoint's 19 built-in stock sounds by catalogue id. */
		onpickstock: (catalogueId: string) => void;
	} = $props();

	const t = useTranslator();

	let fileInput: HTMLInputElement | undefined = $state();

	const selectedValue = $derived(soundState.catalogueId ?? (soundState.hasSound ? CURRENT_VALUE : NONE_VALUE));

	function onSelectChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		const value = event.currentTarget.value;
		if (value === OTHER_VALUE) {
			fileInput?.click();
			return;
		}
		if (value === NONE_VALUE) {
			onpick(undefined);
			return;
		}
		if (value === CURRENT_VALUE) {
			return;
		}
		onpickstock(value);
	}

	function onFileChange(event: Event & { currentTarget: HTMLInputElement }): void {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				onpick({ dataUrl: reader.result, fileName: file.name });
			}
		};
		reader.readAsDataURL(file);
	}

	function onPreview(): void {
		if (!soundState.catalogueId) {
			return;
		}
		const asset = getEffectSoundAsset(soundState.catalogueId);
		if (asset) {
			playAnimationSound(asset.dataUrl);
		}
	}
</script>

<label class="pptx-svelte-effect-sound-row">
	<span>{t('pptx.animation.sound')}</span>
	<div class="pptx-svelte-effect-sound-controls">
		<select
			aria-label={t('pptx.animation.sound')}
			class="pptx-svelte-animp-sound"
			disabled={!canEdit}
			value={selectedValue}
			onchange={onSelectChange}
		>
			<option value={NONE_VALUE}>{t('pptx.animation.sound.none')}</option>
			{#if soundState.hasSound && !soundState.catalogueId}
				<option value={CURRENT_VALUE}>
					{soundState.fileName ?? t('pptx.animation.sound.custom')}
				</option>
			{/if}
			{#each EFFECT_SOUND_CATALOGUE as entry (entry.id)}
				<option value={entry.id}>{t(entry.i18nKey)}</option>
			{/each}
			<option value={OTHER_VALUE}>{t('pptx.animation.sound.other')}</option>
		</select>
		<button
			type="button"
			aria-label={t('pptx.animation.sound.preview')}
			class="pptx-svelte-effect-sound-preview"
			disabled={!soundState.catalogueId}
			onclick={onPreview}
		>
			&#9654;
		</button>
	</div>
	<input
		bind:this={fileInput}
		type="file"
		accept="audio/*"
		aria-label={t('pptx.animation.sound.chooseFile')}
		class="pptx-svelte-effect-sound-file-input"
		tabindex="-1"
		onchange={onFileChange}
	/>
</label>

<style>
	.pptx-svelte-effect-sound-row {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-effect-sound-row > span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-effect-sound-controls {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-effect-sound-row select {
		width: 100%;
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		font-size: 11px;
	}

	.pptx-svelte-effect-sound-preview {
		flex-shrink: 0;
		height: 26px;
		width: 26px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font-size: 9px;
	}

	.pptx-svelte-effect-sound-preview:disabled {
		opacity: 0.4;
	}

	.pptx-svelte-effect-sound-file-input {
		display: none;
	}
</style>
