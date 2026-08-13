<script lang="ts">
	/**
	 * File > Options > General > Fonts. Svelte port of React's
	 * `SettingsCustomFontsSection.tsx`.
	 *
	 * Lets the user hand a local font file to the viewer so a deck authored
	 * with a font the browser lacks renders with the real face instead of a
	 * substitute. Opt-in, and deliberately session-scoped: the file is added to
	 * the page's font set and nothing is uploaded or written into the deck.
	 */
	import { CUSTOM_FONT_ACCEPT, registerCustomFont } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		enabled,
		families,
		onregistered,
	}: {
		/** Mirrors `general.enableCustomFontUpload`; the picker stays inert when off. */
		enabled: boolean;
		/** Families registered so far this session. */
		families: readonly string[];
		onregistered: (family: string) => void;
	} = $props();

	const t = useTranslator();

	let failed = $state(false);
	// eslint-disable-next-line prefer-const
	let fileInput: HTMLInputElement | undefined = $state();

	async function handleFile(file: File): Promise<void> {
		failed = false;
		try {
			const registration = await registerCustomFont(file);
			if (registration) {
				onregistered(registration.family);
			} else {
				// Either the environment has no FontFace support, or the filename
				// reduced to nothing usable once its style tokens were stripped.
				failed = true;
			}
		} catch {
			failed = true;
		}
	}

	function onchange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// Clear the value so re-picking the same file fires change again.
		input.value = '';
		if (file) {
			void handleFile(file);
		}
	}
</script>

<div class="fonts">
	<button type="button" class="ghost" disabled={!enabled} onclick={() => fileInput?.click()}>
		{t('pptx.options.general.addFontFile')}
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept={CUSTOM_FONT_ACCEPT}
		hidden
		{onchange}
	/>

	{#if !enabled}
		<p class="hint">{t('pptx.options.general.customFontsDisabled')}</p>
	{/if}
	{#if failed}
		<p class="hint error" role="alert">{t('pptx.options.general.customFontError')}</p>
	{/if}

	<p class="label">{t('pptx.options.general.customFontsAdded')}</p>
	{#if families.length === 0}
		<p class="hint">{t('pptx.options.general.customFontsEmpty')}</p>
	{:else}
		<ul>
			{#each families as family (family)}
				<li style:font-family={family}>{family}</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.fonts {
		margin-top: 8px;
	}

	.label {
		margin: 12px 0 2px;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.hint {
		margin: 6px 0 0;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.error {
		color: var(--pptx-destructive, #f87171);
	}

	ul {
		margin: 4px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
	}
</style>
