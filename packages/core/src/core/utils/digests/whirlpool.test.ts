/**
 * Whirlpool (final, ISO/IEC 10118-3:2004 revision) test vectors, verified
 * against OpenSSL's `whirlpool` digest (`openssl dgst -whirlpool -provider
 * legacy -provider default`) during development. Multi-block coverage
 * matters here specifically: an earlier version of this module's
 * Miyaguchi-Preneel feedforward passed every single-block vector (including
 * the ones below) while being wrong for any message spanning more than one
 * 64-byte block, because the chaining value is zero on the first block and
 * only a non-zero chaining value exposes the mistake. See `whirlpool.ts`'s
 * module doc for the bug itself.
 */
import { describe, expect, it } from 'vitest';

import { whirlpool } from './whirlpool';

function hex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('hex');
}

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

describe('whirlpool', () => {
	it('hashes the empty string (single block)', () => {
		expect(hex(whirlpool(utf8('')))).toBe(
			'19fa61d75522a4669b44e39c1d2e1726c530232130d407f89afee0964997f7a73e83be698b288febcf88e3e03c4f0757ea8964e59b63d93708b138cc42a66eb3',
		);
	});

	it('hashes "abc" (single block)', () => {
		expect(hex(whirlpool(utf8('abc')))).toBe(
			'4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5',
		);
	});

	it("hashes the pangram (single block, matches the algorithm authors' published vector)", () => {
		expect(hex(whirlpool(utf8('The quick brown fox jumps over the lazy dog')))).toBe(
			'b97de512e91e3828b40d2b0fdce9ceb3c4a71f9bea8d88e75c4fa854df36725fd2b52eb6544edcacd6f8beddfea403cb55ae31f03ad62a5ef54e42ee82c3fb35',
		);
	});

	it('hashes a 32-byte message that pads out to two blocks', () => {
		expect(hex(whirlpool(utf8('a'.repeat(32))))).toBe(
			'661fe85e302a100bc85048438a734d219e0c006c8464f10eb2281194db21d3b236fabb497818f63511a63be7e1c5ea4009a0f937040f4bc080a68a2fff589dab',
		);
	});

	it('hashes a message that is exactly one block plus a whole padding block', () => {
		expect(hex(whirlpool(utf8('a'.repeat(64))))).toBe(
			'3ab1400670b9c37bc24274578aac331eb7150167c598c6c247bcdd8ae54be548470fcdc3718f276cebc324d2c9b35b6b4748d9a26985d9b79563f7e2890da38a',
		);
	});

	it('is deterministic and length-sensitive across several multi-block lengths', () => {
		const lengths = [0, 1, 31, 32, 33, 55, 56, 63, 64, 65, 127, 128, 200];
		const digests = new Set(lengths.map((n) => hex(whirlpool(utf8('a'.repeat(n))))));
		expect(digests.size).toBe(lengths.length);
		for (const n of lengths) {
			expect(hex(whirlpool(utf8('a'.repeat(n))))).toHaveLength(128);
		}
	});
});
