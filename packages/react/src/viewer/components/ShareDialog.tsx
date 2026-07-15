/**
 * ShareDialog: Modal dialog for starting/managing real-time collaboration.
 *
 * When collaboration is NOT active, shows controls to configure and start a
 * collaboration session (room name, user name, server URL).
 *
 * When collaboration IS active (a `CollaborationProvider` is present and
 * connected), shows session info, connected users, and a stop button.
 *
 * @module ShareDialog
 */
import {
	buildCollaborationShareUrl,
	buildCreateCollaborationConfig,
	buildJoinCollaborationConfig,
} from 'pptx-viewer-shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useModalDismissDrag } from '../hooks';
import type { CollaborationConfig } from '../hooks/collaboration/types';
import { useModalFocus } from '../hooks/useModalFocus';
import { useCollaboration } from './collaboration';
import { ActiveSessionView } from './ShareDialogActiveView';
import { StartSessionForm } from './ShareDialogViews';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the shareable join link. A peer-to-peer (webrtc) session carries
 * `transport=webrtc` instead of a `server=` parameter.
 */
function shareUrl(config: CollaborationConfig): string {
	return buildCollaborationShareUrl(
		config,
		typeof window === 'undefined'
			? undefined
			: { origin: window.location.origin, pathname: window.location.pathname },
	);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShareDialogProps {
	/** Whether the dialog is open. */
	open: boolean;
	/** Callback to close the dialog. */
	onClose: () => void;
	/** The current collaboration config, if collaboration is already active. */
	activeCollaboration?: CollaborationConfig;
	/**
	 * Callback invoked when the user clicks "Start Sharing".
	 * Receives the configuration to start a collaboration session.
	 */
	onStartCollaboration?: (config: CollaborationConfig) => void;
	/**
	 * Callback invoked when the user clicks "Stop Sharing".
	 */
	onStopCollaboration?: () => void;
	/** When true, the session config fields are read-only (host app provides them). */
	preconfigured?: boolean;
	/** Default value for the room/session name field. */
	defaultRoomId?: string;
	/** Default value for the user display name field. */
	defaultUserName?: string;
	/** Default value for the collaboration server URL field. */
	defaultServerUrl?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareDialog({
	open,
	onClose,
	activeCollaboration,
	onStartCollaboration,
	onStopCollaboration,
	preconfigured,
	defaultRoomId,
	defaultUserName,
	defaultServerUrl,
}: ShareDialogProps): React.ReactElement | null {
	const collab = useCollaboration();
	const isActive = collab !== null && collab.status !== 'disconnected' && collab.status !== 'error';
	const { t } = useTranslation();

	// Form state for starting a new session; all defaults come from host app
	const [roomId, setRoomId] = useState(defaultRoomId ?? '');
	const [userName, setUserName] = useState(defaultUserName ?? '');
	const [serverUrl, setServerUrl] = useState(defaultServerUrl ?? '');
	const [mode, setMode] = useState<'create' | 'join'>('create');
	const [invitation, setInvitation] = useState('');
	const [copied, setCopied] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);
	const { panelStyle, handlers: dragHandlers } = useModalDismissDrag(onClose);
	useModalFocus(open, dialogRef, onClose);

	// Sync from active config if provided
	useEffect(() => {
		if (activeCollaboration) {
			setRoomId(activeCollaboration.roomId);
			setUserName(activeCollaboration.userName);
			setServerUrl(activeCollaboration.serverUrl);
		}
	}, [activeCollaboration]);

	const handleCopyRoomId = useCallback(() => {
		const config = activeCollaboration ?? { roomId, serverUrl };
		void navigator.clipboard.writeText(shareUrl(config as CollaborationConfig)).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			return undefined;
		});
	}, [activeCollaboration, roomId, serverUrl]);

	const handleStartSharing = useCallback(() => {
		const config =
			mode === 'join'
				? buildJoinCollaborationConfig({ invitation, userName, serverUrl })
				: buildCreateCollaborationConfig({ roomId, userName, serverUrl });
		if (config) {
			onStartCollaboration?.(config);
		}
	}, [invitation, mode, roomId, userName, serverUrl, onStartCollaboration]);

	// The server URL is optional: leaving it blank starts a peer-to-peer session.
	const canStart =
		(mode === 'join'
			? buildJoinCollaborationConfig({ invitation, userName, serverUrl })
			: buildCreateCollaborationConfig({ roomId, userName, serverUrl })) !== null;

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
					aria-label={t('pptx.share.title')}
					tabIndex={-1}
					style={panelStyle}
					className='pointer-events-auto w-full max-w-md rounded-xl border border-border bg-popover text-foreground shadow-2xl outline-none max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-w-none max-md:max-h-[88dvh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'
				>
					{/* Header: also a swipe-down-to-dismiss grab region on touch. */}
					<div
						{...dragHandlers}
						className='flex items-center justify-between px-5 py-3 border-b border-border touch-none'
					>
						<h2 className='text-sm font-semibold text-foreground'>
							{isActive ? t('pptx.share.collaborationActive') : t('pptx.share.title')}
						</h2>
						<button
							type='button'
							onClick={onClose}
							className='text-muted-foreground hover:text-foreground text-lg leading-none'
							aria-label={t('pptx.share.close')}
						>
							&times;
						</button>
					</div>

					{/* Body */}
					<div className='px-5 py-4'>
						{isActive ? (
							<ActiveSessionView
								collab={collab}
								activeCollaboration={activeCollaboration}
								copied={copied}
								onCopyRoomId={handleCopyRoomId}
								onStopCollaboration={onStopCollaboration}
							/>
						) : (
							<StartSessionForm
								mode={mode}
								invitation={invitation}
								roomId={roomId}
								userName={userName}
								serverUrl={serverUrl}
								onRoomIdChange={setRoomId}
								onUserNameChange={setUserName}
								onServerUrlChange={setServerUrl}
								onModeChange={setMode}
								onInvitationChange={setInvitation}
								preconfigured={preconfigured}
								connectionFailed={collab?.status === 'error'}
								onRetry={collab?.retry}
							/>
						)}
					</div>

					{/* Footer */}
					<div className='flex justify-end gap-2 px-5 py-3 border-t border-border'>
						<button
							type='button'
							onClick={onClose}
							className='px-3 py-1.5 rounded bg-muted hover:bg-accent text-[12px] text-foreground transition-colors'
						>
							{isActive ? t('pptx.share.close') : t('pptx.share.cancel')}
						</button>
						{!isActive && (
							<button
								type='button'
								disabled={!canStart}
								onClick={handleStartSharing}
								className='px-3 py-1.5 rounded bg-primary hover:bg-primary/90 text-[12px] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
							>
								{t(mode === 'join' ? 'pptx.share.joinSession' : 'pptx.share.startSharing')}
							</button>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
