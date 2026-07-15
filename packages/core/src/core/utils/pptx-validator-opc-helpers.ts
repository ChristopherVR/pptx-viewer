export function validPartName(name: string): boolean {
	if (!name.startsWith('/') || name.startsWith('//') || name.endsWith('/')) {
		return false;
	}
	if (
		/[\\?#\s]/.test(name) ||
		Array.from(name).some((character) => character.charCodeAt(0) < 0x20) ||
		/%(?![0-9A-Fa-f]{2})/.test(name) ||
		/%(?:2[fF]|5[cC])/.test(name)
	) {
		return false;
	}
	try {
		return decodeURIComponent(name)
			.split('/')
			.slice(1)
			.every((part) => part && part !== '.' && part !== '..' && !part.endsWith('.'));
	} catch {
		return false;
	}
}

export function canonicalPartName(name: string): string {
	try {
		return decodeURIComponent(name);
	} catch {
		return name;
	}
}

export function relationshipsOwner(path: string): string | undefined {
	if (path === '_rels/.rels') {
		return undefined;
	}
	const match = path.match(/^(.*\/)?_rels\/([^/]+)\.rels$/);
	return match ? `${match[1] ?? ''}${match[2]}` : undefined;
}

export function isExternalTarget(target: string): boolean {
	return /^[A-Za-z][A-Za-z\d+.-]*:/.test(target) || target.startsWith('//');
}

export function targetEscapesRoot(dir: string, target: string): boolean {
	if (target.startsWith('/')) {
		return false;
	}
	let depth = dir.split('/').filter(Boolean).length;
	for (const part of target.split('/')) {
		if (part === '..') {
			if (!depth) {
				return true;
			}
			depth--;
		} else if (part !== '.' && part) {
			depth++;
		}
	}
	return false;
}
