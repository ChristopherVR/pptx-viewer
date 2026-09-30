<script lang="ts">
	/**
	 * ParagraphGroup: bullet / numbered list, indent, alignment, and line
	 * spacing for the Home tab's Paragraph group. List state comes from semantic
	 * paragraph bullets; other formatting uses the element's base text style.
	 */
	import RibbonIcon from '../RibbonIcon.svelte';
	import type { TextStyle } from 'pptx-viewer-core';
	import { hasTextProperties } from 'pptx-viewer-core';
	import { elementBulletKind, LINE_SPACING_OPTIONS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { fixedGalleryPlacement } from '../galleries/fixed-placements';
	import RibbonGallery from '../galleries/RibbonGallery.svelte';
	import {
		adjustIndentPatch,
		setAlignPatch,
		setLineSpacingPatch,
		toggleListTypePatch,
	} from '../../../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const el = $derived(editor.selectedElement);
	const active = $derived(editor.editable && el !== undefined && hasTextProperties(el));
	const style = $derived<TextStyle>(el && hasTextProperties(el) ? (el.textStyle ?? {}) : {});
	const listKind = $derived(el && hasTextProperties(el) ? elementBulletKind(el) : 'none');

	function apply(patch: Parameters<EditorState['patchSelected']>[0]): void {
		editor.patchSelected(patch);
	}

	const BULLETS = fixedGalleryPlacement('home.paragraph.bullets');
	const NUMBERING = fixedGalleryPlacement('home.paragraph.numbering');

	const ALIGN_BUTTONS = [
		{ value: 'left', key: 'pptx.ribbon.alignLeft', control: 'home.paragraph.alignLeft' },
		{ value: 'center', key: 'pptx.ribbon.alignCenter', control: 'home.paragraph.alignCenter' },
		{ value: 'right', key: 'pptx.ribbon.alignRight', control: 'home.paragraph.alignRight' },
		{ value: 'justify', key: 'pptx.ribbon.justify', control: 'home.paragraph.justify' },
	] as const;
</script>

<div class="pptx-svelte-para" data-pptx-chrome="control-fragment" role="group" aria-label={t('pptx.ribbon.paragraph')}>
	<span class="pptx-svelte-para-split" data-ribbon-control={BULLETS.control}>
	<button
		type="button"
		class="pptx-svelte-para-btn"
		class:pptx-svelte-para-on={listKind === 'bullet'}
		disabled={!active}
		aria-pressed={listKind === 'bullet'}
		aria-label={t('pptx.text.bulletList')}
		title={t('pptx.text.bulletList')}
		onmousedown={(event) => event.preventDefault()}
	onclick={() => el && apply((current, snapshot) => toggleListTypePatch(current, 'bullet', snapshot))}
	>
		<RibbonIcon name="home.paragraph.bullets" />
	</button>
	<RibbonGallery placement={BULLETS} chevronOnly tagControl={false} />
	</span>
	<span class="pptx-svelte-para-split" data-ribbon-control={NUMBERING.control}>
	<button
		type="button"
		class="pptx-svelte-para-btn"
		class:pptx-svelte-para-on={listKind === 'numbered'}
		disabled={!active}
		aria-pressed={listKind === 'numbered'}
		aria-label={t('pptx.text.numberedList')}
		title={t('pptx.text.numberedList')}
		onmousedown={(event) => event.preventDefault()}
	onclick={() => el && apply((current, snapshot) => toggleListTypePatch(current, 'numbered', snapshot))}
	>
		<RibbonIcon name="home.paragraph.numbering" />
	</button>
	<RibbonGallery placement={NUMBERING} chevronOnly tagControl={false} />
	</span>



	<div data-pptx-chrome="control-cluster">
	<button
		type="button"
		class="pptx-svelte-para-btn"
		disabled={!active}
		data-ribbon-control="home.paragraph.decreaseIndent"
		aria-label={t('pptx.text.decreaseIndent')}
		title={t('pptx.text.decreaseIndent')}
		onclick={() => el && apply((current) => adjustIndentPatch(current, -1))}
	>
		<RibbonIcon name="home.paragraph.decreaseIndent" />
	</button>
	<button
		type="button"
		class="pptx-svelte-para-btn"
		disabled={!active}
		data-ribbon-control="home.paragraph.increaseIndent"
		aria-label={t('pptx.text.increaseIndent')}
		title={t('pptx.text.increaseIndent')}
		onclick={() => el && apply((current) => adjustIndentPatch(current, 1))}
	>
		<RibbonIcon name="home.paragraph.increaseIndent" />
	</button>



	</div>
	<div data-pptx-chrome="control-cluster">
	{#each ALIGN_BUTTONS as btn (btn.value)}
		<button
			type="button"
			class="pptx-svelte-para-btn"
			class:pptx-svelte-para-on={style.align === btn.value}
			disabled={!active}
			aria-pressed={style.align === btn.value}
			data-ribbon-control={btn.control}
			aria-label={t(btn.key)}
			title={t(btn.key)}
			onclick={() => el && apply((current) => setAlignPatch(current, btn.value as TextStyle['align']))}
		>
			<RibbonIcon name={btn.control} />
		</button>
	{/each}

	</div>
	<pptx-ui-select variant="ribbon-icon"
		class="pptx-svelte-ribbon-select"
		disabled={!active}
		data-ribbon-control="home.paragraph.lineSpacing"
		aria-label={t('pptx.paragraph.lineSpacing')}
		title={t('pptx.paragraph.lineSpacing')}
		onchange={(e) => {
			if (el && e.currentTarget.value) {
				apply((current) => setLineSpacingPatch(current, Number(e.currentTarget.value)));
			}
		}}
	>
		<RibbonIcon slot="icon" name="home.paragraph.lineSpacing" />
		{#each LINE_SPACING_OPTIONS as option (option.value)}
			<option value={option.value} selected={style.lineSpacing === option.value}>
				{option.label}
			</option>
		{/each}
	</pptx-ui-select>
</div>

<style>
	.pptx-svelte-para {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	.pptx-svelte-para-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-para-btn:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-para-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-para-on {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-para-btn svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-para-split {
		display: inline-flex;
		align-items: center;
	}

	.pptx-svelte-para-sep {
		width: 1px;
		height: 18px;
		margin: 0 3px;
		background: var(--pptx-border, #33334d);
	}

	/* The line-spacing select is styled by the shared
	   `.pptx-svelte-ribbon-select` class defined in Ribbon.svelte. */
</style>
