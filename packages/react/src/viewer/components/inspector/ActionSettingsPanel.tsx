/**
 * ActionSettingsPanel: PowerPoint's Insert > Action dialog as an inspector card.
 *
 * An element carries two independent actions, one per trigger (`actionClick` /
 * `actionHover`), stored as the OOXML-shaped `PptxAction`; core's
 * `pptxActionToElementAction` / `elementActionToPptxAction` convert both ways so
 * this panel never hand-rolls a `ppaction://` URI. The option catalogue, the
 * pending-type rule, the commit gate and the 1-based to 0-based slide-number
 * clamp all come from `pptx-viewer-shared`, so the five bindings cannot drift on
 * behaviour that is not a rendering decision.
 */
import type { PptxElement, PptxSlide, ElementAction, ElementActionType } from 'pptx-viewer-core';
import { pptxActionToElementAction, elementActionToPptxAction } from 'pptx-viewer-core';
import {
	canCommitActionType,
	ELEMENT_ACTION_TYPE_OPTIONS,
	resolveActionType,
} from 'pptx-viewer-shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { ActionTargetFields } from './ActionTargetFields';
import { CARD, HEADING, INPUT } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionSettingsPanelProps {
	selectedElement: PptxElement;
	slides: PptxSlide[];
	canEdit: boolean;
	/** `data.customShows`, for the `customShow` target picker. */
	customShows: Array<{ id: string; name: string }>;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

/** The action target fields, beyond `type`, that `updateAction` can write. */
export interface ActionTargetPatch {
	url?: string;
	slideIndex?: number;
	customShowId?: string;
	returnAfter?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionSettingsPanel({
	selectedElement,
	slides,
	canEdit,
	customShows,
	onUpdateElement,
}: ActionSettingsPanelProps): React.ReactElement {
	const { t } = useTranslation();

	const clickAction: ElementAction | undefined = selectedElement.actionClick
		? pptxActionToElementAction(selectedElement.actionClick, 'click')
		: undefined;

	const hoverAction: ElementAction | undefined = selectedElement.actionHover
		? pptxActionToElementAction(selectedElement.actionHover, 'hover')
		: undefined;

	const updateAction = (
		trigger: 'click' | 'hover',
		type: ElementActionType,
		patch: ActionTargetPatch,
	) => {
		const ea: ElementAction = { trigger, type, ...patch };
		const pa = elementActionToPptxAction(ea);
		if (trigger === 'click') {
			onUpdateElement({ actionClick: pa } as Partial<PptxElement>);
		} else {
			onUpdateElement({ actionHover: pa } as Partial<PptxElement>);
		}
	};

	/**
	 * Commit a picked type only once it can carry a target.
	 *
	 * "Go to URL" / "Go to Slide" / "Custom Show" round-trip back to `none`
	 * while their target is missing, so writing one straight away would stamp
	 * an empty action onto the element (and mark the deck dirty) for a choice
	 * the user has not finished making. The pick still shows, because the
	 * section holds it locally.
	 */
	const changeType = (trigger: 'click' | 'hover', type: ElementActionType) => {
		const current = trigger === 'click' ? clickAction : hoverAction;
		const target: ActionTargetPatch = {
			url: current?.url,
			slideIndex: current?.slideIndex,
			customShowId: current?.customShowId,
		};
		if (canCommitActionType(type, target)) {
			updateAction(trigger, type, target);
		}
	};

	return (
		<div className={CARD} data-pptx-action-settings>
			<div className={HEADING}>{t('pptx.action.title', 'Action')}</div>
			<div className='space-y-2 text-[11px]'>
				{/* On Click */}
				<ActionTriggerSection
					// A pending pick belongs to the element it was made on: re-keying on
					// the element id drops it when the inspector moves on, so the next
					// shape cannot inherit a half-made "Go to URL" it never had.
					key={`click-${selectedElement.id}`}
					label={t('pptx.action.onClick', 'On Click')}
					trigger='click'
					activeType={clickAction?.type}
					action={clickAction}
					fallbackUrl={selectedElement.actionClick?.url}
					fallbackSlideIndex={selectedElement.actionClick?.targetSlideIndex}
					canEdit={canEdit}
					slideCount={slides.length}
					customShows={customShows}
					onChangeType={(type) => changeType('click', type)}
					onChangeTarget={(type, patch) => updateAction('click', type, patch)}
				/>

				{/* On Hover */}
				<ActionTriggerSection
					key={`hover-${selectedElement.id}`}
					label={t('pptx.action.onHover', 'On Hover')}
					trigger='hover'
					activeType={hoverAction?.type}
					action={hoverAction}
					fallbackUrl={selectedElement.actionHover?.url}
					fallbackSlideIndex={selectedElement.actionHover?.targetSlideIndex}
					canEdit={canEdit}
					slideCount={slides.length}
					customShows={customShows}
					onChangeType={(type) => changeType('hover', type)}
					onChangeTarget={(type, patch) => updateAction('hover', type, patch)}
				/>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Sub-component: a single trigger block (Click or Hover)
// ---------------------------------------------------------------------------

interface ActionTriggerSectionProps {
	label: string;
	trigger: 'click' | 'hover';
	/** The type read back off the element, if it carries an action at all. */
	activeType: ElementActionType | undefined;
	action: ElementAction | undefined;
	fallbackUrl: string | undefined;
	fallbackSlideIndex: number | undefined;
	canEdit: boolean;
	slideCount: number;
	customShows: Array<{ id: string; name: string }>;
	onChangeType: (type: ElementActionType) => void;
	/** Commits a target-field patch against the EFFECTIVE type (pending or active). */
	onChangeTarget: (type: ElementActionType, patch: ActionTargetPatch) => void;
}

function ActionTriggerSection({
	label,
	trigger,
	activeType,
	action,
	fallbackUrl,
	fallbackSlideIndex,
	canEdit,
	slideCount,
	customShows,
	onChangeType,
	onChangeTarget,
}: ActionTriggerSectionProps): React.ReactElement {
	const { t } = useTranslation();
	// `url` / `slide` / `customShow` only become a stored action once they have
	// a target, so deriving the select purely from the element round-tripped
	// "Go to URL" straight back to "None" and its input never appeared. The
	// locally picked type therefore wins until the element really carries an
	// action.
	const [pendingType, setPendingType] = useState<ElementActionType | undefined>(undefined);
	const effectiveType = resolveActionType(pendingType, activeType);
	const changeType = (type: ElementActionType) => {
		setPendingType(type);
		onChangeType(type);
	};
	return (
		<div className='space-y-1.5' data-pptx-action-trigger={trigger}>
			<span className='text-muted-foreground font-medium'>{label}</span>
			<select
				disabled={!canEdit}
				aria-label={label}
				className={cn(INPUT, 'w-full')}
				value={effectiveType}
				onChange={(e) => changeType(e.target.value as ElementActionType)}
			>
				{ELEMENT_ACTION_TYPE_OPTIONS.map((o) => (
					<option key={o.value} value={o.value}>
						{t(o.labelKey)}
					</option>
				))}
			</select>

			<ActionTargetFields
				type={effectiveType}
				canEdit={canEdit}
				slideCount={slideCount}
				customShows={customShows}
				url={action?.url ?? fallbackUrl}
				slideIndex={action?.slideIndex ?? fallbackSlideIndex}
				customShowId={action?.customShowId}
				returnAfter={action?.returnAfter}
				onChange={(patch) => onChangeTarget(effectiveType, patch)}
			/>
		</div>
	);
}
