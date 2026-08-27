import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
import {
	applyTransitionSoundFile,
	clearTransitionSound,
	playSlideTransitionPreview,
	readRibbonTransitionDraft,
	readSoundFileAsDataUrl,
	RIBBON_TRANSITION_PRESETS,
	ribbonTransitionUpdates,
	TRANSITION_SOUND_NONE_VALUE,
	TRANSITION_SOUND_OTHER_VALUE,
	transitionSoundOptions,
	transitionSoundSelectedValue,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuPanelRight, LuPlay } from 'react-icons/lu';

import { cn } from '../../utils';
import { ic, ics, pill, sep } from './toolbar-constants';

/**
 * The Transitions ribbon tab.
 *
 * Every control here used to be `React.useState`: the gallery highlighted the
 * clicked preset, the duration field accepted a number, "Apply to All" had no
 * `onClick` at all, and the saved `.pptx` carried no `p:transition`. The
 * callbacks existed one level up (`ViewerToolbarSection` computes
 * `handleTransitionChange` / `handleApplyTransitionToAll` and `toolbar-types`
 * declares them REQUIRED) and `Toolbar` simply dropped them on the floor.
 *
 * The tab now holds no transition state of its own: `readRibbonTransitionDraft`
 * derives what each control shows from the ACTIVE SLIDE, and every change
 * commits `ribbonTransitionUpdates` through `onTransitionChange`. That is what
 * keeps the tab honest across slide navigation, and it is the same shared
 * decision function the other four bindings use.
 */
export interface TransitionsSectionProps {
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	/** The slide whose transition the tab reads and writes. */
	activeSlide?: PptxSlide;
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
	onApplyTransitionToAll: () => void;
	canEdit?: boolean;
}

