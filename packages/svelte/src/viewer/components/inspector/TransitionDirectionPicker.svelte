<script lang="ts">
	/**
	 * TransitionDirectionPicker: the arrow control for a transition's `dir`
	 * attribute, matching React's `inspector/DirectionPicker.tsx`.
	 *
	 * Three or fewer tokens render as an inline row (`in`/`out` and other
	 * non-compass tokens have no grid slot); four or more lay out on the 3x3
	 * compass grid built by the shared `buildDirectionGrid`, so a picker for
	 * `push` and one for `cover` agree on where "up-left" sits.
	 */
	import { buildDirectionGrid, TRANSITION_DIR_ARROWS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		directions,
		value,
		onchange,
	}: {
		directions: readonly string[];
		value: string | undefined;
		onchange: (direction: string) => void;
	} = $props();
	const t = useTranslator();

	const useGrid = $derived(directions.length > 3);
	const cells = $derived(useGrid ? buildDirectionGrid(directions) : []);

	function title(direction: string): string {
		return t(`pptx.transition.dir.${direction}`) || direction;
	}
</script>

{#if useGrid}
	<div class="pptx-svelte-dir-grid">
		{#each cells as row, rowIndex}
			{#each row as cell, columnIndex}
				{#if cell}
					<button
						type="button"
						title={title(cell)}
						aria-label={title(cell)}
						aria-pressed={value === cell}
						class:pptx-svelte-dir-active={value === cell}
						onclick={() => onchange(cell)}
					>
						{TRANSITION_DIR_ARROWS[cell] ?? cell}
					</button>
				{:else}
					<span class="pptx-svelte-dir-spacer" data-cell={`${rowIndex}-${columnIndex}`}></span>
				{/if}
			{/each}
		{/each}
	</div>
{:else}
	<div class="pptx-svelte-dir-row">
		{#each directions as direction (direction)}
			<button
				type="button"
				title={title(direction)}
				aria-label={title(direction)}
				aria-pressed={value === direction}
				class:pptx-svelte-dir-active={value === direction}
				onclick={() => onchange(direction)}
			>
				{TRANSITION_DIR_ARROWS[direction] ?? direction}
			</button>
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-dir-grid {
		display: inline-grid;
		grid-template-columns: repeat(3, 24px);
		gap: 2px;
	}

	.pptx-svelte-dir-row {
		display: flex;
		gap: 4px;
	}

	.pptx-svelte-dir-spacer {
		width: 24px;
		height: 24px;
	}

	button {
		height: 24px;
		min-width: 24px;
		padding: 0 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	button:hover {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-dir-active {
		background: var(--pptx-primary, #6366f1);
		border-color: var(--pptx-primary, #6366f1);
		color: #fff;
	}
</style>
