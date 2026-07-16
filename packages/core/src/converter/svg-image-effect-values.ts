export function clamp(value: number, minimum: number, maximum: number): number {
	return value < minimum ? minimum : value > maximum ? maximum : value;
}

export function clamp01to2(value: number): number {
	return clamp(value, 0, 2);
}

export function fmt(value: number): string {
	return Number.isFinite(value) ? Number(value.toFixed(4)).toString() : '0';
}

export function stepTable10(threshold: number): string {
	return Array.from({ length: 10 }, (_, index) => (index / 10 >= threshold ? '1' : '0')).join(' ');
}

export function biLevelTable(threshold: number): string {
	const cutoff = clamp(threshold, 0, 100);
	return Array.from({ length: 101 }, (_, index) => (index >= cutoff ? '1' : '0')).join(' ');
}

export function luminanceTransfer(amount: number): { slope: number; intercept: number } {
	const normalized = clamp(amount / 100, -1, 1);
	return normalized >= 0
		? { slope: 1 - normalized, intercept: normalized }
		: { slope: 1 + normalized, intercept: 0 };
}

export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
	const match = /^#?([0-9a-f]{6})/iu.exec(hex.trim());
	if (!match) {
		return { r: 0, g: 0, b: 0 };
	}
	const value = parseInt(match[1] ?? '000000', 16);
	return {
		r: ((value >> 16) & 0xff) / 255,
		g: ((value >> 8) & 0xff) / 255,
		b: (value & 0xff) / 255,
	};
}
