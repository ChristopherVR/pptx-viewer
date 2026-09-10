import type { XmlObject } from '../../types';

/**
 * Detect whether a relationship `Target` requires `TargetMode="External"`.
 *
 * Per ECMA-376 §15.3, every non-relative target requires the External
 * target mode. The OPC spec defines a relative reference as a path that
 * does not begin with a URI scheme (RFC 3986 §3.1: `scheme = ALPHA *(
 * ALPHA / DIGIT / "+" / "-" / "." )`). We therefore treat any target
 * whose first component before `:` is a valid scheme as external —
 * `https:`, `mailto:`, `tel:`, `ms-teams:`, `skype:`, custom URIs, etc.
 *
 * Anything that starts with `/`, `./`, `..`, or has no `:` (or the `:`
 * appears after a `/` — meaning it's part of a fragment / query) is
 * treated as an internal package-relative reference.
 */
export function isExternalTarget(target: string): boolean {
	const normalized = target.trim();
	if (normalized.length === 0) {
		return false;
	}
	// Match a leading RFC 3986 scheme followed by ':'. The scheme cannot
	// contain '/', so we look for the first ':' and check it appears
	// before any '/'.
	const colonIdx = normalized.indexOf(':');
	if (colonIdx <= 0) {
		return false;
	}
	const slashIdx = normalized.indexOf('/');
	if (slashIdx !== -1 && slashIdx < colonIdx) {
		return false;
	}
	const scheme = normalized.slice(0, colonIdx);
	return /^[A-Za-z][A-Za-z0-9+\-.]*$/.test(scheme);
}

export interface PptxSlideCommentRelationshipInfo {
	relationshipId: string;
	target: string;
}

export interface PptxSlideRelationshipRegistryOptions {
	relationships: XmlObject[];
	hyperlinkRelationshipType?: string;
}

export interface IPptxSlideRelationshipRegistry {
	nextRelationshipId(): string;
	upsertRelationship(
		relationshipId: string,
		relationshipType: string,
		relationshipTarget: string,
		targetMode?: string,
	): void;
	resolveHyperlinkRelationshipId(target: string, forceExternal?: boolean): string | undefined;
	removeCommentRelationships(commentRelationshipType: string): PptxSlideCommentRelationshipInfo;
	removeRelationshipsByType(relationshipType: string): PptxSlideCommentRelationshipInfo;
	findFirstByTypeOrTargetIncludes(
		relationshipType: string,
		targetIncludes: string,
	): XmlObject | undefined;
	toRelationshipMap(): Map<string, string>;
}

export class PptxSlideRelationshipRegistry implements IPptxSlideRelationshipRegistry {
	private readonly relationships: XmlObject[];

	private readonly usedRelationshipIds = new Set<string>();

	private readonly hyperlinkRelationshipIdByTarget = new Map<string, string>();

	private readonly hyperlinkRelationshipType: string;

	public constructor(options: PptxSlideRelationshipRegistryOptions) {
		this.relationships = options.relationships;
		this.hyperlinkRelationshipType =
			options.hyperlinkRelationshipType ||
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
		for (const relationship of this.relationships) {
			const relationshipId = String(relationship?.['@_Id'] || '').trim();
			if (relationshipId.length > 0) {
				this.usedRelationshipIds.add(relationshipId);
			}
		}
	}

	public nextRelationshipId(): string {
		let candidate = 1;
		while (this.usedRelationshipIds.has(`rId${candidate}`)) {
			candidate += 1;
		}
		const relationshipId = `rId${candidate}`;
		this.usedRelationshipIds.add(relationshipId);
		return relationshipId;
	}

	public upsertRelationship(
		relationshipId: string,
		relationshipType: string,
		relationshipTarget: string,
		targetMode?: string,
	): void {
		const existingRelationship = this.relationships.find(
			(relationship) => relationship?.['@_Id'] === relationshipId,
		);
		if (existingRelationship) {
			existingRelationship['@_Type'] = relationshipType;
			existingRelationship['@_Target'] = relationshipTarget;
			if (targetMode && targetMode.trim().length > 0) {
				existingRelationship['@_TargetMode'] = targetMode;
			} else {
				delete existingRelationship['@_TargetMode'];
			}
			return;
		}

		const relationship: XmlObject = {
			'@_Id': relationshipId,
			'@_Type': relationshipType,
			'@_Target': relationshipTarget,
		};
		if (targetMode && targetMode.trim().length > 0) {
			relationship['@_TargetMode'] = targetMode;
		}
		this.relationships.push(relationship);
	}

