import { PptxHandler } from 'pptx-viewer-core';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';

import { themeToCssVars } from '../../packages/react/src/theme';
import type { ViewerTheme } from '../../packages/react/src/theme';
import {
	PowerPointViewer,
	isAudienceTab,
	loadAudienceContent,
	storeAudienceContent,
} from '../../packages/react/src/viewer';
import type { CollaborationConfig } from '../../packages/react/src/viewer';
import {
	getAutosaveSnapshot,
	listAutosaveSnapshots,
	deleteAutosaveSnapshot,
} from '../../packages/shared/src/render/autosave-store';
import i18nInstance from './i18n'; // Initialises i18next before any component renders
import { LanguagePicker } from './LanguagePicker';

import './app.css';

// ── Server URL safety ──────────────────────────────────────────────────────
// Security model:
//   - Any wss:// (secure WebSocket, TLS) server is trusted: same rationale as
//     trusting HTTPS. This enables collab on deployed demos (e.g. GitHub Pages)
//     without requiring a build-time VITE_COLLAB_SERVER_URL.
//   - Insecure ws:// is restricted to loopback (local dev) or a configured relay.
//   - Non-WebSocket URLs are always rejected.
const TRUSTED_COLLAB_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// A deploy can configure its own y-websocket relay at build time; that host is
// then trusted for URL-driven auto-join / file fetch (see isTrustedServerUrl).
const CONFIGURED_SERVER_URL = import.meta.env.VITE_COLLAB_SERVER_URL?.trim() ?? '';

function isTrustedServerUrl(url: string): boolean {
	try {
		const u = new URL(url);
		if (u.protocol !== 'ws:' && u.protocol !== 'wss:') {
			return false;
		}
		// Any wss:// (secure WebSocket, TLS required) is trusted — the same
		// rationale as trusting HTTPS: an attacker cannot impersonate the host
		// without a valid certificate for it.
		if (u.protocol === 'wss:') {
			return true;
		}
		// Insecure ws:// is restricted to loopback (local dev) or a configured relay.
		if (TRUSTED_COLLAB_HOSTS.includes(u.hostname)) {
			return true;
		}
		if (CONFIGURED_SERVER_URL) {
			try {
				return new URL(CONFIGURED_SERVER_URL).host === u.host;
			} catch {
				return false;
			}
		}
		return false;
	} catch {
		return false;
	}
}

/** Whether a session config uses the serverless peer-to-peer (webrtc) transport. */
function isP2PConfig(config: CollaborationConfig): boolean {
	return config.transport === 'webrtc' || config.serverUrl.trim().length === 0;
}

/** Random hex colour for a local presence cursor. */
function randomCursorColor(): string {
	return `#${Math.floor(Math.random() * 0xffffff)
		.toString(16)
		.padStart(6, '0')}`;
}

/** Parse a comma-separated `?signaling=` list into a clean URL array. */
function parseSignaling(raw: string | null): string[] | undefined {
	if (!raw) {
		return undefined;
	}
	const list = raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return list.length > 0 ? list : undefined;
}

// ── Default collaboration server resolution ─────────────────────────────────
// The demo ships without a public relay, so the default server URL must adapt
// to where the demo is running:
//
//   • Local dev (localhost/127.0.0.1): default to `ws://localhost:1234`, the
//     URL printed by `bun run collab`.
//   • Deployed static host (e.g. GitHub Pages): there is NO server to talk to,
//     and an https:// page cannot open a ws:// (insecure) socket without a
//     mixed-content failure. So we never hard-default to ws://localhost there.
//     Instead we honour a build-time `VITE_COLLAB_SERVER_URL` (a wss:// relay
//     the deploy can configure) and otherwise leave the field blank so the
//     user is prompted to paste their own wss:// server.
//
// A deploy can always override the default by setting VITE_COLLAB_SERVER_URL.
function isLocalhostOrigin(): boolean {
	if (typeof window === 'undefined') {
		return true;
	}
	return TRUSTED_COLLAB_HOSTS.includes(window.location.hostname);
}

