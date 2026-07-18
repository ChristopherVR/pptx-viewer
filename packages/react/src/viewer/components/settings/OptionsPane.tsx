import type {
	ViewerOptions,
	ViewerOptionsControl,
	ViewerOptionsSection,
	ViewerOptionsTabDefinition,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuInfo } from 'react-icons/lu';

import { cn } from '../../utils';

export type OptionChangeHandler = (
	group: keyof ViewerOptions,
	key: string,
	value: boolean | number | string,
) => void;

export interface OptionsPaneProps {
	tab: ViewerOptionsTabDefinition;
	options: ViewerOptions;
	onOptionChange: OptionChangeHandler;
	/** Bespoke blocks (theme picker, clear-cache, shortcut list) keyed by `section.special`. */
	renderSpecial?: (section: ViewerOptionsSection) => React.ReactNode;
	/** Extra content rendered after the generic sections (custom panes). */
	children?: React.ReactNode;
}

function readValue(
	options: ViewerOptions,
	control: ViewerOptionsControl,
): boolean | number | string | undefined {
	const group = options[control.group] as unknown as Record<string, unknown>;
	const value = group[control.key];
	return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
		? value
		: undefined;
}

function InfoTip({ text }: { text: string }): React.ReactElement {
	return (
		<span title={text} className='inline-flex cursor-help align-middle'>
			<LuInfo className='ml-1 h-3.5 w-3.5 text-primary/70' aria-label={text} />
		</span>
	);
}

function ControlRow({
	control,
	options,
	onOptionChange,
}: {
	control: ViewerOptionsControl;
	options: ViewerOptions;
	onOptionChange: OptionChangeHandler;
}): React.ReactElement | null {
	const { t } = useTranslation();
	const value = readValue(options, control);
	const label = t(control.labelKey);
	const info = control.infoKey ? <InfoTip text={t(control.infoKey)} /> : null;
	const rowClass = cn('flex items-center justify-between gap-3 py-1.5', control.indent && 'pl-6');

	if (control.kind === 'toggle') {
		return (
			<label className={cn(rowClass, 'cursor-pointer select-none')}>
				<span className='text-sm text-foreground'>
					{label}
					{info}
				</span>
				<input
					type='checkbox'
					className='h-4 w-4 shrink-0 accent-[var(--pptx-primary,#6366f1)]'
					checked={value === true}
					onChange={(event) => onOptionChange(control.group, control.key, event.target.checked)}
				/>
			</label>
		);
	}

	if (control.kind === 'select') {
		return (
			<div className={rowClass}>
				<span className='text-sm text-foreground'>
					{label}
					{info}
				</span>
				<select
					aria-label={label}
					className='max-w-[55%] rounded border border-border bg-background px-2 py-1 text-xs text-foreground'
					value={typeof value === 'string' ? value : ''}
					onChange={(event) => onOptionChange(control.group, control.key, event.target.value)}
				>
					{control.choices.map((choice) => (
						<option key={choice.value} value={choice.value}>
							{t(choice.labelKey)}
						</option>
					))}
				</select>
			</div>
		);
	}

	if (control.kind === 'number') {
		return (
			<div className={rowClass}>
				<span className='text-sm text-foreground'>
					{label}
					{info}
				</span>
				<span className='flex items-center gap-1.5'>
					<input
						type='number'
						aria-label={label}
						className='w-20 rounded border border-border bg-background px-2 py-1 text-right text-xs text-foreground'
						min={control.min}
						max={control.max}
						step={control.step ?? 1}
						value={typeof value === 'number' ? value : control.min}
						onChange={(event) => {
							const parsed = Number(event.target.value);
							if (Number.isFinite(parsed)) {
								onOptionChange(
									control.group,
									control.key,
									Math.min(control.max, Math.max(control.min, parsed)),
								);
							}
						}}
					/>
					{control.unitKey && (
						<span className='text-xs text-muted-foreground'>{t(control.unitKey)}</span>
					)}
				</span>
			</div>
		);
	}

	return (
		<div className={rowClass}>
			<span className='text-sm text-foreground'>
				{label}
				{info}
			</span>
			<input
				type='text'
				aria-label={label}
				className='w-48 max-w-[55%] rounded border border-border bg-background px-2 py-1 text-xs text-foreground'
				maxLength={control.maxLength}
				value={typeof value === 'string' ? value : ''}
				onChange={(event) => onOptionChange(control.group, control.key, event.target.value)}
			/>
		</div>
	);
}

/**
 * Generic File > Options pane: headline plus sections of schema-driven
 * controls, with `renderSpecial` slots for the bespoke blocks.
 */
export function OptionsPane({
	tab,
	options,
	onOptionChange,
	renderSpecial,
	children,
}: OptionsPaneProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='space-y-5'>
			<p className='text-sm font-medium text-foreground'>{t(tab.descriptionKey)}</p>
			{tab.sections.map((section) => (
				<section key={section.id}>
					<h3 className='mb-1 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
						{t(section.titleKey)}
					</h3>
					{section.descriptionKey && (
						<p className='mb-2 text-xs text-muted-foreground'>{t(section.descriptionKey)}</p>
					)}
					<div className='space-y-0.5'>
						{section.controls.map((control) => (
							<ControlRow
								key={`${control.group}.${control.key}.${section.id}`}
								control={control}
								options={options}
								onOptionChange={onOptionChange}
							/>
						))}
					</div>
					{section.special && renderSpecial?.(section)}
				</section>
			))}
			{children}
		</div>
	);
}
