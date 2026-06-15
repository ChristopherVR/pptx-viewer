import { mount } from '@vue/test-utils';
import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SignaturesPanel from './SignaturesPanel.vue';

function sig(status: SignatureStatus, overrides: Partial<ParsedSignature> = {}): ParsedSignature {
	return {
		signaturePath: '_xmlsignatures/sig1.xml',
		status,
		references: [],
		...overrides,
	};
}

describe('signaturesPanel', () => {
	it('shows "Not signed" with an empty list', () => {
		const wrapper = mount(SignaturesPanel, { props: { signatures: [] } });
		expect(wrapper.get('.pptx-vue-signatures__title').text()).toBe('Not signed');
		expect(wrapper.find('.pptx-vue-signatures__empty').exists()).toBeTruthy();
		expect(wrapper.findAll('.pptx-vue-signatures__item')).toHaveLength(0);
	});

	it('shows "Signed" and lists each signature when all valid', () => {
		const wrapper = mount(SignaturesPanel, {
			props: {
				signatures: [
					sig('valid', { certificate: { certificateBase64: 'x', subject: 'CN=Alice' } }),
					sig('valid', {
						signaturePath: '_xmlsignatures/sig2.xml',
						certificate: { certificateBase64: 'y', subject: 'CN=Bob' },
					}),
				],
			},
		});
		expect(wrapper.get('.pptx-vue-signatures__title').text()).toBe('Signed');
		const items = wrapper.findAll('.pptx-vue-signatures__item');
		expect(items).toHaveLength(2);
		expect(wrapper.text()).toContain('CN=Alice');
		expect(wrapper.text()).toContain('CN=Bob');
	});

	it('shows "Invalid signature" when any signature is invalid', () => {
		const wrapper = mount(SignaturesPanel, {
			props: { signatures: [sig('valid'), sig('invalid')] },
		});
		expect(wrapper.get('.pptx-vue-signatures__title').text()).toBe('Invalid signature');
		expect(wrapper.find('.pptx-vue-signatures__header--invalid').exists()).toBeTruthy();
	});

	it('renders per-signature status badges and certificate metadata', () => {
		const wrapper = mount(SignaturesPanel, {
			props: {
				signatures: [
					sig('expired', {
						certificate: {
							certificateBase64: 'z',
							subject: 'CN=Carol',
							issuer: 'CN=Acme CA',
							serialNumber: 'ABCD1234',
							validFrom: '2020-01-01T00:00:00Z',
						},
					}),
				],
			},
		});
		expect(wrapper.get('.pptx-vue-signatures__badge').text()).toBe('Expired');
		expect(wrapper.find('.pptx-vue-signatures__badge--invalid').exists()).toBeTruthy();
		expect(wrapper.text()).toContain('CN=Acme CA');
		expect(wrapper.text()).toContain('ABCD1234');
	});

	it('marks unknownCA/unverified signatures as unknown kind', () => {
		const wrapper = mount(SignaturesPanel, {
			props: { signatures: [sig('unknownCA')] },
		});
		expect(wrapper.find('.pptx-vue-signatures__item--unknown').exists()).toBeTruthy();
		expect(wrapper.find('.pptx-vue-signatures__badge--unknown').exists()).toBeTruthy();
	});

	it('falls back to "Not available" when a signature has no certificate', () => {
		const wrapper = mount(SignaturesPanel, {
			props: { signatures: [sig('unverified')] },
		});
		expect(wrapper.text()).toContain('Not available');
	});
});
