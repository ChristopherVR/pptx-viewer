/**
 * Styles for the AI assistant's chat-history affordance: the header "Chats"
 * toggle button and the saved-chat dropdown (resume / delete / New chat /
 * hint). Split out of `ai-css.ts` to keep both modules within the repo's
 * file-size budget. Scoped under the `.pptxv` root like the rest of the chrome.
 */
export const AI_HISTORY_CSS = `
/* ── Chat history: header "Chats" toggle + saved-chat dropdown ─────────── */
.pptxv-ai-chats {
	margin-left: auto;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 6px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	font-size: 0.75rem;
	font-weight: 500;
	cursor: pointer;
}
.pptxv-ai-chats:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-ai-header .pptxv-ai-chats svg { width: 14px; height: 14px; color: currentColor; }
.pptxv-ai-chats + .pptxv-ai-close { margin-left: 0; }
.pptxv-ai-history {
	position: absolute;
	right: 8px;
	top: 40px;
	z-index: 40;
	width: 256px;
	border: 1px solid var(--pptx-border);
	border-radius: 8px;
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 12px 32px rgb(0 0 0 / 0.28);
}
.pptxv-ai-history[hidden] { display: none; }
.pptxv-ai-history-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 6px 10px;
	border-bottom: 1px solid var(--pptx-border);
}
.pptxv-ai-history-title {
	font-size: 0.6875rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-muted-foreground);
}
.pptxv-ai-history-new {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 2px 6px;
	border: none;
	border-radius: 4px;
	background: var(--pptx-primary);
	color: var(--pptx-primary-foreground);
	font: inherit;
	font-size: 0.6875rem;
	font-weight: 500;
	cursor: pointer;
}
.pptxv-ai-history-new svg { width: 12px; height: 12px; }
.pptxv-ai-history-empty {
	margin: 0;
	padding: 16px 12px;
	text-align: center;
	font-size: 0.75rem;
	color: var(--pptx-muted-foreground);
}
.pptxv-ai-history-list {
	margin: 0;
	padding: 4px 0;
	list-style: none;
	max-height: 256px;
	overflow-y: auto;
}
.pptxv-ai-history-row { display: flex; align-items: center; gap: 4px; padding: 0 4px; }
.pptxv-ai-history-resume {
	display: flex;
	flex: 1;
	min-width: 0;
	align-items: flex-start;
	gap: 8px;
	padding: 6px 8px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	text-align: left;
	cursor: pointer;
}
.pptxv-ai-history-resume:hover { background: var(--pptx-accent); }
.pptxv-ai-history-resume.is-active {
	background: color-mix(in srgb, var(--pptx-accent) 60%, transparent);
}
.pptxv-ai-history-resume svg { flex: none; width: 14px; height: 14px; margin-top: 2px; }
.pptxv-ai-history-text { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.pptxv-ai-history-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 0.75rem;
	font-weight: 500;
	color: var(--pptx-foreground);
}
.pptxv-ai-history-meta { font-size: 0.625rem; color: var(--pptx-muted-foreground); }
.pptxv-ai-history-delete {
	display: inline-flex;
	flex: none;
	padding: 4px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-ai-history-delete svg { width: 14px; height: 14px; }
.pptxv-ai-history-delete:hover {
	background: color-mix(in srgb, var(--pptx-destructive) 10%, transparent);
	color: var(--pptx-destructive);
}
.pptxv-ai-history-hint {
	margin: 0;
	padding: 6px 10px;
	border-top: 1px solid var(--pptx-border);
	font-size: 0.625rem;
	color: var(--pptx-muted-foreground);
}
`;
