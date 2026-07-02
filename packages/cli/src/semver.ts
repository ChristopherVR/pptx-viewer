/** Pull the major version number out of a semver string or range (`^19.2.7`, `~3.5.0`, `>=18.0.0 <19`, `19.2.7`). */
export function extractMajor(version: string): number | null {
	const match = /(?<major>\d+)\.\d+\.\d+/u.exec(version);
	if (!match?.groups) {
		return null;
	}
	return Number.parseInt(match.groups.major, 10);
}
