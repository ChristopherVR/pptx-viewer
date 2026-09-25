<script lang="ts">
	/**
	 * RibbonToggle: a small checkbox row inside a ribbon group, the Svelte twin
	 * of React's `PowerPointRibbonControls.RibbonToggle`.
	 *
	 * The caption is the wrapping `<label>`'s own text rather than an
	 * `aria-label` on the input, which is what makes the accessible name the
	 * user-visible one in every binding.
	 */
	import type { RibbonControlId } from 'pptx-viewer-shared';

	const {
		label,
		checked,
		disabled = false,
		title,
		control,
		onchange,
	}: {
		label: string;
		checked: boolean;
		disabled?: boolean;
		title?: string;
		/** Catalogue id (`data-ribbon-control`) the host can hide this toggle by. */
		control?: RibbonControlId;
		onchange?: (checked: boolean) => void;
	} = $props();
</script>

<label class="pptx-svelte-rbtoggle" class:pptx-svelte-rbtoggle-on={checked} {title} data-ribbon-control={control}>
	<input
		type="checkbox"
		{checked}
		{disabled}
		onchange={(event) => onchange?.(event.currentTarget.checked)}
	/>
	{label}
</label>

<style>
	.pptx-svelte-rbtoggle {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 19px;
		padding: 0 4px;
		border-radius: 4px;
		font-size: 10px;
		white-space: nowrap;
		cursor: pointer;
	}

	.pptx-svelte-rbtoggle-on {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 18%, transparent);
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-rbtoggle input {
		width: 12px;
		height: 12px;
		accent-color: var(--pptx-primary, #6366f1);
		cursor: inherit;
	}

	.pptx-svelte-rbtoggle input:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
