/**
 * Real-time collaboration UI stylesheet fragment: the Share/Broadcast modal
 * dialogs, the remote-cursor overlay, the toolbar status pill, and the
 * follow-mode bar. Concatenated after `EDITOR_CSS` by `buildViewerCss`. All
 * colours come from the shared `--pptx-*` theme custom properties.
 */
export const COLLAB_CSS = `
/* ── Modal dialog (Share / Broadcast) ────────────────────────────────── */
.pptxv-modal-backdrop {
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgb(0 0 0 / 0.5);
}
.pptxv-modal-backdrop[hidden] { display: none; }
.pptxv-modal-panel {
	display: flex;
	flex-direction: column;
	max-height: 88vh;
	min-width: 320px;
	max-width: min(92vw, 480px);
	overflow: hidden;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 12px 36px rgb(0 0 0 / 0.35);
	overscroll-behavior: contain;
}
.pptxv-modal-panel:focus { outline: none; }
.pptxv-modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 16px;
	border-bottom: 1px solid var(--pptx-border);
}
.pptxv-modal-title { margin: 0; font-size: 14px; font-weight: 600; }
.pptxv-modal-close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font-size: 18px;
	line-height: 1;
	cursor: pointer;
}
.pptxv-modal-close:hover { background: var(--pptx-muted); color: var(--pptx-foreground); }
.pptxv-modal-body { overflow-y: auto; padding: 16px; }
.pptxv-modal-footer {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	padding: 12px 16px;
	border-top: 1px solid var(--pptx-border);
}
.pptxv-modal-section { display: flex; flex-direction: column; gap: 12px; }
.pptxv-modal-section[hidden] { display: none; }
.pptxv-share-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 8px; background: var(--pptx-muted); }
.pptxv-share-tabs button { border: 0; border-radius: 6px; background: transparent; color: var(--pptx-muted-foreground); padding: 6px 10px; font: 500 12px/1.2 inherit; cursor: pointer; }
.pptxv-share-tabs button[aria-selected='true'] { background: var(--pptx-background); color: var(--pptx-foreground); box-shadow: 0 1px 2px rgb(0 0 0 / 0.18); }
.pptxv-modal-desc { margin: 0; font-size: 13px; line-height: 1.5; color: var(--pptx-muted-foreground); }
.pptxv-modal-hint { margin: 4px 0 0; font-size: 11px; color: var(--pptx-muted-foreground); }
.pptxv-modal-hint[hidden] { display: none; }
.pptxv-modal-field { display: flex; flex-direction: column; gap: 6px; }
.pptxv-modal-label { font-size: 12px; font-weight: 500; }
.pptxv-modal-input {
	width: 100%;
	padding: 6px 10px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 13px;
}
.pptxv-modal-input:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
.pptxv-modal-link-row { display: flex; align-items: center; gap: 8px; }
.pptxv-modal-link-row .pptxv-modal-input { flex: 1; }
.pptxv-modal-btn {
	padding: 6px 12px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-foreground);
	font-size: 12px;
	white-space: nowrap;
	cursor: pointer;
}
.pptxv-modal-btn:hover:not(:disabled) { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-modal-btn:disabled { opacity: 0.4; cursor: default; }
.pptxv-modal-btn-primary {
	border-color: var(--pptx-primary);
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground);
}
.pptxv-modal-danger-btn {
	width: 100%;
	padding: 8px 12px;
	border: 1px solid rgb(239 68 68 / 0.3);
	border-radius: var(--pptx-radius);
	background: rgb(239 68 68 / 0.1);
	color: #f87171;
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
}
.pptxv-modal-danger-btn:hover { background: rgb(239 68 68 / 0.2); }

/* ── Share dialog: active-session status/details/connected-users ───────── */
.pptxv-share-status-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.pptxv-share-status-row .pptxv-collab-status-dot { flex-shrink: 0; }
.pptxv-share-status-text { font-weight: 500; text-transform: capitalize; }
.pptxv-share-count { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--pptx-muted-foreground); }
.pptxv-share-details { display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--pptx-muted-foreground); }
.pptxv-share-details code { font-family: monospace; color: var(--pptx-foreground); }
.pptxv-share-users-list {
	display: flex;
	flex-direction: column;
	max-height: 140px;
	overflow-y: auto;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
}
.pptxv-share-user { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--pptx-border); }
.pptxv-share-user:last-child { border-bottom: none; }
.pptxv-share-user-avatar {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	overflow: hidden;
	color: #ffffff;
	font-size: 9px;
	font-weight: 600;
	flex-shrink: 0;
}
.pptxv-share-user-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pptxv-share-user-name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pptxv-share-user-tag { margin-left: auto; font-size: 10px; color: var(--pptx-muted-foreground); white-space: nowrap; }

/* ── Remote-cursor overlay ────────────────────────────────────────────── */
.pptxv-collab-cursors {
	position: absolute;
	inset: 0;
	pointer-events: none;
	overflow: visible;
	z-index: 20;
}
.pptxv-collab-cursor {
	position: absolute;
	top: 0;
	left: 0;
	pointer-events: none;
	will-change: transform;
	transition: transform 90ms linear;
}
.pptxv-collab-pointer { display: block; filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.35)); }
.pptxv-collab-label {
	position: absolute;
	top: 16px;
	left: 12px;
	max-width: 150px;
	padding: 2px 6px;
	border-radius: 4px;
	color: #ffffff;
	font-size: 10px;
	font-weight: 500;
	line-height: 1.2;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
}

/* ── Remote-selection overlay ─────────────────────────────────────────── */
.pptxv-remote-selections {
	position: absolute;
	inset: 0;
	pointer-events: none;
	overflow: visible;
	z-index: 19;
}
.pptxv-remote-selection {
	position: absolute;
	top: 0;
	left: 0;
	box-sizing: border-box;
	border: 2px solid currentcolor;
	border-radius: 2px;
	pointer-events: none;
	will-change: transform;
	transition: transform 90ms linear;
}
.pptxv-remote-selection-label {
	position: absolute;
	top: -18px;
	left: -2px;
	max-width: 150px;
	padding: 1px 5px;
	border-radius: 3px;
	color: #ffffff;
	font-size: 9px;
	font-weight: 500;
	line-height: 1.3;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	pointer-events: none;
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
}

/* ── Toolbar collaboration-status pill ───────────────────────────────── */
.pptxv-collab-status {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 0 6px;
	font-size: 11px;
	white-space: nowrap;
}
.pptxv-collab-status[hidden] { display: none; }
.pptxv-collab-status-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--pptx-muted-foreground);
}
.pptxv-collab-status-dot.is-connected { background: #22c55e; }
.pptxv-collab-status-dot.is-connecting { background: #eab308; }
.pptxv-collab-status-dot.is-error { background: #ef4444; }
.pptxv-collab-status-text { color: var(--pptx-muted-foreground); }
.pptxv-collab-status-retry {
	border: none;
	background: transparent;
	color: var(--pptx-primary);
	font-size: 11px;
	text-decoration: underline;
	cursor: pointer;
}
.pptxv-collab-status-retry[hidden] { display: none; }

/* ── Follow-mode bar ─────────────────────────────────────────────────── */
/* Mounted on the position:relative .pptxv root (not the stage wrap): a
   top-centre pill under the toolbar, matching React's fixed top-2 z-[1100]
   placement, so it never floats over the slide on small viewports. */
.pptxv-follow-bar {
	position: absolute;
	left: 50%;
	top: 8px;
	bottom: auto;
	z-index: 1100;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
	max-width: calc(100% - 24px);
	padding: 6px 10px;
	border-radius: var(--pptx-radius);
	background: color-mix(in srgb, var(--pptx-card) 95%, transparent);
	color: var(--pptx-card-foreground);
	font-size: 12px;
	transform: translateX(-50%);
	box-shadow: 0 4px 16px rgb(0 0 0 / 0.25);
}
.pptxv-follow-bar[hidden] { display: none; }
.pptxv-follow-status {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
	color: var(--pptx-muted-foreground);
}
.pptxv-follow-stop {
	padding: 2px 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: transparent;
	color: var(--pptx-foreground);
	font-size: 11px;
	cursor: pointer;
}
.pptxv-follow-stop:hover { background: var(--pptx-muted); }
.pptxv-follow-list {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 0;
	padding: 0;
	list-style: none;
}
.pptxv-follow-peer {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 2px 8px 2px 2px;
	border: 1px solid transparent;
	border-radius: 9999px;
	background: color-mix(in srgb, var(--pptx-muted) 60%, transparent);
	color: var(--pptx-foreground);
	cursor: pointer;
}
.pptxv-follow-peer:hover { background: var(--pptx-muted); }
.pptxv-follow-peer.is-following { border-color: var(--pptx-primary); background: color-mix(in srgb, var(--pptx-primary) 30%, transparent); }
.pptxv-follow-avatar {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	color: #ffffff;
	font-size: 10px;
	font-weight: 600;
	line-height: 1;
}
.pptxv-follow-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Presentation mode hides all collaboration chrome. */
.pptxv.pptxv-presenting .pptxv-collab-status,
.pptxv.pptxv-presenting .pptxv-follow-bar { display: none; }
`;
