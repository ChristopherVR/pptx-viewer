<script lang="ts">
	/**
	 * SwatchColorPicker: a swatch-grid colour picker with a custom-colour
	 * fallback, shared by the Home tab's font-colour and highlight-colour
	 * pickers (React parity: a 5-column swatch grid + "Custom colour..." native
	 * `<input type=color>`). No shared swatch catalogue exists yet in
	 * `pptx-viewer-shared` (same gap noted by the vanilla binding), so this
	 * uses a standard Office theme-color set local to the component.
	 */
	import { useTranslator } from '../../../i18n/context';

	const {
		value,
		onselect,
		disabled = false,
		label,
		glyph,
		swatches,
	}: {
		value: string;
		onselect: (hex: string) => void;
		disabled?: boolean;
		label: string;
		/** Short text glyph shown on the trigger button (e.g. "A", "H"). */
		glyph: string;
		/** Defaults to a standard Office theme-colour set when omitted. */
		swatches?: readonly string[];
	} = $props();

	const t = useTranslator();

	const DEFAULT_SWATCHES = [
		'#000000',
		'#ffffff',
		'#ff0000',
		'#00aa00',
		'#0000ff',
		'#ff8800',
		'#8800cc',
		'#00cccc',
		'#ff69b4',
		'#808080',
	] as const;

	const palette = $derived(swatches ?? DEFAULT_SWATCHES);
	let open = $state(false);

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			open = false;
		}
	}

	function choose(hex: string): void {
		open = false;
		onselect(hex);
	}
</script>

<div class="pptx-svelte-swatch" onfocusout={onFocusOut}>
	<button
		type="button"
		class="pptx-svelte-swatch-trigger"
		{disabled}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={label}
		title={label}
		onclick={() => (open = !open)}
	>
		<span class="pptx-svelte-swatch-glyph">{glyph}</span>
		<span class="pptx-svelte-swatch-swab" style={`background-color:${value}`}></span>
	</button>
	{#if open}
		<div class="pptx-svelte-swatch-menu" role="menu">
			<div class="pptx-svelte-swatch-grid">
				{#each palette as hex (hex)}
					<button
						type="button"
						class="pptx-svelte-swatch-cell"
						class:pptx-svelte-swatch-cell-selected={hex.toLowerCase() === value.toLowerCase()}
						style={`background-color:${hex}`}
						aria-label={hex}
						data-pptx-compact
						onclick={() => choose(hex)}
					></button>
				{/each}
			</div>
			<label class="pptx-svelte-swatch-custom">
				<span>{t('pptx.ribbon.customColour')}</span>
				<input type="color" {value} onchange={(e) => choose(e.currentTarget.value)} />
			</label>
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-swatch {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-swatch-trigger {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 28px;
		height: 28px;
		padding: 0 6px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-swatch-trigger:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-swatch-trigger:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-swatch-glyph {
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
	}

	.pptx-svelte-swatch-swab {
		width: 16px;
		height: 3px;
		border-radius: 1px;
		border: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-swatch-menu {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 8px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-swatch-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 5px;
	}

	.pptx-svelte-swatch-cell {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1px solid var(--pptx-border, #33334d);
		cursor: pointer;
		padding: 0;
	}

	.pptx-svelte-swatch-cell-selected {
		outline: 2px solid var(--pptx-primary, #6366f1);
		outline-offset: 1px;
	}

	.pptx-svelte-swatch-custom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		font-size: 11.5px;
		cursor: pointer;
	}

	.pptx-svelte-swatch-custom input[type='color'] {
		width: 20px;
		height: 20px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}
</style>
