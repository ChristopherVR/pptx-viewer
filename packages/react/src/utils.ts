import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for combining Tailwind CSS classes with conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
