<script lang="ts">
	/**
	 * SlideSizeSection: SLIDE SIZE card (editable W / H pixel inputs), the
	 * Svelte port of Vue's `SlideSizeCard` (React
	 * `inspector/PresentationSettingsCards.tsx`).
	 */
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		canvasSize,
		canEdit = true,
		onupdate,
	}: {
		canvasSize: CanvasSize;
		canEdit?: boolean;
		onupdate: (size: CanvasSize) => void;
	} = $props();
	const t = useTranslator();

	const FIELDS = [
		['W', 'width'],
		['H', 'height'],
	] as const;

	function commit(key: 'width' | 'height', raw: string): void {
		const value = Number(raw);
		if (!Number.isFinite(value)) {
			return;
		}
		onupdate({ ...canvasSize, [key]: value });
	}
</script>

<div class="pptx-svelte-slide-size">
	{#each FIELDS as [label, key] (key)}
		<label>
			<span>{label}</span>
			<input
				type="number"
				aria-label={`${t('pptx.slideSize.title')} ${label}`}
				disabled={!canEdit}
				value={canvasSize[key]}
				oninput={(event) => commit(key, event.currentTarget.value)}
			/>
		</label>
	{/each}
</div>

<style>
	.pptx-svelte-slide-size {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	label {
		display: flex;
		align-items: center;
		gap: 5px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	input {
		min-width: 0;
		width: 100%;
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
	}
</style>
