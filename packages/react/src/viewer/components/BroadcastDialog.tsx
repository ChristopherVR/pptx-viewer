import {
	DEFAULT_BROADCAST_SERVER_URL,
	buildBroadcastViewerUrl,
	generateBroadcastRoomId,
	resolveTransportForServerUrl,
} from 'pptx-viewer-shared';
/**
 * BroadcastDialog: Modal dialog for starting / managing a live broadcast.
 *
 * A broadcast is a collaboration session where the presenter (broadcaster)
 * shares their slide navigation and cursor with viewers in real-time.
 * Reuses the existing Yjs + WebSocket collaboration infrastructure.
 *
 * @module BroadcastDialog
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCast, LuCheck, LuCopy, LuUsers, LuWifi, LuWifiOff } from 'react-icons/lu';

import { useModalDismissDrag } from '../hooks';
import type { CollaborationConfig } from '../hooks/collaboration/types';
import { useModalFocus } from '../hooks/useModalFocus';
import { useCollaboration } from './collaboration';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for the {@link BroadcastDialog} component.
 */
export interface BroadcastDialogProps {
	/** Whether the dialog is currently visible. */
	open: boolean;
	/** Callback invoked when the user dismisses the dialog. */
	onClose: () => void;
	/** Callback to start a broadcast (creates a collaboration session). */
	onStartBroadcast?: (config: CollaborationConfig) => void;
	/** Callback to stop the active broadcast. */
	onStopBroadcast?: () => void;
	/** Callback to enter presentation mode after broadcast starts. */
	onStartPresenting?: () => void;
	/** Default room ID for the broadcast. */
	defaultRoomId?: string;
	/** Default user name. */
	defaultUserName?: string;
	/** Default server URL. */
	defaultServerUrl?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BroadcastDialog({
	open,
	onClose,
	onStartBroadcast,
	onStopBroadcast,
	onStartPresenting,
	defaultRoomId,
	defaultUserName,
	defaultServerUrl,
}: BroadcastDialogProps): React.ReactElement | null {
	const { t } = useTranslation();
	const collab = useCollaboration();
	const isBroadcasting =
		collab !== null &&
		collab.status !== 'disconnected' &&
		collab.status !== 'error' &&
		collab.config.role === 'owner';

	// Form state
	const [roomId, setRoomId] = useState('');
	const [userName, setUserName] = useState('');
	const [serverUrl, setServerUrl] = useState('');
	const [copied, setCopied] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);
	const { panelStyle, handlers: dragHandlers } = useModalDismissDrag(onClose);
	useModalFocus(open, dialogRef, onClose);

	// Sync defaults on open
	useEffect(() => {
		if (open && !isBroadcasting) {
			// Generate a broadcast-specific room ID
			const broadcastRoom = defaultRoomId
				? `broadcast-${defaultRoomId}`
				: generateBroadcastRoomId();
			setRoomId(broadcastRoom);
			setUserName(defaultUserName ?? '');
			setServerUrl(defaultServerUrl ?? DEFAULT_BROADCAST_SERVER_URL);
		}
	}, [open, isBroadcasting, defaultRoomId, defaultUserName, defaultServerUrl]);

	const activeRoomId = isBroadcasting ? collab.config.roomId : roomId;
	const activeServerUrl = isBroadcasting ? collab.config.serverUrl : serverUrl;
	const broadcastUrl =
		typeof window !== 'undefined'
			? buildBroadcastViewerUrl(activeRoomId, activeServerUrl, window.location)
			: activeRoomId;

