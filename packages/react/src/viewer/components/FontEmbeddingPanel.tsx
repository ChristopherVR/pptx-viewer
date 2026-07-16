import { scanAvailableFontFamilies } from 'pptx-viewer-shared';
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuType, LuX, LuCheck, LuLoader } from 'react-icons/lu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FontEmbeddingPanelProps {
	isOpen: boolean;
	embedFontsEnabled: boolean;
	usedFontFamilies: string[];
	embeddedFonts: string[];
	onClose: () => void;
	onToggleEmbedFonts: (enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FontEmbeddingPanel({
	isOpen,
	embedFontsEnabled,
	usedFontFamilies,
	embeddedFonts,
	onClose,
	onToggleEmbedFonts,
}: FontEmbeddingPanelProps): React.ReactElement | null {
	const { t } = useTranslation();
	const [availableFamilies, setAvailableFamilies] = useState<Set<string>>(new Set());
	const [scanning, setScanning] = useState(false);
	const [scanned, setScanned] = useState(false);

	const scanFonts = useCallback(async () => {
		setScanning(true);
		try {
			setAvailableFamilies(await scanAvailableFontFamilies(usedFontFamilies));
			setScanned(true);
		} catch {
			// silently fail
		} finally {
			setScanning(false);
		}
	}, [usedFontFamilies]);

	useEffect(() => {
		if (isOpen && !scanned) {
			void scanFonts();
		}
	}, [isOpen, scanned, scanFonts]);

	if (!isOpen) {
		return null;
	}

	const missingFamilies = usedFontFamilies.filter((f) => !availableFamilies.has(f));
	const embeddedSet = new Set(embeddedFonts);

	return (
		<>
			{/* Backdrop */}
			<button
				type='button'
				style={{ zIndex: 1200 }}
				className='fixed inset-0 bg-black/60'
				aria-label={t('common.close')}
				onClick={onClose}
			/>
			{/* Dialog */}
			<div
				style={{ zIndex: 1201 }}
				className='fixed inset-0 flex items-center justify-center pointer-events-none'
			>
				<div className='pointer-events-auto w-[460px] max-h-[80vh] rounded-xl border border-border bg-popover backdrop-blur-xl shadow-2xl flex flex-col max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:max-h-[88dvh] max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'>
					{/* Header */}
					<div className='flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0'>
						<div className='flex items-center gap-2'>
							<LuType className='w-5 h-5 text-primary' />
							<h2 className='text-sm font-semibold text-foreground'>
								{t('pptx.fonts.embedFonts')}
							</h2>
						</div>
						<button
							type='button'
							onClick={onClose}
							className='p-1 rounded hover:bg-accent transition-colors'
							aria-label={t('common.close')}
						>
							<LuX className='w-4 h-4 text-muted-foreground' />
						</button>
					</div>

					{/* Body */}
					<div className='px-5 py-4 space-y-4 overflow-y-auto flex-1'>
						<p className='text-xs text-muted-foreground'>{t('pptx.fonts.embedDescription')}</p>

						{/* Toggle */}
						<label className='flex items-center gap-3 cursor-pointer'>
							<div className='relative'>
								<input
									type='checkbox'
									className='sr-only'
									checked={embedFontsEnabled}
									onChange={(e) => onToggleEmbedFonts(e.target.checked)}
								/>
								<div
									className={`w-9 h-5 rounded-full transition-colors ${
										embedFontsEnabled ? 'bg-primary' : 'bg-muted-foreground'
									}`}
								/>
								<div
									className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
										embedFontsEnabled ? 'translate-x-4' : ''
									}`}
								/>
							</div>
							<span className='text-xs text-foreground'>{t('pptx.fonts.enableEmbedding')}</span>
						</label>

						{/* Font list */}
						<div className='space-y-1'>
							<h3 className='text-xs font-medium text-foreground'>
								{t('pptx.fonts.usedFonts')} ({usedFontFamilies.length})
							</h3>
							{scanning ? (
								<div className='flex items-center gap-2 py-4 justify-center'>
									<LuLoader className='w-4 h-4 text-muted-foreground animate-spin' />
									<span className='text-xs text-muted-foreground'>{t('pptx.fonts.scanning')}</span>
								</div>
							) : (
								<div className='space-y-1 max-h-[280px] overflow-y-auto'>
									{usedFontFamilies.map((family) => {
										const found = availableFamilies.has(family);
										const embedded = embeddedSet.has(family);
										return (
											<div
												key={family}
												className='flex items-center justify-between px-3 py-2 rounded-lg bg-muted/60'
											>
												<span className='text-xs text-foreground'>{family}</span>
												<div className='flex items-center gap-2'>
													{embedded && (
														<span className='text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/40'>
															{t('pptx.fonts.embedded')}
														</span>
													)}
													{found ? (
														<LuCheck className='w-3.5 h-3.5 text-green-400' />
													) : (
														<span className='text-[10px] text-yellow-400'>
															{t('pptx.fonts.notFound')}
														</span>
													)}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{missingFamilies.length > 0 && !scanning && (
							<p className='text-[11px] text-yellow-400/80'>
								{t('pptx.fonts.missingWarning', {
									count: missingFamilies.length,
								})}
							</p>
						)}
					</div>

					{/* Footer */}
					<div className='flex items-center justify-end px-5 py-3 border-t border-border/60 shrink-0'>
						<button
							type='button'
							onClick={onClose}
							className='px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors'
						>
							{t('common.done')}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