	/**
	 * @param forceExternal - Set for a target that is ALWAYS an external
	 * destination regardless of its shape (a "Run program" command, an
	 * external file path, or another presentation's path: `ppaction://program`
	 * / `ppaction://hlinkfile` / `ppaction://hlinkpres`). {@link isExternalTarget}'s
	 * URI-scheme heuristic exists for the generic, user-typed `url` field,
	 * where a bare string COULD be a genuine relative package reference; it
	 * has no such ambiguity for these three verbs, and a raw OS command or
	 * path (e.g. `notepad.exe C:\temp\notes.txt`) does not parse as a URI
	 * scheme, which would otherwise leave the relationship looking like an
	 * (invalid) internal package reference.
	 */
	public resolveHyperlinkRelationshipId(target: string, forceExternal = false): string | undefined {
		const normalizedTarget = String(target || '').trim();
		if (normalizedTarget.length === 0) {
			return undefined;
		}

		const cachedRelationshipId = this.hyperlinkRelationshipIdByTarget.get(normalizedTarget);
		if (cachedRelationshipId) {
			return cachedRelationshipId;
		}

		const existingRelationship = this.relationships.find((relationship) => {
			if (relationship?.['@_Type'] !== this.hyperlinkRelationshipType) {
				return false;
			}
			const relationshipTarget = String(relationship?.['@_Target'] || '').trim();
			return relationshipTarget === normalizedTarget;
		});
		const existingRelationshipId = String(existingRelationship?.['@_Id'] || '').trim();
		if (existingRelationshipId.length > 0) {
			this.hyperlinkRelationshipIdByTarget.set(normalizedTarget, existingRelationshipId);
			return existingRelationshipId;
		}

		const relationshipId = this.nextRelationshipId();
		const targetMode = forceExternal || isExternalTarget(normalizedTarget) ? 'External' : undefined;
		this.upsertRelationship(
			relationshipId,
			this.hyperlinkRelationshipType,
			normalizedTarget,
			targetMode,
		);
		this.hyperlinkRelationshipIdByTarget.set(normalizedTarget, relationshipId);
		return relationshipId;
	}

	public removeCommentRelationships(
		commentRelationshipType: string,
	): PptxSlideCommentRelationshipInfo {
		const commentRelationships = this.relationships.filter((relationship) =>
			this.isCommentRelationship(relationship, commentRelationshipType),
		);
		const retainedRelationships = this.relationships.filter(
			(relationship) => !this.isCommentRelationship(relationship, commentRelationshipType),
		);
		this.relationships.length = 0;
		retainedRelationships.forEach((relationship) => {
			this.relationships.push(relationship);
		});

		return {
			relationshipId: String(commentRelationships[0]?.['@_Id'] || '').trim(),
			target: String(commentRelationships[0]?.['@_Target'] || '').trim(),
		};
	}

	public removeRelationshipsByType(relationshipType: string): PptxSlideCommentRelationshipInfo {
		const removed = this.relationships.filter(
			(relationship) => String(relationship?.['@_Type'] || '') === relationshipType,
		);
		const retained = this.relationships.filter(
			(relationship) => String(relationship?.['@_Type'] || '') !== relationshipType,
		);
		this.relationships.splice(0, this.relationships.length, ...retained);
		return {
			relationshipId: String(removed[0]?.['@_Id'] || '').trim(),
			target: String(removed[0]?.['@_Target'] || '').trim(),
		};
	}

	public findFirstByTypeOrTargetIncludes(
		relationshipType: string,
		targetIncludes: string,
	): XmlObject | undefined {
		const normalizedTargetIncludes = targetIncludes.toLowerCase().trim();
		return this.relationships.find((relationship) => {
			const relationType = String(relationship?.['@_Type'] || '');
			if (relationType === relationshipType) {
				return true;
			}
			const relationTarget = String(relationship?.['@_Target'] || '')
				.toLowerCase()
				.trim();
			return relationTarget.includes(normalizedTargetIncludes);
		});
	}

	public toRelationshipMap(): Map<string, string> {
		const relationshipMap = new Map<string, string>();
		this.relationships.forEach((relationship) => {
			const relationshipId = String(relationship?.['@_Id'] || '').trim();
			if (relationshipId.length === 0) {
				return;
			}
			const relationshipTarget = String(relationship?.['@_Target'] || '').trim();
			if (relationshipTarget.length === 0) {
				return;
			}
			relationshipMap.set(relationshipId, relationshipTarget);
		});
		return relationshipMap;
	}

	private isCommentRelationship(relationship: XmlObject, commentRelationshipType: string): boolean {
		const relationType = String(relationship?.['@_Type'] || '');
		if (relationType === commentRelationshipType) {
			return true;
		}
		const target = String(relationship?.['@_Target'] || '').replace(/\\/g, '/');
		return /(?:^|\/)comments\/comment\d+\.xml$/i.test(target);
	}
}
