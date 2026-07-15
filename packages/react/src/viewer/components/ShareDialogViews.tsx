import { useTranslation } from 'react-i18next';
import { LuWifiOff } from 'react-icons/lu';

/** Form for configuring a new collaboration session. */
export function StartSessionForm({
	mode,
	invitation,
	roomId,
	userName,
	serverUrl,
	onRoomIdChange,
	onUserNameChange,
	onServerUrlChange,
	onModeChange,
	onInvitationChange,
	preconfigured,
	connectionFailed,
	onRetry,
}: {
	mode: 'create' | 'join';
	invitation: string;
	roomId: string;
	userName: string;
	serverUrl: string;
	onRoomIdChange: (v: string) => void;
	onUserNameChange: (v: string) => void;
	onServerUrlChange: (v: string) => void;
	onModeChange: (mode: 'create' | 'join') => void;
	onInvitationChange: (value: string) => void;
	preconfigured?: boolean;
	/** True when the last connection attempt ended in an error. */
	connectionFailed?: boolean;
	/** Retry the failed connection (provided by the collaboration context). */
	onRetry?: () => void;
}) {
	const { t } = useTranslation();
	const inputReadOnlyClass = preconfigured ? ' opacity-70 cursor-not-allowed' : '';

	return (
		<div className='space-y-4'>
			<div className='grid grid-cols-2 gap-1 rounded-lg bg-muted p-1' role='tablist'>
				{(['create', 'join'] as const).map((candidate) => (
					<button
						key={candidate}
						type='button'
						role='tab'
						aria-selected={mode === candidate}
						onClick={() => onModeChange(candidate)}
						className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${mode === candidate ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
					>
						{t(candidate === 'create' ? 'pptx.share.createSession' : 'pptx.share.joinSession')}
					</button>
				))}
			</div>
			<p className='text-[13px] text-muted-foreground leading-relaxed'>
				{mode === 'join'
					? t('pptx.share.joinDescription')
					: preconfigured
						? t('pptx.share.preconfiguredDescription')
						: t('pptx.share.description')}
			</p>

			{/* Connection error banner: surfaced when a previous attempt failed
			    (e.g. unreachable server, or a blocked ws:// socket on an https
			    page). Keeps the failure visible instead of silently resetting. */}
			{connectionFailed && (
				<div
					role='alert'
					className='flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-400'
				>
					<LuWifiOff className='w-4 h-4 mt-0.5 shrink-0' />
					<div className='flex-1 space-y-1'>
						<p className='font-medium'>{t('pptx.share.connectionError')}</p>
						{onRetry && (
							<button
								type='button'
								onClick={onRetry}
								className='underline underline-offset-2 hover:no-underline'
							>
								{t('pptx.collaboration.retry')}
							</button>
						)}
					</div>
				</div>
			)}

			{mode === 'join' ? (
				<div className='space-y-1.5'>
					<label
						htmlFor='share-invitation'
						className='block text-[12px] font-medium text-foreground'
					>
						{t('pptx.share.invitationLabel')}
					</label>
					<input
						id='share-invitation'
						type='text'
						value={invitation}
						onChange={(event) => onInvitationChange(event.target.value)}
						placeholder={t('pptx.share.invitationPlaceholder')}
						className='w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'
					/>
					<p className='text-[11px] text-muted-foreground'>{t('pptx.share.invitationHint')}</p>
				</div>
			) : (
				<div className='space-y-1.5'>
					<label htmlFor='share-room-id' className='block text-[12px] font-medium text-foreground'>
						{t('pptx.share.sessionName')}
					</label>
					<input
						id='share-room-id'
						type='text'
						aria-label={t('pptx.share.sessionName')}
						value={roomId}
						onChange={(e) => onRoomIdChange(e.target.value)}
						readOnly={preconfigured}
						placeholder={t('pptx.share.sessionPlaceholder')}
						className={`w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary${inputReadOnlyClass}`}
					/>
					<p className='text-[11px] text-muted-foreground'>{t('pptx.share.sessionHint')}</p>
				</div>
			)}

			{/* User Display Name */}
			<div className='space-y-1.5'>
				<label htmlFor='share-user-name' className='block text-[12px] font-medium text-foreground'>
					{t('pptx.share.displayName')}
				</label>
				<input
					id='share-user-name'
					type='text'
					aria-label={t('pptx.share.displayName')}
					value={userName}
					onChange={(e) => onUserNameChange(e.target.value)}
					readOnly={preconfigured}
					placeholder={t('pptx.share.namePlaceholder')}
					className={`w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary${inputReadOnlyClass}`}
				/>
			</div>

			{/* Server URL is also the fallback when joining with a bare room ID. */}
			<div className='space-y-1.5'>
				<label htmlFor='share-server-url' className='block text-[12px] font-medium text-foreground'>
					{t('pptx.share.serverLabel')}
				</label>
				<input
					id='share-server-url'
					type='text'
					aria-label={t('pptx.share.serverLabel')}
					value={serverUrl}
					onChange={(e) => onServerUrlChange(e.target.value)}
					readOnly={preconfigured}
					placeholder={t('pptx.share.serverPlaceholder')}
					className={`w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary${inputReadOnlyClass}`}
				/>
			</div>

			{/* Server hint: blank server switches to serverless peer-to-peer mode. */}
			<p className='text-[11px] text-muted-foreground'>
				{serverUrl.trim().length === 0 ? t('pptx.share.p2pHint') : t('pptx.share.serverHint')}
			</p>
		</div>
	);
}

/** View shown when a collaboration session is active. */
