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
	toSlideIndex,
} from 'pptx-viewer-shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { CARD, HEADING, INPUT } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionSettingsPanelProps {
	selectedElement: PptxElement;
	slides: PptxSlide[];
	canEdit: boolean;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionSettingsPanel({
	selectedElement,
	slides,
	canEdit,
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
		url?: string,
		slideIndex?: number,
	) => {
		const ea: ElementAction = { trigger, type, url, slideIndex };
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
	 * "Go to URL" / "Go to Slide" round-trip back to `none` while their target is
	 * missing, so writing one straight away would stamp an empty action onto the
	 * element (and mark the deck dirty) for a choice the user has not finished
	 * making. The pick still shows, because the section holds it locally.
	 */
	const changeType = (trigger: 'click' | 'hover', type: ElementActionType) => {
		const current = trigger === 'click' ? clickAction : hoverAction;
		const target = { url: current?.url, slideIndex: current?.slideIndex };
		if (canCommitActionType(type, target)) {
			updateAction(trigger, type, target.url, target.slideIndex);
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
					onChangeType={(type) => changeType('click', type)}
					onChangeUrl={(url) => updateAction('click', 'url', url)}
					onChangeSlide={(idx) => updateAction('click', 'slide', undefined, idx)}
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
					onChangeType={(type) => changeType('hover', type)}
					onChangeUrl={(url) => updateAction('hover', 'url', url)}
					onChangeSlide={(idx) => updateAction('hover', 'slide', undefined, idx)}
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
	onChangeType: (type: ElementActionType) => void;
	onChangeUrl: (url: string) => void;
	onChangeSlide: (idx: number) => void;
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
	onChangeType,
	onChangeUrl,
	onChangeSlide,
}: ActionTriggerSectionProps): React.ReactElement {
	const { t } = useTranslation();
	// `url` and `slide` only become a stored action once they have a target, so
	// deriving the select purely from the element round-tripped "Go to URL"
	// straight back to "None" and its input never appeared. The locally picked
	// type therefore wins until the element really carries an action.
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

			{effectiveType === 'url' && (
				<input
					type='text'
					disabled={!canEdit}
					aria-label={t('pptx.action.gotoUrl')}
					className={cn(INPUT, 'w-full')}
					placeholder='https://...'
					value={action?.url ?? fallbackUrl ?? ''}
					onChange={(e) => onChangeUrl(e.target.value)}
				/>
			)}

			{effectiveType === 'slide' && (
				<input
					type='number'
					disabled={!canEdit}
					aria-label={t('pptx.action.gotoSlide')}
					className={cn(INPUT, 'w-full')}
					placeholder={t('pptx.action.slideNumberPlaceholder')}
					min={1}
					max={slideCount}
					value={(action?.slideIndex ?? fallbackSlideIndex ?? 0) + 1}
					onChange={(e) => {
						const idx = toSlideIndex(Number(e.target.value), slideCount);
						if (idx !== undefined) {
							onChangeSlide(idx);
						}
					}}
				/>
			)}
		</div>
	);
}