	const handleCopyUrl = useCallback(() => {
		void navigator.clipboard.writeText(broadcastUrl).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			return undefined;
		});
	}, [broadcastUrl]);

	const handleStartBroadcast = useCallback(() => {
		if (!roomId.trim() || !userName.trim()) {
			return;
		}
		const trimmedServer = serverUrl.trim();
		onStartBroadcast?.({
			roomId: roomId.trim(),
			serverUrl: trimmedServer,
			userName: userName.trim(),
			role: 'owner',
			// A blank server broadcasts over the serverless peer-to-peer transport.
			transport: resolveTransportForServerUrl(trimmedServer),
		});
		// Enter presentation mode after a short delay for connection
		setTimeout(() => {
			onStartPresenting?.();
		}, 100);
		onClose();
	}, [roomId, userName, serverUrl, onStartBroadcast, onStartPresenting, onClose]);

	const handleStopBroadcast = useCallback(() => {
		onStopBroadcast?.();
		onClose();
	}, [onStopBroadcast, onClose]);

	// The server URL is optional: leaving it blank broadcasts peer-to-peer.
	const canStart = roomId.trim().length > 0 && userName.trim().length > 0;

	if (!open) {
		return null;
	}

	return (
		<>
			{/* Backdrop */}
			<button
				type='button'
				style={{ zIndex: 1200 }}
				className='fixed inset-0 bg-black/50'
				aria-label={t('pptx.share.closeDialog')}
				onClick={onClose}
			/>

			{/* Dialog */}
			<div
				style={{ zIndex: 1201 }}
				className='fixed inset-0 flex items-center justify-center pointer-events-none'
			>
				<div
					ref={dialogRef}
					role='dialog'
					aria-modal='true'
					aria-label={t('pptx.broadcast.title')}
					tabIndex={-1}
					style={panelStyle}
					className='pointer-events-auto w-full max-w-md rounded-xl border border-border bg-popover text-foreground shadow-2xl outline-none max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-w-none max-md:max-h-[88dvh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'
				>
					{/* Header — also a swipe-down-to-dismiss grab region on touch. */}
					<div
						{...dragHandlers}
						className='flex items-center justify-between px-5 py-3 border-b border-border touch-none'
					>
						<h2 className='text-sm font-semibold text-foreground flex items-center gap-2'>
							<LuCast className='w-4 h-4' />
							{isBroadcasting ? t('pptx.broadcast.broadcasting') : t('pptx.broadcast.title')}
						</h2>
						<button
							type='button'
							onClick={onClose}
							className='text-muted-foreground hover:text-foreground text-lg leading-none'
							aria-label={t('pptx.common.close')}
						>
							&times;
						</button>
					</div>

					{/* Body */}
					<div className='px-5 py-4'>
						{isBroadcasting ? (
							<ActiveBroadcastView
								collab={collab}
								broadcastUrl={broadcastUrl}
								copied={copied}
								onCopyUrl={handleCopyUrl}
								onStopBroadcast={handleStopBroadcast}
							/>
						) : (
							<StartBroadcastForm
								roomId={roomId}
								userName={userName}
								serverUrl={serverUrl}
								onRoomIdChange={setRoomId}
								onUserNameChange={setUserName}
								onServerUrlChange={setServerUrl}
							/>
						)}
					</div>

					{/* Footer */}
					{!isBroadcasting && (
						<div className='flex justify-end gap-2 px-5 py-3 border-t border-border'>
							<button
								type='button'
								onClick={onClose}
								className='px-3 py-1.5 rounded bg-muted hover:bg-accent text-[12px] text-foreground transition-colors'
							>
								{t('common.close')}
							</button>
							<button
								type='button'
								disabled={!canStart}
								onClick={handleStartBroadcast}
								className='px-3 py-1.5 rounded bg-primary hover:bg-primary/90 text-[12px] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
							>
								{t('pptx.broadcast.startBroadcast')}
							</button>
						</div>
					)}
				</div>
			</div>
		</>
	);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StartBroadcastForm({
	roomId,
	userName,
	serverUrl,
	onRoomIdChange,
	onUserNameChange,
	onServerUrlChange,
}: {
	roomId: string;
	userName: string;
	serverUrl: string;
	onRoomIdChange: (v: string) => void;
	onUserNameChange: (v: string) => void;
	onServerUrlChange: (v: string) => void;
}) {
	const { t } = useTranslation();

	return (
		<div className='space-y-4'>
			<p className='text-[13px] text-muted-foreground leading-relaxed'>
				{t('pptx.broadcast.description')}
			</p>

			{/* Broadcast Room */}
			<div className='space-y-1.5'>
				<label
					htmlFor='broadcast-room-id'
					className='block text-[12px] font-medium text-foreground'
				>
					{t('pptx.broadcast.sessionName')}
				</label>
				<input
					id='broadcast-room-id'
					type='text'
					value={roomId}
					onChange={(e) => onRoomIdChange(e.target.value)}
					placeholder='broadcast-abc123'
					className='w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'
				/>
			</div>

			{/* User Display Name */}
			<div className='space-y-1.5'>
				<label
					htmlFor='broadcast-user-name'
					className='block text-[12px] font-medium text-foreground'
				>
					{t('pptx.broadcast.displayName')}
				</label>
				<input
					id='broadcast-user-name'
					type='text'
					value={userName}
					onChange={(e) => onUserNameChange(e.target.value)}
					placeholder={t('pptx.broadcast.presenterPlaceholder')}
					className='w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'
				/>
			</div>

			{/* Server URL */}
			<div className='space-y-1.5'>
				<label
					htmlFor='broadcast-server-url'
					className='block text-[12px] font-medium text-foreground'
				>
					{t('pptx.broadcast.serverLabel')}
				</label>
				<input
					id='broadcast-server-url'
					type='text'
					value={serverUrl}
					onChange={(e) => onServerUrlChange(e.target.value)}
					placeholder='ws://localhost:1234'
					className='w-full px-3 py-1.5 rounded border border-border bg-background text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'
				/>
			</div>

			<p className='text-[11px] text-muted-foreground/70 leading-relaxed'>
				{serverUrl.trim().length === 0 ? t('pptx.broadcast.p2pHint') : t('pptx.broadcast.hint')}
			</p>
		</div>
	);
}

