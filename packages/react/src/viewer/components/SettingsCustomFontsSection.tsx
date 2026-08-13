import { CUSTOM_FONT_ACCEPT, registerCustomFont } from 'pptx-viewer-shared';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuUpload } from 'react-icons/lu';

export interface SettingsCustomFontsSectionProps {
	/** Mirrors `general.enableCustomFontUpload`; the picker stays inert when off. */
	enabled: boolean;
	/** Families registered so far this session. */
	families: readonly string[];
	/** Notifies the viewer so the Home tab font list picks the family up. */
	onRegistered: (family: string) => void;
}

/**
 * File &gt; Options &gt; General &gt; Fonts.
 *
 * Lets the user hand a local font file to the viewer so a deck authored with
 * a font the browser lacks renders with the real face instead of a substitute.
 * Opt-in, and deliberately session-scoped: the file is added to the page's
 * font set and nothing is uploaded or written into the presentation.
 */
export function SettingsCustomFontsSection({
	enabled,
	families,
	onRegistered,
}: SettingsCustomFontsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const inputRef = useRef<HTMLInputElement>(null);
	const [error, setError] = useState(false);

	const handleFile = async (file: File): Promise<void> => {
		setError(false);
		try {
			const registration = await registerCustomFont(file);
			if (registration) {
				onRegistered(registration.family);
			} else {
				// Either the environment has no FontFace support, or the filename
				// reduced to nothing usable once its style tokens were stripped.
				setError(true);
			}
		} catch {
			setError(true);
		}
	};

	return (
		<div className='mt-2'>
			<button
				type='button'
				disabled={!enabled}
				onClick={() => inputRef.current?.click()}
				className='inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
			>
				<LuUpload className='h-3.5 w-3.5' />
				{t('pptx.options.general.addFontFile')}
			</button>
			<input
				ref={inputRef}
				type='file'
				accept={CUSTOM_FONT_ACCEPT}
				className='hidden'
				onChange={(event) => {
					const file = event.currentTarget.files?.[0];
					// Clear the value so re-picking the same file fires change again.
					event.currentTarget.value = '';
					if (file) {
						void handleFile(file);
					}
				}}
			/>

			{!enabled && (
				<p className='mt-2 text-xs text-muted-foreground'>
					{t('pptx.options.general.customFontsDisabled')}
				</p>
			)}
			{error && (
				<p role='alert' className='mt-2 text-xs text-destructive'>
					{t('pptx.options.general.customFontError')}
				</p>
			)}

			<p className='mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
				{t('pptx.options.general.customFontsAdded')}
			</p>
			{families.length === 0 ? (
				<p className='mt-1 text-xs text-muted-foreground'>
					{t('pptx.options.general.customFontsEmpty')}
				</p>
			) : (
				<ul className='mt-1 flex flex-col gap-0.5'>
					{families.map((family) => (
						<li key={family} className='text-xs text-foreground' style={{ fontFamily: family }}>
							{family}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
