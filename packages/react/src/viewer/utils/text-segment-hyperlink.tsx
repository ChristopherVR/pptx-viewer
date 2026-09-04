import type { ParagraphRun } from 'pptx-viewer-shared';
import React from 'react';

import type { RunRenderContext } from './text-segment-render';

/**
 * Wrap a linked run in a clickable element. The URL is shared's resolved
 * {@link ParagraphRun.hyperlink} target, which already carries the encoded
 * `slideIndex` for an internal `ppaction://` jump.
 *
 * Split out of `text-segment-render.tsx` to keep that module's per-run
 * resolution focused and under the repo's file-size guideline.
 */
export function renderHyperlink(
	run: ParagraphRun,
	spanNode: React.ReactNode,
	key: string,
	ctx: RunRenderContext,
): React.ReactNode {
	const url = run.hyperlink?.url;
	const onHyperlinkClick = ctx.onHyperlinkClick;
	if (!url || !onHyperlinkClick) {
		return spanNode;
	}
	const requireCtrlClick = ctx.requireCtrlClick;
	// Strip the `ppaction://` protocol for display; show a clean URL to the user.
	const displayUrl = url.startsWith('ppaction://')
		? url.replace(/^ppaction:\/\//u, '').split('?')[0]
		: url;
	// `a:hlinkClick/@tgtFrame`: which window/frame the link opens into. Only
	// meaningful for a real (non-`ppaction://`) target, which is exactly when
	// `run.hyperlink.target` is set (see `resolveRunHyperlink`).
	const targetFrame = run.hyperlink?.target;
	const follow = (modified: boolean): boolean => {
		if (requireCtrlClick && !modified) {
			return false;
		}
		onHyperlinkClick(url, targetFrame);
		return true;
	};

	return (
		<span
			key={`${key}-link`}
			role='link'
			tabIndex={0}
			className={requireCtrlClick ? 'group/link relative' : undefined}
			style={{ cursor: requireCtrlClick ? undefined : 'pointer', pointerEvents: 'auto' }}
			title={run.hyperlink?.tooltip}
			onClick={(e) => {
				if (!follow(e.ctrlKey || e.metaKey)) {
					return;
				}
				e.stopPropagation();
				e.preventDefault();
			}}
			onKeyDown={(e) => {
				if (e.key !== 'Enter' && e.key !== ' ') {
					return;
				}
				if (!follow(e.ctrlKey || e.metaKey)) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
			}}
		>
			{spanNode}
			{requireCtrlClick && (
				<span className='pointer-events-none absolute left-0 top-full z-[9999] mt-1 max-w-64 opacity-0 transition-opacity duration-150 group-hover/link:opacity-100'>
					<span className='flex flex-col rounded border border-border bg-popover px-2.5 py-1.5 shadow-lg'>
						<span className='truncate text-xs text-foreground'>{displayUrl}</span>
						<span className='mt-0.5 text-[10px] text-muted-foreground'>
							Ctrl+Click to follow link
						</span>
					</span>
				</span>
			)}
		</span>
	);
}
