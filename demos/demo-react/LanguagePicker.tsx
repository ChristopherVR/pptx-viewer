import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ViewerTheme } from '../../packages/react/src/theme';
import { languages } from './languages';

/**
 * Floating language picker, styled to match `ThemePicker` in `main.tsx`.
 *
 * Stacked directly above the theme picker (same fixed corner) rather than
 * beside it, so the two never collide regardless of how wide either button's
 * label happens to be.
 */
const pickerRoot = document.getElementById('language-picker-root')!;

export function LanguagePicker({
	current,
	onChange,
	theme,
}: {
	current: string;
	onChange: (code: string) => void;
	theme: { theme: ViewerTheme };
}) {
	const [open, setOpen] = useState(false);
	const [isSmallScreen, setIsSmallScreen] = useState(
		() => typeof window !== 'undefined' && window.innerWidth < 768,
	);
	useEffect(() => {
		const onResize = () => setIsSmallScreen(window.innerWidth < 768);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const bg = theme.theme.colors?.card ?? '#111827';
	const border = theme.theme.colors?.border ?? '#374151';
	const fg = theme.theme.colors?.mutedForeground ?? '#9ca3af';
	const primary = theme.theme.colors?.primary ?? '#6366f1';

	const active = languages.find((language) => language.code === current) ?? languages[0];

	const picker = (
		<div
			style={{
				position: 'fixed',
				...(isSmallScreen
					? { top: 'calc(env(safe-area-inset-top, 0px) + 104px)', right: 8 }
					: { bottom: 92, right: 12 }),
				zIndex: open ? 100000 : 99999,
				fontFamily: 'system-ui, sans-serif',
			}}
		>
			<button
				onClick={() => setOpen(!open)}
				title='Switch language'
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 6,
					padding: '6px 12px',
					borderRadius: 9999,
					border: `1px solid ${border}`,
					background: bg,
					color: fg,
					cursor: 'pointer',
					fontSize: 13,
					fontWeight: 500,
					boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
				}}
			>
				<svg
					width='14'
					height='14'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='2'
					strokeLinecap='round'
					strokeLinejoin='round'
				>
					<circle cx='12' cy='12' r='10' />
					<path d='M2 12h20' />
					<path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z' />
				</svg>
				{active.label}
			</button>
			{open && (
				<div
					style={{
						position: 'absolute',
						...(isSmallScreen
							? { top: '100%', marginTop: 4 }
							: { bottom: '100%', marginBottom: 4 }),
						right: 0,
						background: bg,
						border: `1px solid ${border}`,
						borderRadius: 8,
						overflowY: 'auto',
						maxHeight: '60dvh',
						boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
						minWidth: 150,
					}}
				>
					{languages.map((language) => {
						const isActive = language.code === current;
						return (
							<button
								key={language.code}
								onClick={() => {
									onChange(language.code);
									setOpen(false);
								}}
								style={{
									display: 'flex',
									alignItems: 'center',
									width: '100%',
									padding: '8px 14px',
									border: 'none',
									background: isActive ? `${primary}22` : 'transparent',
									color: isActive ? primary : fg,
									cursor: 'pointer',
									fontSize: 13,
									fontWeight: isActive ? 600 : 400,
									textAlign: 'left',
								}}
							>
								{language.label}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);

	return createPortal(picker, pickerRoot);
}
