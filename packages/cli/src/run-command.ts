import { spawn } from 'node:child_process';

export interface RunCommandOptions {
	/** Suppress stdout (not stderr) so scaffolders' "Done. Now run: ..." messages are hidden while real errors remain visible. */
	silent?: boolean;
}

/**
 * Run `command args` with inherited stdio; resolves with the exit code (0 = success).
 *
 * On Windows, package manager and scaffolder binaries are `.cmd` shims that only
 * resolve through a shell, so this joins `command`/`args` into a single string and
 * enables `shell`. That combination is only safe because every caller builds `args`
 * from the fixed, known-safe package names in `targets.ts`, or from a project name
 * that has already been through `sanitizeProjectName` (see `scaffold.ts`) - never
 * from raw, unsanitized user input.
 */
export function runCommand(
	command: string,
	args: string[],
	cwd: string,
	options?: RunCommandOptions,
): Promise<number> {
	return new Promise((resolve, reject) => {
		const isWindows = process.platform === 'win32';
		// When silent, suppress stdout only (to hide the scaffolder's "Done. Now run: ..."
		// messages) but keep stderr so that real errors (e.g. Node.js version mismatch,
		// unknown CLI flags) are visible to the user rather than being swallowed and
		// replaced by a cryptic "exited with code N" message.
		const stdio: 'inherit' | ['inherit', 'ignore', 'inherit'] = options?.silent
			? ['inherit', 'ignore', 'inherit']
			: 'inherit';
		const child = isWindows
			? spawn([command, ...args].join(' '), { cwd, stdio, shell: true })
			: spawn(command, args, { cwd, stdio });
		child.on('error', reject);
		child.on('close', (code) => resolve(code ?? 1));
	});
}
