import { SlideCanvas, Toolbar, useViewerBuildingBlocks } from 'pptx-react-viewer';
import type { CollaborationConfig, PowerPointViewerHandle } from 'pptx-react-viewer';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import type { HostOwnedShellHandle } from '../shared/host-owned-shell-controls';

/** A custom host shell uses the same collaboration session as the full editor. */
export const HostOwnedHeadlessEditor = forwardRef<
	HostOwnedShellHandle,
	{
		content: Uint8Array;
		fileName: string;
		collaboration: CollaborationConfig;
		canEdit: boolean;
	}
>(
	// oxlint-disable-next-line eslint/prefer-arrow-callback -- Named forwardRef render function follows React component conventions.
	function HostOwnedHeadlessEditor({ content, fileName, collaboration, canEdit }, ref) {
		const handle = useRef<PowerPointViewerHandle>(null);
		const blocks = useViewerBuildingBlocks({
			content,
			fileName,
			collaboration,
			handle,
			canEdit,
			autosaveEnabled: false,
		});
		useImperativeHandle(
			ref,
			() => ({
				getContent: async () => handle.current?.getContent(),
				setScale: (scale) => handle.current?.setZoom(scale),
			}),
			[],
		);
		return (
			<section
				data-host-custom-shell
				aria-busy={blocks.loading}
				style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
			>
				<div role='status' aria-label='Headless collaboration'>
					Custom shell: {blocks.collaboration?.status ?? 'inactive'}; synced:{' '}
					{String(blocks.collaboration?.synced ?? false)}
				</div>
				<Toolbar {...blocks.toolbarProps} />
				{blocks.error && <p role='alert'>{blocks.error}</p>}
				<div
					style={{
						flex: 1,
						minHeight: 0,
						position: 'relative',
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					<SlideCanvas {...blocks.canvasProps} />
				</div>
			</section>
		);
	},
);
