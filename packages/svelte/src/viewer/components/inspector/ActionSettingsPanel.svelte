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
	const customShows = $derived(editor.customShows);
	const clickAction = $derived<ElementAction | undefined>(
		el.actionClick ? pptxActionToElementAction(el.actionClick, 'click') : undefined,
	);
	const hoverAction = $derived<ElementAction | undefined>(
		el.actionHover ? pptxActionToElementAction(el.actionHover, 'hover') : undefined,
	);

	/** Write one trigger's FULL action back onto the element (history-integrated). */
	function updateAction(trigger: 'click' | 'hover', action: Omit<ElementAction, 'trigger'>): void {
		const pptxAction = elementActionToPptxAction({ trigger, ...action });
		editor.applyElementPatch(
			el.id,
			(trigger === 'click' ? { actionClick: pptxAction } : { actionHover: pptxAction }) as Partial<
				PptxElement
			>,
		);
	}

	/**
	 * Write a picked type back only once it carries its target.
	 *
	 * A target-less `url` / `slide` / `customShow` action serialises to an
	 * action that parses straight back as `none` (or, for `customShow`, one
	 * naming no show), so committing one would wipe the choice the user is
	 * halfway through making; the fields keep showing the pick until the
	 * target arrives (shared `canCommitActionType`).
	 */
	function chooseType(trigger: 'click' | 'hover', type: ElementActionType): void {
		const current = trigger === 'click' ? clickAction : hoverAction;
		const action = { ...current, type };
		if (canCommitActionType(type, action)) {
			updateAction(trigger, action);
		}
	}

	/**
	 * A target field changed (URL, slide number, custom show, return-after):
	 * `patch` always carries the type the field belongs to (the trigger
	 * fields' own `effectiveType`, which may still be only PENDING), so this
	 * commits under the SAME gate as a fresh type pick rather than the type
	 * last actually written to the element.
	 */
	function changeTarget(trigger: 'click' | 'hover', patch: Partial<ElementAction>): void {
		const current = trigger === 'click' ? clickAction : hoverAction;
		const action = { ...current, ...patch, type: patch.type ?? current?.type ?? 'none' };
		if (canCommitActionType(action.type, action)) {
			updateAction(trigger, action);
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
			customShowId={clickAction?.customShowId ?? ''}
			returnAfter={clickAction?.returnAfter ?? false}
			{customShows}
			{canEdit}
			{slideCount}
			onchangetype={(type) => chooseType('click', type)}
			onchangetarget={(patch) => changeTarget('click', patch)}
		/>
		<ActionTriggerFields
			label={t('pptx.action.onHover')}
			activeType={hoverAction?.type ?? 'none'}
			url={hoverAction?.url ?? el.actionHover?.url ?? ''}
			slideIndex={hoverAction?.slideIndex ?? el.actionHover?.targetSlideIndex ?? 0}
			customShowId={hoverAction?.customShowId ?? ''}
			returnAfter={hoverAction?.returnAfter ?? false}
			{customShows}
			{canEdit}
			{slideCount}
			onchangetype={(type) => chooseType('hover', type)}
			onchangetarget={(patch) => changeTarget('hover', patch)}
		/>
	</div>
{/key}

<style>
	.pptx-svelte-action-settings {
		display: grid;
		gap: 10px;
	}
</style>
