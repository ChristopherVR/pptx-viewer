<script lang="ts">
	/**
	 * FieldMenu: Insert > Field, a native `<select>` offering slide number /
	 * date-time / header / footer, resolved to display text via the shared
	 * `text-field-substitution.ts` module (`resolveFieldDisplayText`). No
	 * custom date-format sub-picker (React's popover); the current date/time
	 * is inserted directly, matching this binding's simpler control idiom.
	 */
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildFieldInsertElement, resolveFieldDisplayText } from '../../../editor';

	const { editor, canvasSize }: { editor: EditorState; canvasSize: CanvasSize } = $props();
	const t = useTranslator();

	/** The field types offered by the dropdown, with dictionary keys. */
	const FIELD_OPTIONS: ReadonlyArray<{ fieldType: string; i18nKey: string }> = [
		{ fieldType: 'slidenum', i18nKey: 'pptx.field.slideNumber' },
		{ fieldType: 'datetime', i18nKey: 'pptx.field.dateTime' },
		{ fieldType: 'header', i18nKey: 'pptx.field.header' },
		{ fieldType: 'footer', i18nKey: 'pptx.field.footer' },
	];

	function onChange(event: Event): void {
		const select = event.currentTarget as HTMLSelectElement;
		const fieldType = select.value;
		select.value = '';
		if (!fieldType) {
			return;
		}
		const displayText = resolveFieldDisplayText(fieldType, {
			slideNumber: editor.currentSlideIndex + 1,
		});
		editor.insertElement(buildFieldInsertElement(fieldType, displayText, canvasSize));
	}
</script>

<select
	class="pptx-svelte-insert-select"
	disabled={!editor.editable}
	aria-label={t('pptx.field.insertField')}
	title={t('pptx.field.insertField')}
	value=""
	onchange={onChange}
>
	<option value="">{t('pptx.field.field')}</option>
	{#each FIELD_OPTIONS as opt (opt.fieldType)}
		<option value={opt.fieldType}>{t(opt.i18nKey)}</option>
	{/each}
</select>

<style>
	.pptx-svelte-insert-select {
		height: 28px;
		max-width: 96px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		padding: 0 6px;
	}

	.pptx-svelte-insert-select:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-insert-select:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
