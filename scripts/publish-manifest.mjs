/**
 * publish-manifest.mjs: turn a workspace package.json into the manifest that
 * actually ships to npm.
 *
 * Packages in this repo reference each other with the `workspace:*` protocol so
 * the local checkout always links the sibling source. That protocol is
 * understood by the *installer* (bun / pnpm / yarn) but is NOT part of the npm
 * registry format: `npm publish` uploads the manifest verbatim, so a
 * `workspace:*` range that survives into a published package makes the package
 * uninstallable for everyone. Bun fails hardest and earliest:
 *
 *   error: Workspace dependency "pptx-viewer-mcp" not found
 *
 * (see https://github.com/ChristopherVR/pptx-viewer/issues/129, which shipped in
 * pptx-react-viewer / pptx-vue-viewer / pptx-svelte-viewer / pptx-vanilla-viewer
 * once `pptx-viewer-mcp` became a real runtime dependency of the bindings.)
 *
 * So every publish path has to run this first. It:
 *   - drops `workspace:` devDependencies (internal build wiring, meaningless to
 *     a consumer, and never installed from a tarball anyway),
 *   - resolves `workspace:` ranges in dependencies / peerDependencies /
 *     optionalDependencies to the referenced package's real version,
 *   - refuses to resolve a range pointing at a PRIVATE workspace package (e.g.
 *     `pptx-viewer-shared`), which is never published and must be bundled into
 *     dist instead,
 *   - re-asserts that no `workspace:` range is left anywhere before writing.
 *
 * Usage (writes the file in place):
 *   node scripts/publish-manifest.mjs packages/react/package.json \
 *     --name pptx-react-viewer --version 2.5.2
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

/** Dependency fields that ship to consumers and therefore must be resolvable. */
export const RUNTIME_DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

/** Every dependency field npm understands, runtime or not. */
export const ALL_DEP_FIELDS = [...RUNTIME_DEP_FIELDS, 'devDependencies'];

const WORKSPACE_PREFIX = 'workspace:';

/** True when `range` uses the workspace protocol. */
export function isWorkspaceRange(range) {
	return typeof range === 'string' && range.startsWith(WORKSPACE_PREFIX);
}

/**
 * Resolve one `workspace:` range against a concrete version.
 *
 * `workspace:*` becomes a caret range rather than a pin, matching what
 * `packages/angular/scripts/finalize-dist.mjs` has always published for the
 * Angular library: these packages version in lockstep-ish but independently, and
 * a hard pin would strand consumers on a patch release of a sibling.
 */
export function resolveWorkspaceRange(range, version) {
	const suffix = range.slice(WORKSPACE_PREFIX.length);
	if (suffix === '' || suffix === '*' || suffix === '^') {
		return `^${version}`;
	}
	if (suffix === '~') {
		return `~${version}`;
	}
	// `workspace:>=1.2.0` and friends carry their own range; keep it verbatim.
	return suffix;
}

/**
 * Map every workspace package name to `{ version, private }`, read from disk.
 *
 * Read at publish time on purpose: the release job has already written the new
 * versions into each package.json and committed them, so a sibling released in
 * the same run resolves to the version being published alongside it.
 */
export function readWorkspacePackages(packagesDir = join(REPO_ROOT, 'packages')) {
	const packages = new Map();
	for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		let pkg;
		try {
			pkg = JSON.parse(readFileSync(join(packagesDir, entry.name, 'package.json'), 'utf8'));
		} catch {
			// Not a package directory (or unreadable); nothing to record.
			continue;
		}
		if (typeof pkg.name === 'string') {
			packages.set(pkg.name, { version: pkg.version, private: pkg.private === true });
		}
	}
	return packages;
}

/** Throw if any dependency field still carries a `workspace:` range. */
export function assertNoWorkspaceRanges(manifest, label = manifest.name ?? 'manifest') {
	for (const field of ALL_DEP_FIELDS) {
		for (const [dep, range] of Object.entries(manifest[field] ?? {})) {
			if (isWorkspaceRange(range)) {
				throw new Error(
					`[publish-manifest] ${label}: ${field}["${dep}"] is still "${range}"; ` +
						'a published manifest cannot contain the workspace protocol',
				);
			}
		}
	}
}

/**
 * Produce the publishable form of `manifest`. Pure: the input is not mutated.
 *
 * @param {object} manifest        the package.json as read from disk
 * @param {Map<string, {version?: string, private?: boolean}>} workspacePackages
 * @param {{name?: string, version?: string}} [overrides] published name/version
 */
export function toPublishManifest(manifest, workspacePackages, overrides = {}) {
	const out = structuredClone(manifest);
	if (overrides.name) {
		out.name = overrides.name;
	}
	if (overrides.version) {
		out.version = overrides.version;
	}
	const label = out.name ?? 'manifest';

	// Internal build-time wiring: `pptx-viewer-core`, `pptx-viewer-shared` and
	// friends are bundled into dist, so a consumer never resolves these.
	if (out.devDependencies) {
		for (const [dep, range] of Object.entries(out.devDependencies)) {
			if (isWorkspaceRange(range)) {
				delete out.devDependencies[dep];
			}
		}
	}

	for (const field of RUNTIME_DEP_FIELDS) {
		const deps = out[field];
		if (!deps) {
			continue;
		}
		for (const [dep, range] of Object.entries(deps)) {
			if (!isWorkspaceRange(range)) {
				continue;
			}
			const target = workspacePackages.get(dep);
			if (!target) {
				throw new Error(
					`[publish-manifest] ${label}: ${field}["${dep}"] is "${range}" but "${dep}" is not a workspace package`,
				);
			}
			if (target.private) {
				throw new Error(
					`[publish-manifest] ${label}: ${field}["${dep}"] points at "${dep}", which is a private ` +
						'workspace package and is never published. Bundle it into dist and move the reference ' +
						'to devDependencies.',
				);
			}
			if (!target.version) {
				throw new Error(`[publish-manifest] ${label}: workspace package "${dep}" has no version`);
			}
			deps[dep] = resolveWorkspaceRange(range, target.version);
		}
	}

	assertNoWorkspaceRanges(out, label);
	return out;
}

/** Rewrite the manifest at `manifestPath` in place. Returns the new manifest. */
export function writePublishManifest(manifestPath, overrides = {}, packagesDir = undefined) {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const resolved = toPublishManifest(manifest, readWorkspacePackages(packagesDir), overrides);
	writeFileSync(manifestPath, `${JSON.stringify(resolved, null, '\t')}\n`);
	return resolved;
}

function parseArgs(argv) {
	const [manifestPath, ...rest] = argv;
	const overrides = {};
	for (let i = 0; i < rest.length; i += 1) {
		const flag = rest[i];
		if (flag === '--name' || flag === '--version') {
			const value = rest[i + 1];
			if (!value) {
				throw new Error(`[publish-manifest] ${flag} requires a value`);
			}
			overrides[flag.slice(2)] = value;
			i += 1;
		} else {
			throw new Error(`[publish-manifest] unknown argument: ${flag}`);
		}
	}
	return { manifestPath, overrides };
}

// CLI entry (skipped when imported by the tests).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	const { manifestPath, overrides } = parseArgs(process.argv.slice(2));
	if (!manifestPath) {
		console.error(
			'usage: node scripts/publish-manifest.mjs <package.json> [--name <npm-name>] [--version <semver>]',
		);
		process.exit(1);
	}
	const resolved = writePublishManifest(manifestPath, overrides);
	console.log(`[publish-manifest] ${manifestPath} -> ${resolved.name}@${resolved.version}`);
}
