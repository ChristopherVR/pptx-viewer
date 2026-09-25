import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

function nowLocalInputValue(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export interface DateTimeFieldDialogProps {
	onClose: () => void;
	/** Insert the formatted date/time as a field. */
	onInsert: (formatted: string) => void;
}

/**
 * Insert > Field > Date & Time: pick a moment and a format. Mounted only
 * while open, so every opening starts from "now".
 */
export function DateTimeFieldDialog(p: DateTimeFieldDialogProps): React.ReactElement {
	const { t } = useTranslation();
	const [datePickerValue, setDatePickerValue] = useState(nowLocalInputValue);
	const [dateFormat, setDateFormat] = useState('locale');

	const confirmDatePicker = useCallback(() => {
		const d = new Date(datePickerValue);
		if (isNaN(d.getTime())) {
			return;
		}
		let formatted: string;
		switch (dateFormat) {
			case 'iso':
				formatted = d.toISOString().slice(0, 10);
				break;
			case 'long':
				formatted = d.toLocaleDateString(undefined, {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				});
				break;
			case 'short':
				formatted = d.toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				});
				break;
			case 'time':
				formatted = d.toLocaleString();
				break;
			default:
				formatted = d.toLocaleDateString();
				break;
		}
		p.onInsert(formatted);
	}, [datePickerValue, dateFormat, p]);

	return (
		<div
			className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/30'
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) {
					p.onClose();
				}
			}}
		>
			<div className='rounded-lg border border-border bg-popover shadow-2xl p-4 w-72 space-y-3'>
				<div className='text-sm font-medium text-foreground'>{t('pptx.field.dateTime')}</div>
				<input
					type='datetime-local'
					className='w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none'
					value={datePickerValue}
					onChange={(e) => setDatePickerValue(e.target.value)}
				/>
				<div>
					<label className='block text-[11px] text-muted-foreground mb-1'>
						{t('pptx.field.format', 'Format')}
					</label>
					<select
						className='w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none'
						value={dateFormat}
						onChange={(e) => setDateFormat(e.target.value)}
					>
						<option value='locale'>
							{new Date(datePickerValue || Date.now()).toLocaleDateString()}
						</option>
						<option value='long'>
							{new Date(datePickerValue || Date.now()).toLocaleDateString(undefined, {
								weekday: 'long',
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})}
						</option>
						<option value='short'>
							{new Date(datePickerValue || Date.now()).toLocaleDateString(undefined, {
								year: 'numeric',
								month: 'short',
								day: 'numeric',
							})}
						</option>
						<option value='iso'>
							{new Date(datePickerValue || Date.now()).toISOString().slice(0, 10)}
						</option>
						<option value='time'>{new Date(datePickerValue || Date.now()).toLocaleString()}</option>
					</select>
				</div>
				<div className='flex justify-end gap-2 pt-1'>
					<button
						type='button'
						className='px-3 py-1.5 text-xs rounded border border-border text-foreground hover:bg-muted transition-colors'
						onClick={() => p.onClose()}
					>
						{t('pptx.common.cancel', 'Cancel')}
					</button>
					<button
						type='button'
						className='px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors'
						onClick={confirmDatePicker}
					>
						{t('pptx.common.insert', 'Insert')}
					</button>
				</div>
			</div>
		</div>
	);
}
