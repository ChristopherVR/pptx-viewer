import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerHandle } from 'pptx-react-viewer';
import React, { useEffect, useRef, useState } from 'react';

import { createHostOwnedDemo } from '../shared/host-owned-collaboration';
import type { HostOwnedDemo } from '../shared/host-owned-collaboration';

export function HostOwnedDemoApp() {
	const viewer = useRef<PowerPointViewerHandle>(null);
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
				session.attachControls(setMounted, async () => viewer.current?.getContent());
				setHost(session);
				return undefined;
			})
			.catch((reason: unknown) => setError(String(reason)));
		return () => {
			disposed = true;
			current?.dispose();
		};
	}, []);
	return (
		<main style={{ position: 'fixed', inset: '64px 0 0' }}>
			{error && <p role='alert'>{error}</p>}
			{host && mounted && (
				<PowerPointViewer
					ref={viewer}
					content={host.source}
					fileName={host.fileName}
					collaboration={host.config}
					canEdit={host.editable}
				/>
			)}
		</main>
	);
}
