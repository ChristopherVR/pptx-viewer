import { describe, expect, it } from 'vitest';

import { resolveHyperlinkTargetAttrs } from './hyperlink-target';

describe('resolveHyperlinkTargetAttrs', () => {
	it('defaults to _blank + noopener noreferrer when no @tgtFrame is authored', () => {
		expect(resolveHyperlinkTargetAttrs(undefined)).toStrictEqual({
			target: '_blank',
			rel: 'noopener noreferrer',
		});
	});

	it('defaults the same way for an empty/whitespace-only @tgtFrame', () => {
		expect(resolveHyperlinkTargetAttrs('   ')).toStrictEqual({
			target: '_blank',
			rel: 'noopener noreferrer',
		});
	});

	it('maps @tgtFrame="_self" onto target=_self with no rel', () => {
		expect(resolveHyperlinkTargetAttrs('_self')).toStrictEqual({ target: '_self', rel: '' });
	});

	it('keeps noopener noreferrer for _parent and _top', () => {
		expect(resolveHyperlinkTargetAttrs('_parent')).toStrictEqual({
			target: '_parent',
			rel: 'noopener noreferrer',
		});
		expect(resolveHyperlinkTargetAttrs('_top')).toStrictEqual({
			target: '_top',
			rel: 'noopener noreferrer',
		});
	});

	it('passes through a named frame, still isolated with noopener noreferrer', () => {
		expect(resolveHyperlinkTargetAttrs('contentFrame')).toStrictEqual({
			target: 'contentFrame',
			rel: 'noopener noreferrer',
		});
	});
});
