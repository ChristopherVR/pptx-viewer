import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Black "End of slide show" screen shown after advancing past the last
 * slide when Options > Advanced > "End with black slide" is on. A click
 * (or the next forward advance) exits the presentation.
 */
export function PresentationEndOverlay({ onExit }: { onExit: () => void }): React.ReactElement {
	const { t } = useTranslation();
	return (
		<button
			type='button'
			data-pptx-end-of-show=''
			onClick={onExit}
			className='absolute inset-0 z-[90] flex cursor-default items-start bg-black text-left'
		>
			<span className='px-4 py-3 text-[12px] text-white/70'>
				{t('pptx.presentation.endOfSlideShow', 'End of slide show, click to exit.')}
			</span>
		</button>
	);
}
