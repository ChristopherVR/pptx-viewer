/**
 * MD2 message digest (RFC 1319). The oldest algorithm ECMA-376 19.2.1.22
 * allows a `p:modifyVerifier` to name (CAPI `cryptAlgorithmSid="1"`), and
 * one Web Crypto never implemented.
 *
 * Ported from the RFC's own C reference implementation (Appendix A), not
 * just its prose description: the prose for Step 2 ("Append Checksum")
 * reads as a plain assignment (`Set C[j] to S[c xor L]`), but the reference
 * C code XORs into the running checksum (`checksum[i] ^= PI_SUBST[...]`)
 * and carries the running value across the whole message via
 * `checksum[15]`, not just within one block; for a message longer than one
 * 16-byte block these two readings diverge, and only the C code matches the
 * RFC's own published test vectors.
 *
 * Cross-checked against the RFC 1319 test suite (section 7), e.g.
 * `MD2("abc") = da853b0d3f88d99b30283a69e6ded6bb`.
 *
 * @module digests/md2
 */

/**
 * The 256-byte substitution table built from the digits of pi (RFC 1319
 * Appendix A, `PI_SUBST`).
 */
const S: readonly number[] = [
	41, 46, 67, 201, 162, 216, 124, 1, 61, 54, 84, 161, 236, 240, 6, 19, 98, 167, 5, 243, 192, 199,
	115, 140, 152, 147, 43, 217, 188, 76, 130, 202, 30, 155, 87, 60, 253, 212, 224, 22, 103, 66, 111,
	24, 138, 23, 229, 18, 190, 78, 196, 214, 218, 158, 222, 73, 160, 251, 245, 142, 187, 47, 238, 122,
	169, 104, 121, 145, 21, 178, 7, 63, 148, 194, 16, 137, 11, 34, 95, 33, 128, 127, 93, 154, 90, 144,
	50, 39, 53, 62, 204, 231, 191, 247, 151, 3, 255, 25, 48, 179, 72, 165, 181, 209, 215, 94, 146, 42,
	172, 86, 170, 198, 79, 184, 56, 210, 150, 164, 125, 182, 118, 252, 107, 226, 156, 116, 4, 241, 69,
	157, 112, 89, 100, 113, 135, 32, 134, 91, 207, 101, 230, 45, 168, 2, 27, 96, 37, 173, 174, 176,
	185, 246, 28, 70, 97, 105, 52, 64, 126, 15, 85, 71, 163, 35, 221, 81, 175, 58, 195, 92, 249, 206,
	186, 197, 234, 38, 44, 83, 13, 110, 133, 40, 132, 9, 211, 223, 205, 244, 65, 129, 77, 82, 106,
	220, 55, 200, 108, 193, 171, 250, 36, 225, 123, 8, 12, 189, 177, 74, 120, 136, 149, 139, 227, 99,
	232, 109, 233, 203, 213, 254, 59, 0, 29, 57, 242, 239, 183, 14, 102, 88, 208, 228, 166, 119, 114,
	248, 235, 117, 75, 10, 49, 68, 80, 180, 143, 237, 31, 26, 219, 153, 141, 51, 159, 17, 131, 20,
];

/**
 * Fold one 16-byte block into `state` (the running digest) and `checksum`,
 * mirroring the C reference's `MD2Transform`. `block` must be a snapshot
 * distinct from `checksum` even when the checksum block itself is being
 * folded in at the end, since the checksum update reads the pre-call
 * checksum bytes while also overwriting them.
 */
function transform(state: Uint8Array, checksum: Uint8Array, block: Uint8Array): void {
	const x = new Uint8Array(48);
	x.set(state, 0);
	x.set(block, 16);
	for (let k = 0; k < 16; k++) {
		x[32 + k] = state[k]! ^ block[k]!;
	}

	let t = 0;
	for (let round = 0; round < 18; round++) {
		for (let k = 0; k < 48; k++) {
			x[k] ^= S[t]!;
			t = x[k]!;
		}
		t = (t + round) & 0xff;
	}
	state.set(x.subarray(0, 16));

	t = checksum[15]!;
	for (let k = 0; k < 16; k++) {
		checksum[k] ^= S[block[k]! ^ t]!;
		t = checksum[k]!;
	}
}

/** Compute the MD2 digest of `message` (16 bytes). */
export function md2(message: Uint8Array): Uint8Array {
	// Step 1: pad with n bytes of value n so the length is a multiple of 16,
	// padding a full 16-byte block when the message is already a multiple.
	const padLength = 16 - (message.length % 16);
	const padded = new Uint8Array(message.length + padLength);
	padded.set(message);
	padded.fill(padLength, message.length);

	const state = new Uint8Array(16);
	const checksum = new Uint8Array(16);
	for (let offset = 0; offset < padded.length; offset += 16) {
		transform(state, checksum, padded.subarray(offset, offset + 16));
	}
	// Step 2 (continued): append the checksum block itself and fold it in
	// too, matching the reference's `MD2Update(context, context->checksum, 16)`.
	transform(state, checksum, checksum.slice());

	return state;
}
