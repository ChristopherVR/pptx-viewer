<script lang="ts">
	/**
	 * One schema-driven File > Options control row: toggle, select, number, or
	 * text, with the optional "(i)" info tooltip (a `title` attribute, matching
	 * React's `InfoTip`). Values are read from / written to the flat options
	 * model via the control's `group` + `key`.
	 */
	import Info from '@lucide/svelte/icons/info';
	import type { ViewerOptions, ViewerOptionsControl, ViewerOptionsGroupId } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';

	const {
		control,
		options,
		onchange,
	}: {
		control: ViewerOptionsControl;
		options: ViewerOptions;
		onchange: (group: ViewerOptionsGroupId, key: string, value: boolean | number | string) => void;
	} = $props();
	const t = useTranslator();

	const value = $derived.by((): boolean | number | string | undefined => {
		const group = options[control.group] as unknown as Record<string, unknown>;
		const raw = group[control.key];
		return typeof raw === 'boolean' || typeof raw === 'number' || typeof raw === 'string' ? raw : undefined;
	});

	function commitNumber(event: Event): void {
		if (control.kind !== 'number') {
			return;
		}
		const parsed = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isFinite(parsed)) {
			onchange(control.group, control.key, Math.min(control.max, Math.max(control.min, parsed)));
		}
	}
</script>

<div class="row" class:indent={control.indent}>
	{#if control.kind === 'toggle'}
		<label class="toggle">
			<span class="label">{t(control.labelKey)}{#if control.infoKey}<i title={t(control.infoKey)} aria-label={t(control.infoKey)}><Info size={14} aria-hidden="true" /></i>{/if}</span>
			<input type="checkbox" checked={value === true} onchange={(event) => onchange(control.group, control.key, event.currentTarget.checked)} />
		</label>
	{:else}
		<span class="label">{t(control.labelKey)}{#if control.infoKey}<i title={t(control.infoKey)} aria-label={t(control.infoKey)}><Info size={14} aria-hidden="true" /></i>{/if}</span>
		{#if control.kind === 'select'}
			<select aria-label={t(control.labelKey)} value={typeof value === 'string' ? value : ''} onchange={(event) => onchange(control.group, control.key, event.currentTarget.value)}>
				{#each control.choices as choice (choice.value)}<option value={choice.value}>{t(choice.labelKey)}</option>{/each}
			</select>
		{:else if control.kind === 'number'}
			<span class="number">
				<input type="number" aria-label={t(control.labelKey)} min={control.min} max={control.max} step={control.step ?? 1} value={typeof value === 'number' ? value : control.min} onchange={commitNumber} />
				{#if control.unitKey}<small>{t(control.unitKey)}</small>{/if}
			</span>
		{:else}
			<input class="text" type="text" aria-label={t(control.labelKey)} maxlength={control.maxLength} value={typeof value === 'string' ? value : ''} onchange={(event) => onchange(control.group, control.key, event.currentTarget.value)} />
		{/if}
	{/if}
</div>

<style>
	.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 12px; }
	.indent { padding-left: 22px; }
	.toggle { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; user-select: none; }
	.label { display: inline-flex; align-items: center; color: var(--pptx-foreground, #e2e8f0); }
	.label i { display: inline-flex; margin-left: 5px; color: color-mix(in srgb, var(--pptx-primary, #6366f1) 70%, transparent); font-style: normal; cursor: help; }
	input[type='checkbox'] { width: 15px; height: 15px; flex: none; accent-color: var(--pptx-primary, #6366f1); }
	select, .number input, .text { border: 1px solid var(--pptx-border, #3f3f52); border-radius: 5px; padding: 4px 7px; background: var(--pptx-background, #11111b); color: var(--pptx-foreground, #e2e8f0); font: inherit; font-size: 11px; }
	select { max-width: 55%; }
	.number { display: flex; align-items: center; gap: 6px; }
	.number input { width: 74px; text-align: right; }
	.number small { color: var(--pptx-muted-foreground, #94a3b8); font-size: 11px; }
	.text { width: 12rem; max-width: 55%; }
</style>
