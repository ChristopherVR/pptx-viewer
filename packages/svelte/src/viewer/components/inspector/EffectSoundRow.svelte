<script lang="ts">
	/**
	 * EffectSoundRow: the animation panel's effect sound row (`p:stSnd`),
	 * Svelte port of React's `inspector/EffectSoundRow.tsx`. "No Sound" or a
	 * custom audio file picked from disk; picking a file stages it as a
	 * pending `data:` URL that the core save pipeline embeds and mints a
	 * relationship for.
	 */
	import type { EffectSoundState } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		soundState,
		canEdit,
		onpick,
	}: {
		soundState: EffectSoundState;
		canEdit: boolean;
		/** `undefined` clears the sound ("No Sound"); otherwise a freshly-picked file. */
		onpick: (pick: { dataUrl: string; fileName?: string } | undefined) => void;
	} = $props();

	const t = useTranslator();

	let fileInput: HTMLInputElement | undefined = $state();

	function onSelectChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		if (event.currentTarget.value === 'custom') {
			fileInput?.click();
			return;
		}
		onpick(undefined);
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
</script>

<label class="pptx-svelte-effect-sound-row">
	<span>{t('pptx.animation.sound')}</span>
	<select
		aria-label={t('pptx.animation.sound')}
		class="pptx-svelte-animp-sound"
		disabled={!canEdit}
		value={soundState.hasSound ? 'custom' : 'none'}
		onchange={onSelectChange}
	>
		<option value="none">{t('pptx.animation.sound.none')}</option>
		<option value="custom">
			{soundState.hasSound && soundState.fileName ? soundState.fileName : t('pptx.animation.sound.custom')}
		</option>
	</select>
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

	.pptx-svelte-effect-sound-file-input {
		display: none;
	}
</style>
