/**
 * Join class values into a single space-separated string, skipping falsy
 * entries. A dependency-free analogue of the React/Vue packages' `cn`
 * (clsx + tailwind-merge); the Angular viewer uses plain scoped CSS rather
 * than Tailwind utility classes, so de-duplication is not required.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
	return values.filter((v): v is string | number => Boolean(v)).join(' ');
}
