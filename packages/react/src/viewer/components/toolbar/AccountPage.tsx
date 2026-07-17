import {
	AVATAR_COLOR_SWATCHES,
	DEFAULT_VIEWER_PROFILE,
	clearAllLocalViewerData,
	formatBackstageSize,
	getLocalStorageUsageSummary,
	readStoredViewerPrefs,
	resolveProfileInitial,
	saveViewerProfile,
} from 'pptx-viewer-shared';
import type { LocalStorageUsageSummary, ViewerProfile } from 'pptx-viewer-shared';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuHardDrive, LuInfo, LuLogIn, LuUser } from 'react-icons/lu';

import { cn } from '../../utils';
import { AccountAuthContext } from './account-auth-context';

const cardClass = 'border border-border bg-card p-6 text-card-foreground';

/**
 * File > Account: profile editor, local storage/privacy panel, app info, and
 * an opt-in sign-in section gated behind `PowerPointViewerProps.accountAuth`.
 */
export function AccountPage(): React.ReactElement {
	const { t } = useTranslation();
	const accountAuth = useContext(AccountAuthContext);

	const [profile, setProfile] = useState<ViewerProfile>(
		() => readStoredViewerPrefs().profile ?? DEFAULT_VIEWER_PROFILE,
	);
	const updateProfile = (patch: Partial<ViewerProfile>) => {
		const next = { ...profile, ...patch };
		setProfile(next);
		saveViewerProfile(next);
	};

	const [usage, setUsage] = useState<LocalStorageUsageSummary | null>(null);
	const [cleared, setCleared] = useState(false);
	const refreshUsage = () => {
		void getLocalStorageUsageSummary().then(setUsage);
	};
	useEffect(refreshUsage, []);

	const handleClear = () => {
		if (!window.confirm(t('pptx.account.storage.clearConfirm'))) {
			return;
		}
		void clearAllLocalViewerData().then(() => {
			setCleared(true);
			refreshUsage();
			setTimeout(() => setCleared(false), 4000);
			return undefined;
		});
	};

	const version =
		typeof __PPTX_PACKAGE_VERSION__ !== 'undefined' ? __PPTX_PACKAGE_VERSION__ : undefined;

	return (
		<div className='mt-8 max-w-[700px] space-y-6'>
			{/* Profile */}
			<section className={cardClass}>
				<h2 className='flex items-center gap-2 text-sm font-semibold'>
					<LuUser className='text-primary' /> {t('pptx.account.profile.title')}
				</h2>
				<div className='mt-4 flex items-center gap-4'>
					<span
						className='grid size-14 shrink-0 place-items-center rounded-full text-xl font-semibold text-white'
						style={{ background: profile.avatarColor }}
					>
						{resolveProfileInitial(profile)}
					</span>
					<div className='min-w-0 flex-1'>
						<label htmlFor='pptx-account-name' className='text-xs text-muted-foreground'>
							{t('pptx.account.profile.nameLabel')}
						</label>
						<input
							id='pptx-account-name'
							type='text'
							value={profile.displayName}
							onChange={(e) => updateProfile({ displayName: e.target.value })}
							placeholder={t('pptx.account.profile.namePlaceholder')}
							className='mt-1 h-9 w-full border border-input bg-background px-3 text-sm outline-none focus:border-ring'
						/>
					</div>
				</div>
				<p className='mt-4 text-xs text-muted-foreground'>
					{t('pptx.account.profile.avatarColorLabel')}
				</p>
				<div className='mt-2 flex gap-2'>
					{AVATAR_COLOR_SWATCHES.map((color) => (
						<button
							key={color}
							type='button'
							aria-label={color}
							aria-pressed={profile.avatarColor === color}
							onClick={() => updateProfile({ avatarColor: color })}
							className={cn(
								'size-7 rounded-full border-2 transition-transform',
								profile.avatarColor === color
									? 'border-foreground scale-110'
									: 'border-transparent hover:scale-105',
							)}
							style={{ background: color }}
						/>
					))}
				</div>
			</section>

			{/* Storage & Privacy */}
			<section className={cardClass}>
				<h2 className='flex items-center gap-2 text-sm font-semibold'>
					<LuHardDrive className='text-primary' /> {t('pptx.account.storage.title')}
				</h2>
				<p className='mt-3 text-sm text-muted-foreground'>
					{usage && usage.presentationCount > 0
						? t('pptx.account.storage.usage', {
								count: usage.presentationCount,
								size: formatBackstageSize(usage.totalBytes),
							})
						: t('pptx.account.storage.usageEmpty')}
				</p>
				<p className='mt-3 text-xs leading-5 text-muted-foreground'>
					{t('pptx.account.storage.privacyBlurb')}
				</p>
				<button
					type='button'
					onClick={handleClear}
					className='mt-4 border border-destructive/40 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10'
				>
					{t('pptx.account.storage.clear')}
				</button>
				{cleared && (
					<p className='mt-2 text-xs text-primary'>{t('pptx.account.storage.clearedNotice')}</p>
				)}
			</section>

			{/* About */}
			<section className={cardClass}>
				<h2 className='flex items-center gap-2 text-sm font-semibold'>
					<LuInfo className='text-primary' /> {t('pptx.account.about.title')}
				</h2>
				<p className='mt-3 text-sm text-muted-foreground'>
					pptx-react-viewer{version ? ` · ${t('pptx.account.about.version', { version })}` : ''}
				</p>
			</section>

			{/* Sign-in (opt-in, disabled by default) */}
			{accountAuth?.enabled && (
				<section className={cardClass}>
					<h2 className='flex items-center gap-2 text-sm font-semibold'>
						<LuLogIn className='text-primary' /> {t('pptx.account.signIn.title')}
					</h2>
					{accountAuth.signedInUser ? (
						<p className='mt-3 text-sm text-muted-foreground'>
							{t('pptx.account.signIn.signedInAs', { name: accountAuth.signedInUser.name })}
						</p>
					) : (
						<>
							<p className='mt-3 text-sm text-muted-foreground'>
								{t('pptx.account.signIn.description')}
							</p>
							<button
								type='button'
								onClick={accountAuth.onSignIn}
								className='mt-4 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90'
							>
								{t('pptx.account.signIn.button')}
							</button>
						</>
					)}
				</section>
			)}
		</div>
	);
}
