<script lang="ts">
	/**
	 * ActionSettingsPanel: PowerPoint's Insert > Action dialog as an inspector
	 * card, mirroring React's `inspector/ActionSettingsPanel.tsx`.
	 *
	 * An element can carry two independent actions, one per trigger, stored as
	 * `actionClick` / `actionHover` (`PptxAction`). The friendlier
	 * `ElementAction` shape the UI edits is converted both ways by core's
	 * `pptxActionToElementAction` / `elementActionToPptxAction`, so this panel
	 * never hand-rolls the OOXML `ppaction://` string, and the option catalogue
	 * plus the 1-based to 0-based slide-number clamp come from
	 * `pptx-viewer-shared` (`ELEMENT_ACTION_TYPE_OPTIONS` / `toSlideIndex`).
	 *
	 * Both triggers share {@link ActionTriggerFields}, so the extra URL / slide
	 * input only exists for the two types that need it.
	 */
	import type { ElementAction, ElementActionType, PptxElement } from 'pptx-viewer-core';
	import { elementActionToPptxAction, pptxActionToElementAction } from 'pptx-viewer-core';
	import { canCommitActionType } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import ActionTriggerFields from './ActionTriggerFields.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const canEdit = $derived(editor.editable);
	const slideCount = $derived(editor.slides.length);
	const clickAction = $derived<ElementAction | undefined>(
		el.actionClick ? pptxActionToElementAction(el.actionClick, 'click') : undefined,
	);
	const hoverAction = $derived<ElementAction | undefined>(
		el.actionHover ? pptxActionToElementAction(el.actionHover, 'hover') : undefined,
	);

	/** Write one trigger's action back onto the element (history-integrated). */
	function updateAction(
		trigger: 'click' | 'hover',
		type: ElementActionType,
		url?: string,
		slideIndex?: number,
	): void {
		const action = elementActionToPptxAction({ trigger, type, url, slideIndex });
		editor.applyElementPatch(
			el.id,
			(trigger === 'click' ? { actionClick: action } : { actionHover: action }) as Partial<
				PptxElement
			>,
		);
	}

	/**
	 * Write a picked type back only once it carries its target.
	 *
	 * A target-less `url` / `slide` action serialises to an action that parses
	 * straight back as `none`, so committing one would wipe the choice the user
	 * is halfway through making; the fields keep showing the pick until the
	 * target arrives (shared `canCommitActionType`).
	 */
	function chooseType(trigger: 'click' | 'hover', type: ElementActionType): void {
		const current = trigger === 'click' ? clickAction : hoverAction;
		const target = { url: current?.url, slideIndex: current?.slideIndex };
		if (canCommitActionType(type, target)) {
			updateAction(trigger, type, target.url, target.slideIndex);
		}
	}
</script>

<!-- Keyed on the element so a half-made pick does not follow the inspector to
     the next shape, which never had it. -->
{#key el.id}
	<div class="pptx-svelte-action-settings">
		<ActionTriggerFields
			label={t('pptx.action.onClick')}
			activeType={clickAction?.type ?? 'none'}
			url={clickAction?.url ?? el.actionClick?.url ?? ''}
			slideIndex={clickAction?.slideIndex ?? el.actionClick?.targetSlideIndex ?? 0}
			{canEdit}
			{slideCount}
			onchangetype={(type) => chooseType('click', type)}
			onchangeurl={(url) => updateAction('click', 'url', url)}
			onchangeslide={(index) => updateAction('click', 'slide', undefined, index)}
		/>
		<ActionTriggerFields
			label={t('pptx.action.onHover')}
			activeType={hoverAction?.type ?? 'none'}
			url={hoverAction?.url ?? el.actionHover?.url ?? ''}
			slideIndex={hoverAction?.slideIndex ?? el.actionHover?.targetSlideIndex ?? 0}
			{canEdit}
			{slideCount}
			onchangetype={(type) => chooseType('hover', type)}
			onchangeurl={(url) => updateAction('hover', 'url', url)}
			onchangeslide={(index) => updateAction('hover', 'slide', undefined, index)}
		/>
	</div>
{/key}

<style>
	.pptx-svelte-action-settings {
		display: grid;
		gap: 10px;
	}
</style>
