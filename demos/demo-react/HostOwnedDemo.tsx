import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerHandle } from 'pptx-react-viewer';
import React, { useEffect, useRef, useState } from 'react';

import { createHostOwnedDemo } from '../shared/host-owned-collaboration';
import type { HostOwnedDemo } from '../shared/host-owned-collaboration';
import type { HostOwnedShellHandle } from '../shared/host-owned-shell-controls';
import { HostOwnedHeadlessEditor } from './HostOwnedHeadlessEditor';

export function HostOwnedDemoApp() {
	const headless = new URLSearchParams(location.search).get('headless') === '1';
	const viewer = useRef<PowerPointViewerHandle>(null);
	const customShell = useRef<HostOwnedShellHandle>(null);
	const [host, setHost] = useState<HostOwnedDemo | null>(null);
	const [mounted, setMounted] = useState(true);
	const [error, setError] = useState('');
	useEffect(() => {
		let disposed = false;
		let current: HostOwnedDemo | undefined;
		void createHostOwnedDemo(import.meta.env.VITE_COLLAB_SERVER_URL?.trim())
			.then((session) => {
				if (disposed) {
					session.dispose();
					return;
				}
				current = session;
				session.attachControls(
					setMounted,
					async () => (headless ? customShell.current?.getContent() : viewer.current?.getContent()),
					headless ? { setScale: (scale) => customShell.current?.setScale(scale) } : undefined,
				);
				setHost(session);
				return undefined;
			})
			.catch((reason: unknown) => setError(String(reason)));
		return () => {
			disposed = true;
			current?.dispose();
		};
	}, [headless]);
	return (
		<main style={{ position: 'fixed', inset: `${headless ? 104 : 64}px 0 0` }}>
			{error && <p role='alert'>{error}</p>}
			{host &&
				mounted &&
				(headless ? (
					<HostOwnedHeadlessEditor
						ref={customShell}
						content={host.source}
						fileName={host.fileName}
						collaboration={host.config}
						canEdit={host.editable}
					/>
				) : (
					<PowerPointViewer
						ref={viewer}
						content={host.source}
						fileName={host.fileName}
						collaboration={host.config}
						canEdit={host.editable}
					/>
				))}
		</main>
	);
}
