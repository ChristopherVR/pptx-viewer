import { SlideCanvas, Toolbar, useViewerBuildingBlocks } from 'pptx-react-viewer';
import type { CollaborationConfig, PowerPointViewerHandle } from 'pptx-react-viewer';
import React, { useRef } from 'react';

/** A custom host shell uses the same collaboration session as the full editor. */
export function HostOwnedHeadlessEditor({
	content,
	fileName,
	collaboration,
	canEdit,
}: {
	content: Uint8Array;
	fileName: string;
	collaboration: CollaborationConfig;
	canEdit: boolean;
}) {
	const handle = useRef<PowerPointViewerHandle>(null);
	const blocks = useViewerBuildingBlocks({
		content,
		fileName,
		collaboration,
		handle,
		canEdit,
		autosaveEnabled: false,
	});
	const save = async (): Promise<void> => {
		const bytes = await handle.current?.getContent();
		if (!bytes?.byteLength) {
			return;
		}
		const url = URL.createObjectURL(
			new Blob([new Uint8Array(bytes)], {
				type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			}),
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	};
	return (
		<section style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			<div role='status' aria-label='Headless collaboration'>
				Custom shell: {blocks.collaboration?.status ?? 'inactive'}; synced:{' '}
				{String(blocks.collaboration?.synced ?? false)}
			</div>
			<button type='button' disabled={blocks.loading} onClick={() => void save()}>
				Save shared snapshot
			</button>
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
}