function ActiveBroadcastView({
	collab,
	broadcastUrl,
	copied,
	onCopyUrl,
	onStopBroadcast,
}: {
	collab: NonNullable<ReturnType<typeof useCollaboration>>;
	broadcastUrl: string;
	copied: boolean;
	onCopyUrl: () => void;
	onStopBroadcast: () => void;
}) {
	const { t } = useTranslation();
	const statusColor =
		collab.status === 'connected'
			? 'text-green-400'
			: collab.status === 'connecting'
				? 'text-yellow-400'
				: 'text-red-400';

	const statusIcon =
		collab.status === 'connected' || collab.status === 'connecting' ? (
			<LuWifi className='w-4 h-4' />
		) : (
			<LuWifiOff className='w-4 h-4' />
		);

	const viewerCount = collab.remoteUsers.filter((u) => u.role === 'viewer').length;

	return (
		<div className='space-y-4'>
			{/* Status */}
			<div className='flex items-center gap-2'>
				<span className={statusColor}>{statusIcon}</span>
				<span className='text-[13px] font-medium text-foreground capitalize'>{collab.status}</span>
				<span className='text-[12px] text-muted-foreground ml-auto flex items-center gap-1'>
					<LuUsers className='w-3.5 h-3.5' />
					{t('pptx.broadcast.viewerCount', { count: viewerCount })}
				</span>
			</div>

			{/* Share URL */}
			<div className='space-y-1.5'>
				<label className='block text-[12px] font-medium text-foreground'>
					{t('pptx.broadcast.viewerLink')}
				</label>
				<div className='flex items-center gap-2'>
					<div className='flex-1 px-3 py-1.5 rounded border border-border bg-background text-[11px] text-foreground select-all font-mono truncate'>
						{broadcastUrl}
					</div>
					<button
						type='button'
						onClick={onCopyUrl}
						className='flex items-center gap-1 px-2.5 py-1.5 rounded border border-border bg-muted hover:bg-accent text-[12px] text-foreground transition-colors shrink-0'
						title={t('pptx.broadcast.copyLink')}
					>
						{copied ? (
							<>
								<LuCheck className='w-3.5 h-3.5 text-green-400' />
								<span>{t('pptx.share.copied')}</span>
							</>
						) : (
							<>
								<LuCopy className='w-3.5 h-3.5' />
								<span>{t('pptx.share.copyUrl')}</span>
							</>
						)}
					</button>
				</div>
				<p className='text-[11px] text-muted-foreground'>{t('pptx.broadcast.shareHint')}</p>
			</div>

			{/* Viewer list */}
			{collab.remoteUsers.length > 0 && (
				<div className='space-y-1.5'>
					<label className='block text-[12px] font-medium text-foreground'>
						{t('pptx.broadcast.viewers')}
					</label>
					<div className='rounded border border-border bg-background divide-y divide-border max-h-[120px] overflow-y-auto'>
						{collab.remoteUsers.map((user) => (
							<div key={user.clientId} className='flex items-center gap-2 px-3 py-2'>
								<div
									className='w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0'
									style={{ backgroundColor: user.userColor }}
								>
									{user.userName.slice(0, 2).toUpperCase()}
								</div>
								<span className='text-[12px] text-foreground truncate'>{user.userName}</span>
								<span className='text-[10px] text-muted-foreground ml-auto'>
									Slide {user.activeSlideIndex + 1}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Stop broadcast */}
			<button
				type='button'
				onClick={onStopBroadcast}
				className='w-full px-3 py-2 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-[12px] text-red-400 font-medium transition-colors'
			>
				{t('pptx.broadcast.stopBroadcast')}
			</button>
		</div>
	);
}
