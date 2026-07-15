import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../utils';

interface LoadingStateProps {
	className?: string;
}

export function LoadingState({ className }: LoadingStateProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div
			role='status'
			aria-live='polite'
			aria-atomic='true'
			className={cn(
				'h-full w-full flex items-center justify-center text-muted-foreground',
				className,
			)}
		>
			<div className='flex items-center gap-2'>
				<div
					className='animate-spin rounded-full h-6 w-6 border-b-2 border-primary'
					aria-hidden='true'
				/>
				<span>{t('pptx.viewer.loading')}</span>
			</div>
		</div>
	);
}