export function TransitionsSection(p: TransitionsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const canEdit = p.canEdit !== false;
	const draft = React.useMemo(() => readRibbonTransitionDraft(p.activeSlide), [p.activeSlide]);
	// Each text field shows the model's value EXCEPT while it is being typed
	// into, so a half-typed "1." is not immediately reformatted back at the user.
	const [durationBuffer, setDurationBuffer] = React.useState<string | null>(null);
	const [advanceBuffer, setAdvanceBuffer] = React.useState<string | null>(null);

	const commit = React.useCallback(
		(changes: Partial<RibbonTransitionDraft>) => {
			p.onTransitionChange(ribbonTransitionUpdates({ ...draft, ...changes }));
		},
		[draft, p],
	);

	// The Sound picker's file input: hidden, and clicked programmatically by
	// the "Other Sound..." entry. `onTransitionChange` is generic (a raw
	// `Partial<PptxSlideTransition>`), so a sound pick bypasses the draft
	// entirely instead of going through `commit`.
	const soundFileInputRef = React.useRef<HTMLInputElement>(null);
	const handleSoundFilePicked = React.useCallback(
		(file: File) => {
			void readSoundFileAsDataUrl(file).then((dataUrl) => {
				if (dataUrl) {
					p.onTransitionChange(applyTransitionSoundFile({ name: file.name, dataUrl }));
				}
				return undefined;
			});
		},
		[p],
	);
	const handleSoundSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const value = event.target.value;
		if (value === TRANSITION_SOUND_OTHER_VALUE) {
			soundFileInputRef.current?.click();
			// The file input's own change (or a cancelled dialog) decides what
			// happens next; put the select back to what the slide actually has.
			event.target.value = transitionSoundSelectedValue(p.activeSlide?.transition);
			return;
		}
		if (value === TRANSITION_SOUND_NONE_VALUE) {
			p.onTransitionChange(clearTransitionSound());
		}
	};

	return (
		<>
			{/* Preview: REPLAYS the slide's transition on the editing stage through
			    the shared `playSlideTransitionPreview`, and writes nothing. It used
			    to re-commit the slide's own transition, which puts back the values
			    the slide already had: an edit with no visible effect, and one no
			    test could tell apart from the dead button Vanilla shipped. */}
			<button
				type='button'
				className={pill}
				title={t('pptx.ribbon.previewTransition')}
				onClick={() => playSlideTransitionPreview(p.activeSlide?.transition, document)}
			>
				<LuPlay className={ics} />
				{t('pptx.ribbon.preview')}
			</button>

			{sep}

			{/* Transition preset gallery */}
			<div className='inline-flex items-center gap-0.5 overflow-x-auto max-w-[420px]'>
				{RIBBON_TRANSITION_PRESETS.map((preset) => (
					<button
						key={preset.type}
						type='button'
						disabled={!canEdit}
						onClick={() => commit({ type: preset.type })}
						className={cn(
							'flex-shrink-0 px-2 py-1 max-md:min-h-[44px] rounded border text-[11px] leading-tight transition-colors',
							draft.type === preset.type
								? 'border-primary bg-primary/10 text-primary font-medium'
								: 'border-border bg-muted hover:bg-accent text-foreground',
						)}
						title={t('pptx.ribbon.transitionTitle', { name: t(preset.labelKey) })}
					>
						{t(preset.labelKey)}
					</button>
				))}
			</div>

			{sep}

			{/* Duration */}
			<label className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
				<span className='whitespace-nowrap'>{t('pptx.ribbon.duration')}</span>
				<input
					type='number'
					min={0}
					max={20}
					step={0.25}
					disabled={!canEdit}
					value={durationBuffer ?? String(draft.durationSec)}
					onChange={(e) => {
						setDurationBuffer(e.target.value);
						const seconds = Number(e.target.value);
						if (Number.isFinite(seconds) && e.target.value !== '') {
							commit({ durationSec: seconds });
						}
					}}
					onBlur={() => setDurationBuffer(null)}
					className='w-16 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground text-center'
					title={t('pptx.ribbon.transitionDurationTitle')}
				/>
			</label>

			{sep}

			{/* Sound: "Other Sound..." opens a native file picker and the chosen
			    file is embedded into the package on save (`embedTransitionSound`,
			    packages/core). "None" clears any sound the slide carries. */}
			<label className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
				<span className='whitespace-nowrap'>{t('pptx.ribbon.sound')}</span>
				<select
					aria-label={t('pptx.ribbon.sound')}
					className='w-24 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground disabled:opacity-50'
					disabled={!canEdit}
					value={transitionSoundSelectedValue(p.activeSlide?.transition)}
					onChange={handleSoundSelectChange}
				>
					{transitionSoundOptions(p.activeSlide?.transition).map((option) => (
						<option key={option.value} value={option.value}>
							{option.i18nKey ? t(option.i18nKey) : option.label}
						</option>
					))}
				</select>
				<input
					ref={soundFileInputRef}
					type='file'
					accept='audio/*'
					className='hidden'
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) {
							handleSoundFilePicked(file);
						}
						e.target.value = '';
					}}
				/>
			</label>

			{sep}

			{/* Apply to All */}
			<button
				type='button'
				disabled={!canEdit}
				className={pill}
				title={t('pptx.ribbon.applyTransitionToAll')}
				onClick={p.onApplyTransitionToAll}
			>
				<LuCopy className={ics} />
				{t('pptx.headerFooter.applyToAll')}
			</button>

			{sep}

			{/* Advance Slide group */}
			<div className='inline-flex flex-col gap-1 text-xs text-muted-foreground'>
				<span className='text-[10px] font-medium text-foreground'>
					{t('pptx.ribbon.advanceSlide')}
				</span>
				<label className='inline-flex items-center gap-1.5 cursor-pointer'>
					<input
						type='checkbox'
						disabled={!canEdit}
						checked={draft.advanceOnClick}
						onChange={(e) => commit({ advanceOnClick: e.target.checked })}
						className='accent-primary h-3 w-3'
					/>
					<span className='whitespace-nowrap'>{t('pptx.ribbon.onMouseClick')}</span>
				</label>
				{/* Two controls under one `<label>`: the label names only its FIRST
				    labelable descendant, so without these the seconds field had an
				    EMPTY accessible name and the checkbox took the field's value into
				    its own ("After 5 seconds"). Both are named explicitly instead. */}
				<label className='inline-flex items-center gap-1.5 cursor-pointer'>
					<input
						type='checkbox'
						aria-label={t('pptx.ribbon.afterDuration')}
						disabled={!canEdit}
						checked={draft.advanceAfter}
						onChange={(e) => commit({ advanceAfter: e.target.checked })}
						className='accent-primary h-3 w-3'
					/>
					<span className='whitespace-nowrap'>{t('pptx.ribbon.afterDuration')}</span>
					<input
						type='text'
						aria-label={t('pptx.ribbon.advanceAfterSeconds')}
						value={advanceBuffer ?? draft.advanceAfterText}
						onChange={(e) => {
							setAdvanceBuffer(e.target.value);
							commit({ advanceAfter: true, advanceAfterText: e.target.value });
						}}
						onBlur={() => setAdvanceBuffer(null)}
						disabled={!canEdit || !draft.advanceAfter}
						className='w-16 px-1 py-0.5 rounded border border-border bg-muted text-xs text-foreground text-center disabled:opacity-50'
						title={t('pptx.ribbon.advanceAfterSeconds')}
					/>
				</label>
			</div>

			{sep}

			{/* Inspector */}
			<button
				type='button'
				onClick={p.onToggleInspector}
				className={cn(
					pill,
					p.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
				)}
				title={t('pptx.ribbon.openInspectorTransitions')}
			>
				<LuPanelRight className={ic} />
				{t('pptx.ribbon.inspector')}
			</button>
		</>
	);
}