/**
 * Resolve the default collaboration server URL for the current origin.
 *
 * Returns a configured wss:// relay if one was provided at build time,
 * `ws://localhost:1234` in local dev, or an empty string on a deployed origin
 * with no relay configured (so the Share dialog asks the user for a URL rather
 * than silently pointing at an unreachable / mixed-content socket).
 */
function resolveDefaultServerUrl(): string {
	if (CONFIGURED_SERVER_URL) {
		return CONFIGURED_SERVER_URL;
	}
	return isLocalhostOrigin() ? 'ws://localhost:1234' : '';
}

// ── Theme presets ──────────────────────────────────────────────────────────

interface ThemePreset {
	label: string;
	theme: ViewerTheme;
}

const themes: Record<string, ThemePreset> = {
	dark: {
		label: 'Dark',
		theme: {
			colors: {
				background: '#030712',
				foreground: '#f3f4f6',
				card: '#111827',
				cardForeground: '#f3f4f6',
				popover: '#111827',
				popoverForeground: '#f3f4f6',
				primary: '#6366f1',
				primaryForeground: '#ffffff',
				secondary: '#1f2937',
				secondaryForeground: '#f3f4f6',
				muted: '#1f2937',
				mutedForeground: '#9ca3af',
				accent: '#1f2937',
				accentForeground: '#f3f4f6',
				destructive: '#ef4444',
				destructiveForeground: '#ffffff',
				border: '#374151',
				input: '#374151',
				ring: '#6366f1',
			},
		},
	},
	light: {
		label: 'Light',
		theme: {
			colors: {
				background: '#f8fafc',
				foreground: '#0f172a',
				card: '#ffffff',
				cardForeground: '#0f172a',
				popover: '#ffffff',
				popoverForeground: '#0f172a',
				primary: '#4f46e5',
				primaryForeground: '#ffffff',
				secondary: '#f1f5f9',
				secondaryForeground: '#0f172a',
				muted: '#f1f5f9',
				mutedForeground: '#64748b',
				accent: '#f1f5f9',
				accentForeground: '#0f172a',
				destructive: '#dc2626',
				destructiveForeground: '#ffffff',
				border: '#e2e8f0',
				input: '#e2e8f0',
				ring: '#4f46e5',
			},
		},
	},
	midnight: {
		label: 'Midnight Blue',
		theme: {
			colors: {
				background: '#0c1222',
				foreground: '#e2e8f0',
				card: '#162032',
				cardForeground: '#e2e8f0',
				popover: '#162032',
				popoverForeground: '#e2e8f0',
				primary: '#38bdf8',
				primaryForeground: '#0c1222',
				secondary: '#1e3a5f',
				secondaryForeground: '#e2e8f0',
				muted: '#1e3a5f',
				mutedForeground: '#7dd3fc',
				accent: '#1e3a5f',
				accentForeground: '#e2e8f0',
				destructive: '#f87171',
				destructiveForeground: '#ffffff',
				border: '#1e3a5f',
				input: '#1e3a5f',
				ring: '#38bdf8',
			},
		},
	},
	sepia: {
		label: 'Warm Sepia',
		theme: {
			colors: {
				background: '#faf6f1',
				foreground: '#292524',
				card: '#ffffff',
				cardForeground: '#292524',
				popover: '#ffffff',
				popoverForeground: '#292524',
				primary: '#b45309',
				primaryForeground: '#ffffff',
				secondary: '#f5f0eb',
				secondaryForeground: '#292524',
				muted: '#f5f0eb',
				mutedForeground: '#78716c',
				accent: '#f5f0eb',
				accentForeground: '#292524',
				destructive: '#dc2626',
				destructiveForeground: '#ffffff',
				border: '#d6d3d1',
				input: '#d6d3d1',
				ring: '#b45309',
			},
		},
	},
};

