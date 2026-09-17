/** Route the neutral product cases to a standard viewer or custom host shell. */
export function hostOwnedSessionUrl(room: string, extra: Record<string, string>): string {
	const params = new URLSearchParams({
		externalSession: '1',
		room,
		server: process.env.PPTX_E2E_COLLAB_SERVER ?? 'ws://127.0.0.1:1234',
		name: 'Editor',
		...extra,
	});
	return `/?${params}`;
}
