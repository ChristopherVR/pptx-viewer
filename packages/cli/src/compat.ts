import { findInstalledVersion } from './project-deps';
import { extractMajor } from './semver';
import type { Target } from './targets';

export interface CompatCheck {
	compatible: boolean;
	/** Human-readable warning, set only when `compatible` is false. */
	message: string | null;
}

/**
 * Compare a target's required framework major version against what is already
 * in the project at `cwd`. Returns compatible when the target has no compat
 * requirement, or when nothing matching is installed/declared yet (nothing to
 * conflict with).
 */
export function checkCompat(cwd: string, target: Target): CompatCheck {
	if (!target.compat) {
		return { compatible: true, message: null };
	}
	const installed = findInstalledVersion(cwd, target.compat.peerPackage);
	if (!installed) {
		return { compatible: true, message: null };
	}
	const major = extractMajor(installed.version);
	if (major === null || major === target.compat.requiredMajor) {
		return { compatible: true, message: null };
	}
	const sourceLabel = installed.source === 'resolved' ? 'installed' : 'declared in package.json';
	return {
		compatible: false,
		message:
			`Detected ${target.compat.peerPackage}@${installed.version} (${sourceLabel}) in this project, ` +
			`but ${target.label} requires ${target.compat.peerPackage}@^${target.compat.requiredMajor}. ` +
			`Continuing may change your ${target.compat.peerPackage} version.`,
	};
}
