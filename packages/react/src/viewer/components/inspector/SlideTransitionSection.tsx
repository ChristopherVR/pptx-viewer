/**
 * SlideTransitionSection: the SLIDE TRANSITION card of the no-selection
 * inspector, rendered by `PresentationPropertiesPanel` immediately after SLIDE
 * SIZE so React sits where Angular, Svelte and Vanilla already put it.
 *
 * WHY the conditional controls: OOXML overloads a transition's `dir`
 * attribute. Most types take a compass token, the blinds/checker/comb/randomBar
 * family takes `horz`/`vert`, and `wheel` takes a spoke count instead.
 * `TRANSITION_VALID_DIRECTIONS` (core) and `TRANSITION_ORIENTATION_TYPES`
 * (shared) decide which control applies, so the card never offers a direction
 * PowerPoint would drop on save.
 *
 * WHY the shared clamp: `clampTransitionNumber` rounds every binding's typed
 * duration / spoke count the same way, so the same gesture in React and in
 * Angular stores the same number.
 */
import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { TRANSITION_VALID_DIRECTIONS } from 'pptx-viewer-core';
import {
	clampTransitionNumber,
	TRANSITION_MORPH_OPTIONS,
	TRANSITION_ORIENTATION_TYPES,
	TRANSITION_SPEED_OPTIONS,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SLIDE_TRANSITION_OPTIONS } from '../../constants';
import { DirectionPicker } from './DirectionPicker';
import { TransitionPreview } from './TransitionPreview';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlideTransitionSectionProps {
	activeSlide: { transition?: PptxSlideTransition } | null;
	/** Disables every control when the viewer is not in an editable mode. */
	canEdit?: boolean;
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
}