const themeKeys = Object.keys(themes);

// ── Apply theme vars to :root ──────────────────────────────────────────────

function useRootTheme(theme: ViewerTheme) {
	useEffect(() => {
		const vars = themeToCssVars(theme);
		const root = document.documentElement;
		const keys = Object.keys(vars);
		for (const key of keys) {
			root.style.setProperty(key, vars[key]);
		}
		return () => {
			for (const key of keys) {
				root.style.removeProperty(key);
			}
		};
	}, [theme]);
}

// ── Theme picker (rendered via portal) ─────────────────────────────────────

const pickerRoot = document.getElementById('theme-picker-root')!;

function ThemePicker({ current, onChange }: { current: string; onChange: (key: string) => void }) {
	const [open, setOpen] = useState(false);
	// The picker is a fixed sibling of the viewer, so any z-index floats it above
	// the viewer's whole subtree (its bottom sheets / action bar live in their own
	// stacking context). Rather than fight that, on small screens we anchor it to
	// the top-right — clear of the mobile bottom bar and the bottom sheets — and
	// keep the familiar bottom-right spot on desktop.
	const [isSmallScreen, setIsSmallScreen] = useState(
		() => typeof window !== 'undefined' && window.innerWidth < 768,
	);
	useEffect(() => {
		const onResize = () => setIsSmallScreen(window.innerWidth < 768);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);
	const preset = themes[current];
	const bg = preset.theme.colors?.card ?? '#111827';
	const border = preset.theme.colors?.border ?? '#374151';
	const fg = preset.theme.colors?.mutedForeground ?? '#9ca3af';
	const primary = preset.theme.colors?.primary ?? '#6366f1';

	const picker = (
		<div
			style={{
				position: 'fixed',
				...(isSmallScreen
					? { top: 'calc(env(safe-area-inset-top, 0px) + 60px)', right: 8 }
					: { bottom: 48, right: 12 }),
				zIndex: open ? 100000 : 99999,
				fontFamily: 'system-ui, sans-serif',
			}}
		>
			<button
				onClick={() => setOpen(!open)}
				title='Switch theme'
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
					<circle cx='12' cy='12' r='4' />
					<path d='M12 2v2' />
					<path d='M12 20v2' />
					<path d='m4.93 4.93 1.41 1.41' />
					<path d='m17.66 17.66 1.41 1.41' />
					<path d='M2 12h2' />
					<path d='M20 12h2' />
					<path d='m6.34 17.66-1.41 1.41' />
					<path d='m19.07 4.93-1.41 1.41' />
				</svg>
				{preset.label}
			</button>
			{open && (
				<div
					style={{
						position: 'absolute',
						// On mobile the button is anchored near the top, so an upward
						// menu was clipped off-screen (Dark/Light unreachable). Open
						// downward there; keep the bottom-anchored placement on desktop.
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
					{themeKeys.map((key) => {
						const p = themes[key];
						const isActive = key === current;
						return (
							<button
								key={key}
								onClick={() => {
									onChange(key);
									setOpen(false);
								}}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
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
								<span
									style={{
										width: 14,
										height: 14,
										borderRadius: 9999,
										background: p.theme.colors?.primary ?? '#6366f1',
										border: `2px solid ${p.theme.colors?.border ?? '#374151'}`,
										flexShrink: 0,
									}}
								/>
								{p.label}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);

	return createPortal(picker, pickerRoot);
}

// ── App ────────────────────────────────────────────────────────────────────

const RECOVERY_STORAGE_KEY = 'pptx-demo-last-file';

function App() {
	const [content, setContent] = useState<Uint8Array | null>(null);
	const [fileName, setFileName] = useState<string>('');
	const [recoveryOffer, setRecoveryOffer] = useState<{
		filePath: string;
		timestamp: number;
		size: number;
	} | null>(null);
	const [themeKey, setThemeKey] = useState<string>(() => {
		try {
			return localStorage.getItem('pptx-demo-theme') ?? 'dark';
		} catch {
			return 'dark';
		}
	});
	const [languageKey, setLanguageKey] = useState<string>(() => {
		try {
			return localStorage.getItem('pptx-demo-lang') ?? 'en';
		} catch {
			return 'en';
		}
	});

	// ── URL-based collaboration / broadcast join ────────────────────────
	const [urlRoom, setUrlRoom] = useState(() =>
		new URLSearchParams(window.location.search).get('room'),
	);
	const [urlBroadcast, setUrlBroadcast] = useState(() =>
		new URLSearchParams(window.location.search).get('broadcast'),
	);
	// URL params captured once on mount; setters not needed.
	// eslint-disable-next-line react/hook-use-state
	const [urlServer] = useState(
		() => new URLSearchParams(window.location.search).get('server') ?? resolveDefaultServerUrl(),
	);
	// eslint-disable-next-line react/hook-use-state
	const [urlName] = useState(() => new URLSearchParams(window.location.search).get('name'));
	// Serverless peer-to-peer join: `?transport=webrtc` (+ optional
	// `?signaling=a,b`). No server, so no trusted-host check and no file fetch.
	// eslint-disable-next-line react/hook-use-state
	const [urlTransport] = useState(() =>
		new URLSearchParams(window.location.search).get('transport'),
	);
	// eslint-disable-next-line react/hook-use-state
	const [urlSignaling] = useState(() =>
		new URLSearchParams(window.location.search).get('signaling'),
	);
	const isWebrtcJoin = urlTransport === 'webrtc';
	const signalingList = useMemo(() => parseSignaling(urlSignaling), [urlSignaling]);
	// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`.
	// eslint-disable-next-line react/hook-use-state
	const [smartArt3D] = useState(
		() => new URLSearchParams(window.location.search).get('smartArt3D') === '1',
	);

	// Generate stable defaults for the Share dialog — these are demo-specific
	const autoRoomId = useMemo(() => {
		const stored = sessionStorage.getItem('pptx-demo-room-id');
		if (stored) {
			return stored;
		}
		const id = `session-${Math.random().toString(36).slice(2, 10)}`;
		sessionStorage.setItem('pptx-demo-room-id', id);
		return id;
	}, []);

	const autoName = useMemo(() => {
		const ua = navigator.userAgent;
		let platform = 'User';
		if (ua.includes('Win')) {
			platform = 'Windows';
		} else if (ua.includes('Mac')) {
			platform = 'Mac';
		} else if (ua.includes('Linux')) {
			platform = 'Linux';
		}
		const id = Math.random().toString(36).slice(2, 6);
		return `${platform}-${id}`;
	}, []);

	const defaultServerUrl = resolveDefaultServerUrl();

	// ── Collaboration ────────────────────────────────────────────────────
	const [collaborationConfig, setCollaborationConfig] = useState<CollaborationConfig | null>(null);

	// Auto-connect if room is in URL (collaboration mode). Peer-to-peer joins
	// (transport=webrtc) need no server and skip the trusted-host check.
	useEffect(() => {
		if (!urlRoom || collaborationConfig) {
			return;
		}
		if (isWebrtcJoin) {
			setCollaborationConfig({
				roomId: urlRoom,
				serverUrl: '',
				transport: 'webrtc',
				signaling: signalingList,
				userName: urlName ?? autoName,
				userColor: randomCursorColor(),
			});
		} else if (isTrustedServerUrl(urlServer)) {
			setCollaborationConfig({
				roomId: urlRoom,
				serverUrl: urlServer,
				userName: urlName ?? autoName,
				userColor: randomCursorColor(),
			});
		} else {
			console.warn(
				`Ignoring ?room= auto-connect because ?server=${urlServer} is not in the trusted-host allowlist. Use the Share dialog to connect explicitly.`,
			);
		}
	}, [urlRoom, urlServer, urlName, autoName, collaborationConfig, isWebrtcJoin, signalingList]);

	// Auto-connect if broadcast is in URL (viewer mode). Peer-to-peer joins need
	// no server and skip the trusted-host check.
	useEffect(() => {
		if (!urlBroadcast || collaborationConfig) {
			return;
		}
		if (isWebrtcJoin) {
			setCollaborationConfig({
				roomId: urlBroadcast,
				serverUrl: '',
				transport: 'webrtc',
				signaling: signalingList,
				userName: urlName ?? autoName,
				userColor: randomCursorColor(),
				role: 'viewer',
			});
		} else if (isTrustedServerUrl(urlServer)) {
			setCollaborationConfig({
				roomId: urlBroadcast,
				serverUrl: urlServer,
				userName: urlName ?? autoName,
				userColor: randomCursorColor(),
				role: 'viewer',
			});
		} else {
			console.warn(
				`Ignoring ?broadcast= auto-connect because ?server=${urlServer} is not in the trusted-host allowlist.`,
			);
		}
	}, [
		urlBroadcast,
		urlServer,
		urlName,
		autoName,
		collaborationConfig,
		isWebrtcJoin,
		signalingList,
	]);

	const handleStartCollaboration = useCallback(
		(config: CollaborationConfig) => {
			setCollaborationConfig(config);
			// A broadcast is a one-way session started from the Broadcast dialog
			// (role 'owner', or a `broadcast-` room id); everything else is a
			// two-way collaboration. There is no 'broadcaster' role.
			const isBroadcast = config.role === 'owner' || config.roomId.startsWith('broadcast-');
			const webrtc = isP2PConfig(config);

			// Rewrite the URL so it can be copied to invite others.
			const url = new URL(window.location.href);
			for (const key of ['room', 'broadcast', 'server', 'transport', 'signaling']) {
				url.searchParams.delete(key);
			}
			url.searchParams.set(isBroadcast ? 'broadcast' : 'room', config.roomId);
			if (webrtc) {
				url.searchParams.set('transport', 'webrtc');
				if (config.signaling?.length) {
					url.searchParams.set('signaling', config.signaling.join(','));
				}
			} else {
				url.searchParams.set('server', config.serverUrl);
			}
			window.history.replaceState({}, '', url.toString());

			if (content) {
				// P2P has no file server, so stash the deck in IndexedDB for
				// same-browser joiner tabs to pick up (the Y.Doc still syncs edits).
				void storeAudienceContent(content).catch(() => {
					/* IndexedDB unavailable: joiners fall back to Y.Doc sync */
				});
				// A trusted y-websocket relay can also host the file for other devices.
				// Restricted to trusted hosts so a crafted ?server= cannot exfiltrate.
				if (!webrtc && isTrustedServerUrl(config.serverUrl)) {
					const httpUrl = config.serverUrl.replace(/^ws/u, 'http');
					// Copy into a fresh Uint8Array so TS sees a BodyInit-compatible
					// Uint8Array<ArrayBuffer> (the source may be ArrayBufferLike-backed).
					void fetch(`${httpUrl}/file/${encodeURIComponent(config.roomId)}`, {
						method: 'POST',
						body: new Uint8Array(content),
					}).catch(() => {
						/* server may not support file storage: fall back silently */
					});
				}
			}
		},
		[content],
	);

	const handleStopCollaboration = useCallback(() => {
		setCollaborationConfig(null);
		setUrlRoom(null);
		setUrlBroadcast(null);
		// Remove room/broadcast from URL
		const url = new URL(window.location.href);
		for (const key of ['room', 'broadcast', 'server', 'transport', 'signaling', 'name']) {
			url.searchParams.delete(key);
		}
		window.history.replaceState({}, '', url.toString());
	}, []);

	// When joining via URL with a room/broadcast param, download PPTX from the
	// collab server — but ONLY if the server is in the trusted-host allowlist.
	// Otherwise a crafted URL could trick the demo into ingesting attacker bytes.
	const joinRoomId = urlRoom ?? urlBroadcast;
	useEffect(() => {
		if (!joinRoomId || content) {
			return;
		}
		// Peer-to-peer join: there is no file server. The viewer is bootstrapped
		// below (IndexedDB or a blank deck) and the Y.Doc late-joiner sync fills
		// in the host's slides.
		if (isWebrtcJoin) {
			return;
		}
		if (!isTrustedServerUrl(urlServer)) {
			console.warn(
				`Refusing to fetch presentation from untrusted ?server=${urlServer}. Add the host to TRUSTED_COLLAB_HOSTS or use the Share dialog.`,
			);
			return;
		}
		let cancelled = false;
		const httpUrl = urlServer.replace(/^ws/u, 'http');
		void fetch(`${httpUrl}/file/${encodeURIComponent(joinRoomId)}`)
			.then((res) => {
				if (!res.ok) {
					throw new Error('Not found');
				}
				return res.arrayBuffer();
			})
			.then((buf) => {
				if (cancelled) {
					return undefined;
				}
				setContent(new Uint8Array(buf));
				setFileName(urlBroadcast ? 'Broadcast Session' : 'Collaboration Session');
				return undefined;
			})
			.catch(() => {
				// File not available on server — user will need to load manually
			});
		return () => {
			cancelled = true;
		};
	}, [joinRoomId, urlServer, content, urlBroadcast, isWebrtcJoin]);

	// Fallback: try IndexedDB (same-browser tabs). For a peer-to-peer join with
	// no local copy, bootstrap a blank deck so the viewer (and its webrtc
	// provider) mount; the Y.Doc late-joiner sync then replaces the slides with
	// the host's deck.
	useEffect(() => {
		if (!joinRoomId || content) {
			return;
		}
		let cancelled = false;
		const timer = setTimeout(() => {
			void (async () => {
				const bytes = await loadAudienceContent();
				if (cancelled) {
					return;
				}
				if (bytes) {
					setContent(bytes);
					setFileName(urlBroadcast ? 'Broadcast Session' : 'Collaboration Session');
					return;
				}
				if (!isWebrtcJoin) {
					return;
				}
				const { handler, data } = await PptxHandler.createBlank({
					title: 'Collaboration Session',
					initialSlideCount: 1,
				});
				const blank = await handler.save(data.slides);
				if (cancelled) {
					return;
				}
				setContent(blank);
				setFileName(urlBroadcast ? 'Broadcast Session' : 'Collaboration Session');
			})();
		}, 1500);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [joinRoomId, content, isWebrtcJoin, urlBroadcast]);

	// When opened as an audience tab, load the PPTX content from IndexedDB
	useEffect(() => {
		if (!isAudienceTab()) {
			return;
		}
		let cancelled = false;
		void loadAudienceContent().then((bytes) => {
			if (cancelled || !bytes) {
				return undefined;
			}
			setContent(bytes);
			setFileName('Audience View');
			return undefined;
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// ── Recovery detection on mount ─────────────────────────────────────────
	// Check IndexedDB for autosave snapshots. If we find one for the last opened
	// file (persisted in localStorage), offer to restore it.
	useEffect(() => {
		if (content) {
			return;
		}
		void (async () => {
			try {
				const lastFile = localStorage.getItem(RECOVERY_STORAGE_KEY);
				if (lastFile) {
					const snapshot = await getAutosaveSnapshot(lastFile);
					if (snapshot && Date.now() - snapshot.timestamp < 24 * 60 * 60 * 1000) {
						setRecoveryOffer({
							filePath: snapshot.key,
							timestamp: snapshot.timestamp,
							size: snapshot.size,
						});
						return;
					}
				}
				// No specific file match; check if any snapshots exist
				const all = await listAutosaveSnapshots();
				const recent = all.find((s) => Date.now() - s.timestamp < 24 * 60 * 60 * 1000);
				if (recent) {
					setRecoveryOffer({
						filePath: recent.key,
						timestamp: recent.timestamp,
						size: recent.size,
					});
				}
			} catch {
				// Silently ignore recovery check errors
			}
		})();
	}, [content]);

	const handleRecoveryRestore = useCallback(async () => {
		if (!recoveryOffer) {
			return;
		}
		try {
			const snapshot = await getAutosaveSnapshot(recoveryOffer.filePath);
			if (snapshot) {
				setContent(snapshot.data);
				setFileName(snapshot.key);
				try {
					localStorage.setItem(RECOVERY_STORAGE_KEY, snapshot.key);
				} catch {
					/* ignore */
				}
			}
		} catch {
			// Silently ignore
		}
		setRecoveryOffer(null);
	}, [recoveryOffer]);

	const handleRecoveryDismiss = useCallback(() => {
		if (recoveryOffer) {
			void deleteAutosaveSnapshot(recoveryOffer.filePath);
		}
		setRecoveryOffer(null);
	}, [recoveryOffer]);

	// Update document title when in collaboration/broadcast mode
	useEffect(() => {
		if (collaborationConfig && content) {
			const isBroadcast =
				collaborationConfig.role === 'owner' || collaborationConfig.roomId.startsWith('broadcast-');
			const prefix = isBroadcast
				? '[Broadcasting]'
				: collaborationConfig.role === 'viewer'
					? '[Watching]'
					: '[Collab]';
			document.title = `${prefix} ${fileName} - PPTX Viewer`;
		}
	}, [collaborationConfig, content, fileName]);

	const currentPreset = themes[themeKey] ?? themes.dark;

	// Apply theme CSS vars to :root so Tailwind's @theme var() references resolve
	useRootTheme(currentPreset.theme);

	const { t } = useTranslation();

	const handleThemeChange = useCallback((key: string) => {
		setThemeKey(key);
		try {
			localStorage.setItem('pptx-demo-theme', key);
		} catch {
			/* ignore */
		}
	}, []);

	useEffect(() => {
		void i18nInstance.changeLanguage(languageKey);
	}, [languageKey]);

	const handleLanguageChange = useCallback((code: string) => {
		setLanguageKey(code);
		try {
			localStorage.setItem('pptx-demo-lang', code);
		} catch {
			/* ignore */
		}
	}, []);

	const handleFile = useCallback((file: File) => {
		setFileName(file.name);
		try {
			localStorage.setItem(RECOVERY_STORAGE_KEY, file.name);
		} catch {
			/* ignore */
		}
		const reader = new FileReader();
		reader.onload = () => {
			const bytes = new Uint8Array(reader.result as ArrayBuffer);
			setContent(bytes);
		};
		reader.readAsArrayBuffer(file);
	}, []);

	const handleNewPresentation = useCallback(async () => {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		const bytes = await handler.save(data.slides);
		setContent(bytes);
		setFileName('Untitled Presentation');
		try {
			localStorage.setItem(RECOVERY_STORAGE_KEY, 'Untitled Presentation');
		} catch {
			/* ignore */
		}
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const file = e.dataTransfer.files[0];
			if (file?.name.endsWith('.pptx')) {
				handleFile(file);
			}
		},
		[handleFile],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	const handleClick = useCallback(() => {
		const input = document.getElementById('file-input') as HTMLInputElement;
		input?.click();
	}, []);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				handleFile(file);
			}
		},
		[handleFile],
	);

	if (content) {
		return (
			<div className='h-[100dvh] w-screen'>
				<ThemePicker current={themeKey} onChange={handleThemeChange} />
				<LanguagePicker
					current={languageKey}
					onChange={handleLanguageChange}
					theme={currentPreset}
				/>
				<PowerPointViewer
					content={content}
					fileName={fileName}
					filePath={fileName}
					canEdit
					smartArt3D={smartArt3D}
					authorName={collaborationConfig?.userName ?? autoName}
					collaboration={collaborationConfig ?? undefined}
					onStartCollaboration={handleStartCollaboration}
					onStopCollaboration={handleStopCollaboration}
					shareDefaults={{
						roomId: autoRoomId,
						userName: autoName,
						serverUrl: defaultServerUrl,
					}}
					onDirtyChange={(dirty) => {
						document.title = dirty ? `* ${fileName} — PPTX Viewer` : `${fileName} — PPTX Viewer`;
					}}
				/>
			</div>
		);
	}

	return (
		<div className='flex flex-col items-center justify-center h-[100dvh] w-screen bg-background text-foreground'>
			<ThemePicker current={themeKey} onChange={handleThemeChange} />
			<LanguagePicker current={languageKey} onChange={handleLanguageChange} theme={currentPreset} />
			{recoveryOffer && (
				<div className='max-w-[900px] w-full mb-4 p-4 rounded-lg border border-primary/40 bg-primary/5 flex items-center justify-between gap-4'>
					<div>
						<p className='text-foreground font-medium text-sm'>Unsaved changes recovered</p>
						<p className='text-muted-foreground text-xs mt-0.5'>
							{recoveryOffer.filePath} - saved {new Date(recoveryOffer.timestamp).toLocaleString()}{' '}
							({(recoveryOffer.size / 1024).toFixed(0)} KB)
						</p>
					</div>
					<div className='flex gap-2 shrink-0'>
						<button
							onClick={() => void handleRecoveryRestore()}
							className='px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors'
						>
							Restore
						</button>
						<button
							onClick={handleRecoveryDismiss}
							className='px-3 py-1.5 rounded-md border border-border text-muted-foreground text-sm hover:bg-accent transition-colors'
						>
							Dismiss
						</button>
					</div>
				</div>
			)}
			<div
				className='max-w-[900px] w-full border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer transition-colors hover:border-primary hover:bg-accent'
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onClick={handleClick}
			>
				{urlBroadcast ? (
					<>
						<p className='text-foreground mb-2 font-medium'>
							{t('demo.dropzone.joiningBroadcast')}{' '}
							<code className='px-1.5 py-0.5 rounded bg-muted text-primary text-sm font-mono'>
								{urlBroadcast}
							</code>
						</p>
						<p className='text-muted-foreground mb-3'>{t('demo.dropzone.loadingBroadcast')}</p>
					</>
				) : urlRoom ? (
					<>
						<p className='text-foreground mb-2 font-medium'>
							{t('demo.dropzone.joiningSession')}{' '}
							<code className='px-1.5 py-0.5 rounded bg-muted text-primary text-sm font-mono'>
								{urlRoom}
							</code>
						</p>
						<p className='text-muted-foreground mb-3'>{t('demo.dropzone.hintCollab')}</p>
					</>
				) : (
					<p className='text-muted-foreground mb-3'>{t('demo.dropzone.hint')}</p>
				)}
				<p className='text-sm text-muted-foreground/60'>{t('demo.dropzone.processed')}</p>
				<button
					onClick={(e) => {
						e.stopPropagation();
						void handleNewPresentation();
					}}
					className='mt-4 px-4 py-2 rounded-lg border border-border bg-muted hover:bg-accent text-foreground text-sm transition-colors'
				>
					{t('demo.dropzone.newPresentation')}
				</button>
				<input
					type='file'
					id='file-input'
					accept='.pptx'
					aria-label={t('demo.dropzone.uploadAriaLabel')}
					style={{ display: 'none' }}
					onChange={handleInputChange}
				/>
			</div>
		</div>
	);
}

const rootEl = document.getElementById('app-root');
if (rootEl) {
	createRoot(rootEl).render(<App />);
}
