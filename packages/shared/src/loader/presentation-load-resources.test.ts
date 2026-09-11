import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPresentationLoadResources } from './presentation-load-resources';

afterEach(() => vi.restoreAllMocks());

describe('presentation load resources', () => {
	it('releases an abandoned handler and its media once, including URLs added after cancellation', () => {
		const handler = { dispose: vi.fn() };
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const resources = createPresentationLoadResources(handler);
		resources.blobUrls.push('blob:early');
		// A media read may settle after the viewer has moved to another file.
		resources.blobUrls.push('blob:late', 'https://example.test/linked.mp4');
		resources.releaseIfUncommitted();
		resources.releaseIfUncommitted();
		expect(handler.dispose).toHaveBeenCalledOnce();
		expect(revoke.mock.calls).toStrictEqual([['blob:early'], ['blob:late']]);
	});

	it('leaves committed resources owned by the viewer', () => {
		const handler = { dispose: vi.fn() };
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const resources = createPresentationLoadResources(handler);
		resources.blobUrls.push('blob:current');
		resources.commit();
		resources.releaseIfUncommitted();
		expect(handler.dispose).not.toHaveBeenCalled();
		expect(revoke).not.toHaveBeenCalled();
	});
});
