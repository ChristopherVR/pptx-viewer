<script lang="ts">
	/**
	 * AfterAnimationRow: the animation panel's "after animation" row (dim to
	 * colour / hide after animation / hide on next click / don't dim), Svelte
	 * port of React's `inspector/AfterAnimationRow.tsx`.
	 */
	import type { PptxAfterAnimationAction } from 'pptx-viewer-core';
	import { AFTER_ANIMATION_VALUES } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		action,
		color,
		canEdit,
		onaction,
		oncolor,
	}: {
		action: PptxAfterAnimationAction;
		color: string | undefined;
		canEdit: boolean;
		onaction: (action: PptxAfterAnimationAction) => void;
		oncolor: (color: string) => void;
	} = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-after-animation">
	<label>
		<span>{t('pptx.animation.afterAnimation')}</span>
		<select
			aria-label={t('pptx.animation.afterAnimation')}
			class="pptx-svelte-animp-after-animation"
			disabled={!canEdit}
			value={action}
			onchange={(event) => onaction(event.currentTarget.value as PptxAfterAnimationAction)}
		>
			{#each AFTER_ANIMATION_VALUES as value (value)}
				<option {value}>{t(`pptx.animation.afterAnimation.${value}`)}</option>
			{/each}
		</select>
	</label>
	{#if action === 'dimToColor'}
		<label class="pptx-svelte-after-animation-color">
			<span>{t('pptx.animation.afterAnimation.color')}</span>
			<input
				type="color"
				aria-label={t('pptx.animation.afterAnimation.color')}
				disabled={!canEdit}
				value={color ?? '#808080'}
				onchange={(event) => oncolor(event.currentTarget.value)}
			/>
		</label>
	{/if}
</div>

<style>
	.pptx-svelte-after-animation {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pptx-svelte-after-animation label {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-after-animation > label > span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-animp-after-animation {
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

	.pptx-svelte-after-animation-color {
		flex-direction: row;
		align-items: center;
		gap: 6px;
	}

	.pptx-svelte-after-animation-color input[type='color'] {
		width: 40px;
		height: 24px;
		padding: 0;
	}
</style>
