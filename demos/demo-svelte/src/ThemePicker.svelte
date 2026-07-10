<script lang="ts">
	/**
	 * Floating theme picker, ported from demos/demo-vue/src/ThemePicker.vue.
	 *
	 * A fixed-position pill (bottom-right on desktop, top-right under the
	 * safe-area on mobile) opens a menu of every theme. Fixed positioning keeps
	 * it above the viewer's stacking contexts without a teleport.
	 */
	import { t } from './demo-i18n.svelte';
	import { themeKeys, themes } from './themes';

	const { current, onchange }: { current: string; onchange: (key: string) => void } = $props();

	let open = $state(false);
	let isSmallScreen = $state(typeof window !== 'undefined' && window.innerWidth < 768);

	const preset = $derived(themes[current] ?? themes.dark);
	const bg = $derived(preset.theme.colors?.card ?? '#111827');
	const border = $derived(preset.theme.colors?.border ?? '#374151');
	const fg = $derived(preset.theme.colors?.mutedForeground ?? '#9ca3af');
	const primary = $derived(preset.theme.colors?.primary ?? '#6366f1');

	function pick(key: string): void {
		onchange(key);
		open = false;
	}
</script>

<svelte:window onresize={() => (isSmallScreen = window.innerWidth < 768)} />

<div
	class="theme-picker"
	class:theme-picker--small={isSmallScreen}
	style:z-index={open ? 100000 : 99999}
>
	<button
		type="button"
		class="theme-picker__btn"
		title={t('demo.pickers.switchTheme')}
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
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2" />
			<path d="M12 20v2" />
			<path d="m4.93 4.93 1.41 1.41" />
			<path d="m17.66 17.66 1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="m6.34 17.66-1.41 1.41" />
			<path d="m19.07 4.93-1.41 1.41" />
		</svg>
		{preset.label}
	</button>
	{#if open}
		<div class="theme-picker__menu" style:background={bg} style:border={`1px solid ${border}`}>
			{#each themeKeys as key (key)}
				<button
					type="button"
					class="theme-picker__item"
					style:background={key === current ? `${primary}22` : 'transparent'}
					style:color={key === current ? primary : fg}
					style:font-weight={key === current ? 600 : 400}
					onclick={() => pick(key)}
				>
					<span
						class="theme-picker__swatch"
						style:background={themes[key].theme.colors?.primary ?? '#6366f1'}
						style:border={`2px solid ${themes[key].theme.colors?.border ?? '#374151'}`}
					></span>
					{themes[key].label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.theme-picker {
		position: fixed;
		bottom: 48px;
		right: 12px;
		z-index: 99999;
		font-family: system-ui, sans-serif;
	}

	.theme-picker--small {
		bottom: auto;
		right: 8px;
		top: calc(env(safe-area-inset-top, 0px) + 60px);
	}

	.theme-picker__btn {
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

	.theme-picker__menu {
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

	/* On mobile the button is anchored near the top, so an upward menu was
	   clipped off-screen. Open downward there; keep the bottom-anchored
	   placement on desktop. */
	.theme-picker--small .theme-picker__menu {
		bottom: auto;
		margin-bottom: 0;
		top: 100%;
		margin-top: 4px;
	}

	.theme-picker__item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 14px;
		border: none;
		cursor: pointer;
		font-size: 13px;
		text-align: left;
	}

	.theme-picker__swatch {
		width: 14px;
		height: 14px;
		border-radius: 9999px;
		flex-shrink: 0;
	}
</style>
