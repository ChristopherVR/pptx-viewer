import { spawn } from 'node:child_process';

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
export function runCommand(command: string, args: string[], cwd: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const isWindows = process.platform === 'win32';
		const child = isWindows
			? spawn([command, ...args].join(' '), { cwd, stdio: 'inherit', shell: true })
			: spawn(command, args, { cwd, stdio: 'inherit' });
		child.on('error', reject);
		child.on('close', (code) => resolve(code ?? 1));
	});
}
