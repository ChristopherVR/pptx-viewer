import type { PackageManager } from './package-manager';

export interface ParsedArgs {
	help: boolean;
	yes: boolean;
	scaffold: boolean;
	/** Comma-separated target ids, e.g. "react,mcp". */
	target?: string;
	pm?: PackageManager;
	/** Project directory name for --scaffold. */
	dir?: string;
}

const KNOWN_PMS: PackageManager[] = ['bun', 'pnpm', 'yarn', 'npm'];

function readFlagValue(args: string[], index: number, flag: string): string {
	const value = args[index + 1];
	if (!value) {
		throw new Error(`${flag} needs a value`);
	}
	return value;
}

/** Parse `process.argv.slice(2)` into structured options; unknown flags throw. */
export function parseArgs(args: string[]): ParsedArgs {
	const parsed: ParsedArgs = { help: false, yes: false, scaffold: false };
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case '--help':
			case '-h':
				parsed.help = true;
				break;
			case '--yes':
			case '-y':
				parsed.yes = true;
				break;
			case '--scaffold':
				parsed.scaffold = true;
				break;
			case '--target':
				parsed.target = readFlagValue(args, i, arg);
				i++;
				break;
			case '--dir':
				parsed.dir = readFlagValue(args, i, arg);
				i++;
				break;
			case '--pm': {
				const value = readFlagValue(args, i, arg);
				if (!KNOWN_PMS.includes(value as PackageManager)) {
					throw new Error(`--pm must be one of: ${KNOWN_PMS.join(', ')}`);
				}
				parsed.pm = value as PackageManager;
				i++;
				break;
			}
			default:
				throw new Error(`Unknown option: ${arg}`);
		}
	}
	return parsed;
}
