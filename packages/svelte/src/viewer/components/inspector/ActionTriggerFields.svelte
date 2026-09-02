<script lang="ts">
	/**
	 * ActionTriggerFields: one trigger block (On Click or On Hover) of the
	 * Action Settings panel, matching React's `ActionTriggerSection`.
	 *
	 * Kept as its own component because the two triggers are identical apart
	 * from which element field they write, and because only some types take a
	 * second input: inlining every copy in the parent would double the
	 * conditional markup for no gain.
	 *
	 * The slide input shows 1-based numbers (what the audience sees) while
	 * `ElementAction.slideIndex` is 0-based; the shared `toSlideIndex` owns that
	 * conversion and the clamp to the deck's real bounds.
	 *
	 * WHY `pendingType` exists: `url` / `slide` / `customShow` only become a
	 * real stored action once they carry their target, so a panel that derives
	 * the select value purely from the element round-trips "Go to URL" straight
	 * back to "None" and the URL input never appears, leaving the control
	 * unusable. The locally picked type therefore wins over the stored one
	 * (shared `resolveActionType`), which is what makes choosing an action type
	 * actually reveal its input.
	 *
	 * Wave-4 B7: `customShow` gets a show picker + "Resume last slide viewed"
	 * checkbox; `url` / `openFile` / `openPresentation` all share the same text
	 * target field (core's `ElementAction.url` already carries all three).
	 */
	import type { ElementAction, ElementActionType, PptxCustomShow } from 'pptx-viewer-core';
	import { ELEMENT_ACTION_TYPE_OPTIONS, resolveActionType, toSlideIndex } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		label,
		activeType,
		url,
		slideIndex,
		customShowId,
		returnAfter,
		customShows,
		canEdit,
		slideCount,
		onchangetype,
		onchangetarget,
	}: {
		label: string;
		activeType: ElementActionType;
		url: string;
		slideIndex: number;
		customShowId: string;
		returnAfter: boolean;
		customShows: readonly PptxCustomShow[];
		canEdit: boolean;
		slideCount: number;
		onchangetype: (type: ElementActionType) => void;
		/** A target field changed; always carries the CURRENT `effectiveType`. */
		onchangetarget: (patch: Partial<ElementAction>) => void;
	} = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let pendingType = $state<ElementActionType | undefined>(undefined);
	const effectiveType = $derived(resolveActionType(pendingType, activeType));
	/** A text-target field (URL / external file / external presentation). */
	const showsUrlField = $derived(
		effectiveType === 'url' || effectiveType === 'openFile' || effectiveType === 'openPresentation',
	);
	const urlLabelKey = $derived(
		effectiveType === 'openFile'
			? 'pptx.hyperlink.actionOpenFile'
			: effectiveType === 'openPresentation'
				? 'pptx.hyperlink.actionOpenPresentation'
				: 'pptx.action.gotoUrl',
	);

	function chooseType(type: ElementActionType): void {
		pendingType = type;
		onchangetype(type);
	}

	function commitSlide(raw: string): void {
		const index = toSlideIndex(Number(raw), slideCount);
		if (index !== undefined) {
			onchangetarget({ type: effectiveType, slideIndex: index });
		}
	}
</script>

<div class="pptx-svelte-action-trigger">
	<span class="pptx-svelte-action-trigger-label">{label}</span>
	<select
		aria-label={label}
		disabled={!canEdit}
		value={effectiveType}
		onchange={(event) => chooseType(event.currentTarget.value as ElementActionType)}
	>
		{#each ELEMENT_ACTION_TYPE_OPTIONS as option (option.value)}
			<option value={option.value}>{t(option.labelKey)}</option>
		{/each}
	</select>

	{#if showsUrlField}
		<input
			type="text"
			aria-label={t(urlLabelKey)}
			disabled={!canEdit}
			placeholder="https://..."
			value={url}
			onchange={(event) => onchangetarget({ type: effectiveType, url: event.currentTarget.value })}
		/>
	{/if}

	{#if effectiveType === 'slide'}
		<input
			type="number"
			aria-label={t('pptx.action.gotoSlide')}
			disabled={!canEdit}
			placeholder={t('pptx.action.slideNumberPlaceholder')}
			min="1"
			max={slideCount}
			value={slideIndex + 1}
			onchange={(event) => commitSlide(event.currentTarget.value)}
		/>
	{/if}

	{#if effectiveType === 'customShow'}
		<select
			data-testid="pptx-action-custom-show"
			aria-label={t('pptx.hyperlink.customShowLabel')}
			disabled={!canEdit}
			value={customShowId}
			onchange={(event) =>
				onchangetarget({ type: effectiveType, customShowId: event.currentTarget.value })}
		>
			<option value="">{t('pptx.hyperlink.customShowLabel')}</option>
			{#each customShows as show (show.id)}
				<option value={show.id}>{show.name}</option>
			{/each}
		</select>
		<label class="pptx-svelte-action-trigger-checkbox">
			<input
				type="checkbox"
				data-testid="pptx-action-custom-show-return"
				disabled={!canEdit}
				checked={returnAfter}
				onchange={(event) =>
					onchangetarget({ type: effectiveType, customShowId, returnAfter: event.currentTarget.checked })}
			/>
			<span>{t('pptx.hyperlink.customShowReturn')}</span>
		</label>
	{/if}
</div>

<style>
	.pptx-svelte-action-trigger {
		display: grid;
		gap: 4px;
	}

	.pptx-svelte-action-trigger-label {
		font-weight: 500;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-action-trigger select,
	.pptx-svelte-action-trigger input[type='text'],
	.pptx-svelte-action-trigger input[type='number'] {
		width: 100%;
		min-width: 0;
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-action-trigger-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
