/**
 * The five round functions shared by RIPEMD-128 and RIPEMD-160 (RIPEMD-128
 * uses F1-F4; RIPEMD-160 adds F5). Split out purely so neither algorithm
 * module has to repeat the other's copy.
 *
 * @module digests/ripemd-functions
 */

/** XOR: round 1 (left lane) / round 5 (right lane). */
export function f1(x: number, y: number, z: number): number {
	return x ^ y ^ z;
}

/** "x ? y : z": round 2 (left) / round 4 (right). */
export function f2(x: number, y: number, z: number): number {
	return (x & y) | (~x & z);
}

/** round 3 (both lanes, RIPEMD-160's only lane-symmetric round). */
export function f3(x: number, y: number, z: number): number {
	return (x | ~y) ^ z;
}

/** "z ? x : y": round 4 (left) / round 2 (right). */
export function f4(x: number, y: number, z: number): number {
	return (z & x) | (~z & y);
}

/** round 5 (left, RIPEMD-160 only) / round 1 (right). */
export function f5(x: number, y: number, z: number): number {
	return x ^ (y | ~z);
}
