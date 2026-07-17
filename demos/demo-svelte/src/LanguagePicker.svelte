<script lang="ts">
	/**
	 * Floating language picker, ported from demos/demo-vue/src/LanguagePicker.vue
	 * and styled to match ThemePicker.svelte.
	 *
	 * Stacked directly above the theme picker (same fixed corner) rather than
	 * beside it, so the two never collide regardless of how wide either button's
	 * label happens to be.
	 */
	import { t } from './demo-i18n.svelte';
	import type { LanguageCode } from './languages';
	import { languages } from './languages';
	import { themes } from './themes';

	const {
		current,
		theme,
		onchange,
	}: { current: LanguageCode; theme: string; onchange: (code: LanguageCode) => void } = $props();

	let open = $state(false);
	const isSmallScreen = $state(typeof window !== 'undefined' && window.innerWidth < 768);

	const preset = $derived(themes[theme] ?? themes.dark);
	const bg = $derived(preset.theme.colors?.card ?? '#111827');
	const border = $derived(preset.theme.colors?.border ?? '#374151');
	const fg = $derived(preset.theme.colors?.mutedForeground ?? '#9ca3af');
	const primary = $derived(preset.theme.colors?.primary ?? '#6366f1');

	const activeLabel = $derived(
		(languages.find((language) => language.code === current) ?? languages[0]).label,
	);

	function pick(code: LanguageCode): void {
		onchange(code);
		open = false;
	}
</script>

<svelte:window onresize={() => (isSmallScreen = window.innerWidth < 768)} />

<div
	class="language-picker"
	class:language-picker--small={isSmallScreen}
	style:z-index={open ? 100000 : 99999}
>
	<button
		type="button"
		class="language-picker__btn"
		title={t('demo.pickers.switchLanguage')}
		style:border={`1px solid ${border}`}
		style:background={bg}
		style:color={fg}
		onclick={() => (open = !open)}
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M2 12h20" />
			<path
				d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"
			/>
		</svg>
		{activeLabel}
	</button>
	{#if open}
		<div class="language-picker__menu" style:background={bg} style:border={`1px solid ${border}`}>
			{#each languages as language (language.code)}
				<button
					type="button"
					class="language-picker__item"
					style:background={language.code === current ? `${primary}22` : 'transparent'}
					style:color={language.code === current ? primary : fg}
					style:font-weight={language.code === current ? 600 : 400}
					onclick={() => pick(language.code)}
				>
					{language.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.language-picker {
		position: fixed;
		bottom: 92px;
		right: 12px;
		z-index: 99999;
		font-family: system-ui, sans-serif;
	}

	.language-picker--small {
		bottom: auto;
		right: 8px;
		top: calc(env(safe-area-inset-top, 0px) + 104px);
	}

	.language-picker__btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 9999px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}

	.language-picker__menu {
		position: absolute;
		bottom: 100%;
		margin-bottom: 4px;
		right: 0;
		border-radius: 8px;
		overflow-y: auto;
		max-height: 60dvh;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		min-width: 150px;
	}

	.language-picker--small .language-picker__menu {
		bottom: auto;
		margin-bottom: 0;
		top: 100%;
		margin-top: 4px;
	}

	.language-picker__item {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 8px 14px;
		border: none;
		cursor: pointer;
		font-size: 13px;
		text-align: left;
	}
</style>