/** Default duration (ms) shown when the slide declares no transition timing. */
const DEFAULT_DURATION_MS = 320;
const MAX_DURATION_MS = 10000;
const MIN_SPOKES = 1;
const MAX_SPOKES = 8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideTransitionSection({
	activeSlide,
	canEdit = true,
	onTransitionChange,
}: SlideTransitionSectionProps): React.ReactElement | null {
	const { t } = useTranslation();

	if (!activeSlide) {
		return null;
	}

	const transitionType: PptxTransitionType = activeSlide.transition?.type ?? 'none';
	const validDirections = TRANSITION_VALID_DIRECTIONS[transitionType];
	const hasDirections = validDirections !== undefined && validDirections.length > 0;
	const usesOrientation = TRANSITION_ORIENTATION_TYPES.has(transitionType);
	const isWheel = transitionType === 'wheel';
	const isMorph = transitionType === 'morph';

	return (
		<div
			className='mb-3 rounded border border-border bg-card p-2 space-y-2'
			data-pptx-slide-transition
		>
			<div className='text-[11px] uppercase tracking-wide text-muted-foreground'>
				{t('pptx.slideInspector.slideTransition')}
			</div>

			{/* Type */}
			<label className='flex flex-col gap-1'>
				<span className='text-muted-foreground text-xs'>{t('pptx.transition.type')}</span>
				<select
					value={activeSlide.transition?.type || 'none'}
					disabled={!canEdit}
					aria-label={t('pptx.transition.type')}
					onChange={(e) =>
						onTransitionChange({
							type: e.target.value as NonNullable<PptxSlideTransition['type']>,
						})
					}
					className='bg-muted border border-border rounded px-2 py-1'
				>
					{SLIDE_TRANSITION_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{t(option.i18nKey)}
						</option>
					))}
				</select>
			</label>

			{/* Direction picker */}
			{hasDirections && !usesOrientation && (
				<div className='space-y-1'>
					<span className='text-muted-foreground text-xs'>{t('pptx.transition.direction')}</span>
					<DirectionPicker
						directions={validDirections}
						value={activeSlide.transition?.direction}
						disabled={!canEdit}
						onChange={(dir) => onTransitionChange({ direction: dir })}
					/>
				</div>
			)}

			{/* Orientation picker */}
			{usesOrientation && (
				<div className='space-y-1'>
					<span className='text-muted-foreground text-xs'>{t('pptx.transition.orientation')}</span>
					<div className='flex gap-1'>
						{(['horz', 'vert'] as const).map((o) => (
							<button
								key={o}
								type='button'
								disabled={!canEdit}
								onClick={() => onTransitionChange({ orient: o })}
								className={`px-2 py-1 rounded text-xs border ${
									(activeSlide.transition?.orient ?? 'horz') === o
										? 'bg-primary text-white border-primary'
										: 'bg-muted border-border hover:bg-accent'
								}`}
							>
								{t(
									o === 'horz' ? 'pptx.slideInspector.horizontal' : 'pptx.slideInspector.vertical',
								)}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Spokes for wheel */}
			{isWheel && (
				<label className='flex flex-col gap-1'>
					<span className='text-muted-foreground text-xs'>{t('pptx.transition.spokes')}</span>
					<input
						type='number'
						min={MIN_SPOKES}
						max={MAX_SPOKES}
						disabled={!canEdit}
						value={activeSlide.transition?.spokes ?? 4}
						onChange={(e) => {
							const spokes = clampTransitionNumber(Number(e.target.value), MIN_SPOKES, MAX_SPOKES);
							if (spokes !== null) {
								onTransitionChange({ spokes });
							}
						}}
						className='bg-muted border border-border rounded px-2 py-1 text-xs w-16'
					/>
				</label>
			)}

			{/* Duration */}
			<label className='flex flex-col gap-1'>
				<span className='text-muted-foreground text-xs'>{t('pptx.transition.duration')}</span>
				<input
					type='number'
					min={0}
					max={MAX_DURATION_MS}
					disabled={!canEdit}
					aria-label={t('pptx.transition.duration')}
					value={Math.round(activeSlide.transition?.durationMs || DEFAULT_DURATION_MS)}
					onChange={(e) => {
						const durationMs = clampTransitionNumber(Number(e.target.value), 0, MAX_DURATION_MS);
						if (durationMs !== null) {
							onTransitionChange({ durationMs });
						}
					}}
					className='bg-muted border border-border rounded px-2 py-1'
				/>
			</label>

			{/* Speed */}
			<label className='flex flex-col gap-1'>
				<span className='text-muted-foreground text-xs'>{t('pptx.transition.speed')}</span>
				<select
					value={activeSlide.transition?.speed ?? 'fast'}
					disabled={!canEdit}
					aria-label={t('pptx.transition.speed')}
					onChange={(e) =>
						onTransitionChange({
							speed: e.target.value as NonNullable<PptxSlideTransition['speed']>,
						})
					}
					className='bg-muted border border-border rounded px-2 py-1'
				>
					{TRANSITION_SPEED_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{t(option.i18nKey)}
						</option>
					))}
				</select>
			</label>

			{/* Morph granularity */}
			{isMorph && (
				<label className='flex flex-col gap-1'>
					<span className='text-muted-foreground text-xs'>{t('pptx.transition.morphOption')}</span>
					<select
						value={activeSlide.transition?.morphOption ?? 'byObject'}
						disabled={!canEdit}
						aria-label={t('pptx.transition.morphOption')}
						onChange={(e) =>
							onTransitionChange({
								morphOption: e.target.value as NonNullable<PptxSlideTransition['morphOption']>,
							})
						}
						className='bg-muted border border-border rounded px-2 py-1'
					>
						{TRANSITION_MORPH_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{t(option.i18nKey)}
							</option>
						))}
					</select>
				</label>
			)}

			{/* Advance on click */}
			<label className='inline-flex items-center gap-2 text-foreground text-xs'>
				<input
					type='checkbox'
					disabled={!canEdit}
					checked={activeSlide.transition?.advanceOnClick !== false}
					onChange={(e) => onTransitionChange({ advanceOnClick: e.target.checked })}
				/>
				{t('pptx.transition.advanceOnClick')}
			</label>

			{/* Sound */}
			{activeSlide.transition?.soundFileName && (
				<div className='flex items-center gap-1 text-xs text-muted-foreground'>
					<span className='text-muted-foreground'>{t('pptx.transition.sound')}:</span>
					<span className='text-foreground truncate' title={activeSlide.transition.soundFileName}>
						{activeSlide.transition.soundFileName}
					</span>
				</div>
			)}

			{/* Preview */}
			{activeSlide.transition && <TransitionPreview transition={activeSlide.transition} />}
		</div>
	);
}
