/**
 * SmartArt Layout Engine - Layout definition XML parser.
 *
 * Parses `dgm:layoutDef` XML objects (from `ppt/diagrams/layout*.xml`)
 * to extract algorithm types, constraints, and rules. Handles
 * namespace-prefixed tags via a simple lookup service.
 *
 * @module smartart-layout-engine-parser
 */

import type {
	LayoutAlgorithmType,
	LayoutConstraints,
	LayoutRule,
	ParsedLayoutDef,
} from './smartart-layout-engine-types';

// ============================================================================
// XML Lookup Service
// ============================================================================

/**
 * Interface for the XML lookup service used by the parser.
 */
export interface XmlLookupService {
	/** Find a single child element by local name. */
	getChildByLocalName: (
		obj: Record<string, unknown> | undefined,
		name: string,
	) => Record<string, unknown> | undefined;
	/** Find all child elements matching a local name. */
	getChildrenArrayByLocalName: (
		obj: Record<string, unknown> | undefined,
		name: string,
	) => Record<string, unknown>[];
}

/**
 * Create a simple XML lookup service that handles namespace-prefixed tags.
 *
 * This is used as a fallback when no external lookup service is provided.
 *
 * @returns A simple XML lookup service.
 */
export function createSimpleLookup(): XmlLookupService {
	return {
		getChildByLocalName(
			obj: Record<string, unknown> | undefined,
			name: string,
		): Record<string, unknown> | undefined {
			if (!obj || typeof obj !== 'object') {
				return undefined;
			}
			for (const [key, value] of Object.entries(obj)) {
				const localName = key.includes(':') ? key.split(':').pop()! : key;
				if (localName === name && value && typeof value === 'object' && !Array.isArray(value)) {
					return value as Record<string, unknown>;
				}
			}
			return undefined;
		},
		getChildrenArrayByLocalName(
			obj: Record<string, unknown> | undefined,
			name: string,
		): Record<string, unknown>[] {
			if (!obj || typeof obj !== 'object') {
				return [];
			}
			for (const [key, value] of Object.entries(obj)) {
				const localName = key.includes(':') ? key.split(':').pop()! : key;
				if (localName === name) {
					if (Array.isArray(value)) {
						return value.filter(
							(v): v is Record<string, unknown> => v !== null && typeof v === 'object',
						);
					}
					if (value && typeof value === 'object') {
						return [value as Record<string, unknown>];
					}
				}
			}
			return [];
		},
	};
}

// ============================================================================
// Layout Definition Parser (public entry point)
// ============================================================================

/**
 * Parse a `dgm:layoutDef` XML object to extract algorithm type, constraints,
 * and rules.
 *
 * The XML object is expected to be the parsed output of
 * `ppt/diagrams/layout*.xml` from fast-xml-parser.
 *
 * @param layoutDefXml - The root XML object of the layout definition.
 * @param xmlLookup - Optional XML lookup service for namespace-aware traversal.
 * @returns Parsed layout definition, or undefined if parsing fails.
 */
export function parseLayoutDefinition(
	layoutDefXml: Record<string, unknown> | undefined,
	xmlLookup?: XmlLookupService,
): ParsedLayoutDef | undefined {
	if (!layoutDefXml) {
		return undefined;
	}

	const lookup = xmlLookup ?? createSimpleLookup();

	// Find the root layoutDef element
	const layoutDef = lookup.getChildByLocalName(layoutDefXml, 'layoutDef') ?? layoutDefXml;

	const name =
		String(
			(layoutDef as Record<string, unknown>)['@_name'] ??
				(layoutDef as Record<string, unknown>)['@_uniqueId'] ??
				'',
		).trim() || undefined;

	// Extract algorithm type from the layout node tree
	const algorithmType = extractAlgorithmType(layoutDef as Record<string, unknown>, lookup);

	// Extract constraints
	const constraints = extractConstraints(layoutDef as Record<string, unknown>, lookup);

	// Extract rules
	const rules = extractRules(layoutDef as Record<string, unknown>, lookup);

	// Extract direction
	const direction = extractDirection(layoutDef as Record<string, unknown>, lookup);
	if (direction) {
		constraints.dir = direction;
	}

	return {
		algorithmType,
		constraints,
		rules,
		direction,
		name,
	};
}

// ============================================================================
// Algorithm Type Extraction
// ============================================================================

/**
 * Extract the algorithm type from a layout definition XML.
 *
 * Searches recursively through `dgm:layoutNode` and `dgm:alg` elements
 * to find the primary layout algorithm type.  When multiple algorithms
 * are present (e.g. a `tx` algorithm at the top with a `lin` or `snake`
 * algorithm in a nested node), the engine prefers the "structural"
 * algorithm (snake, lin, cycle, pyra, hierChild, hierRoot, composite)
 * over auxiliary ones (tx, sp, conn).
 *
 * @param layoutDef - Parsed layout definition XML object.
 * @param lookup - XML lookup service.
 * @returns The resolved algorithm type.
 */
function extractAlgorithmType(
	layoutDef: Record<string, unknown>,
	lookup: XmlLookupService,
): LayoutAlgorithmType {
	// Collect all algorithm types found at every level, then pick the best.
	const found: LayoutAlgorithmType[] = [];

	// Look for alg element directly under layoutDef
	const alg = lookup.getChildByLocalName(layoutDef, 'alg');
	if (alg) {
		const type = String((alg as Record<string, unknown>)['@_type'] ?? '').trim();
		found.push(mapAlgorithmTypeString(type));
	}

	// Search within layoutNode (and nested layoutNodes)
	const layoutNode = lookup.getChildByLocalName(layoutDef, 'layoutNode');
	if (layoutNode) {
		collectAlgorithms(layoutNode, lookup, found);
	}

	if (found.length === 0) {
		return 'unknown';
	}

	// Prefer structural algorithms over auxiliary ones
	const structural = found.find((a) => a !== 'tx' && a !== 'sp' && a !== 'conn' && a !== 'unknown');
	return structural ?? found[0];
}

/**
 * Recursively collect algorithm types from a layoutNode and its children.
 *
 * @param layoutNode - The layout node XML object to search.
 * @param lookup - XML lookup service.
 * @param results - Accumulator array for found algorithm types.
 */
function collectAlgorithms(
	layoutNode: Record<string, unknown>,
	lookup: XmlLookupService,
	results: LayoutAlgorithmType[],
): void {
	const alg = lookup.getChildByLocalName(layoutNode, 'alg');
	if (alg) {
		const type = String((alg as Record<string, unknown>)['@_type'] ?? '').trim();
		results.push(mapAlgorithmTypeString(type));
	}

	const children = lookup.getChildrenArrayByLocalName(layoutNode, 'layoutNode');
	for (const child of children) {
		collectAlgorithms(child, lookup, results);
	}
}

/**
 * Map an algorithm type string from XML to our typed enum.
 *
 * @param type - Raw algorithm type string from the XML attribute.
 * @returns Typed algorithm type.
 */
function mapAlgorithmTypeString(type: string): LayoutAlgorithmType {
	switch (type.toLowerCase()) {
		case 'snake':
			return 'snake';
		case 'pyra':
			return 'pyra';
		case 'hierchild':
			return 'hierChild';
		case 'hierroot':
			return 'hierRoot';
		case 'cycle':
			return 'cycle';
		case 'lin':
			return 'lin';
		case 'sp':
			return 'sp';
		case 'tx':
			return 'tx';
		case 'composite':
			return 'composite';
		case 'conn':
			return 'conn';
		default:
			return 'unknown';
	}
}

// ============================================================================
// Constraint Extraction
// ============================================================================

/**
 * Extract constraints from `dgm:constrLst` in the layout definition.
 *
 * Searches for `constrLst` at the top level and within nested `layoutNode`
 * elements.
 *
 * @param layoutDef - Parsed layout definition XML object.
 * @param lookup - XML lookup service.
 * @returns Parsed layout constraints.
 */
export function extractConstraints(
	layoutDef: Record<string, unknown>,
	lookup: XmlLookupService,
): LayoutConstraints {
	const constraints: LayoutConstraints = {};

	// Search for constrLst at multiple levels
	const constrLst =
		lookup.getChildByLocalName(layoutDef, 'constrLst') ??
		(() => {
			const layoutNode = lookup.getChildByLocalName(layoutDef, 'layoutNode');
			return layoutNode ? lookup.getChildByLocalName(layoutNode, 'constrLst') : undefined;
		})();

	if (!constrLst) {
		return constraints;
	}

	const constrArray = lookup.getChildrenArrayByLocalName(constrLst, 'constr');
	for (const constr of constrArray) {
		const type = String((constr as Record<string, unknown>)['@_type'] ?? '').trim();
		const valStr = String((constr as Record<string, unknown>)['@_val'] ?? '').trim();
		const val = parseFloat(valStr);

		if (!type || isNaN(val)) {
			continue;
		}

		switch (type.toLowerCase()) {
			case 'w':
				constraints.w = val;
				break;
			case 'h':
				constraints.h = val;
				break;
			case 'primfontsz':
				constraints.primFontSz = val;
				break;
			case 'sp':
				constraints.sp = val;
				break;
			case 'sibsp':
				constraints.sibSp = val;
				break;
			case 'secsibsp':
				constraints.secSibSp = val;
				break;
			case 'begpad':
				constraints.begPad = val;
				break;
			case 'endpad':
				constraints.endPad = val;
				break;
		}
	}

	return constraints;
}

// ============================================================================
// Rule Extraction
// ============================================================================

/**
 * Extract rules from `dgm:ruleLst`.
 *
 * Searches for `ruleLst` at the top level and within nested `layoutNode`
 * elements.
 *
 * @param layoutDef - Parsed layout definition XML object.
 * @param lookup - XML lookup service.
 * @returns Array of parsed layout rules.
 */
export function extractRules(
	layoutDef: Record<string, unknown>,
	lookup: XmlLookupService,
): LayoutRule[] {
	const rules: LayoutRule[] = [];

	const ruleLst =
		lookup.getChildByLocalName(layoutDef, 'ruleLst') ??
		(() => {
			const layoutNode = lookup.getChildByLocalName(layoutDef, 'layoutNode');
			return layoutNode ? lookup.getChildByLocalName(layoutNode, 'ruleLst') : undefined;
		})();

	if (!ruleLst) {
		return rules;
	}

	const ruleArray = lookup.getChildrenArrayByLocalName(ruleLst, 'rule');
	for (const rule of ruleArray) {
		const type = String((rule as Record<string, unknown>)['@_type'] ?? '').trim();
		if (!type) {
			continue;
		}

		const parsed: LayoutRule = { type };

		const forAttr = String((rule as Record<string, unknown>)['@_for'] ?? '').trim();
		if (forAttr) {
			parsed.for = forAttr;
		}

		const forName = String((rule as Record<string, unknown>)['@_forName'] ?? '').trim();
		if (forName) {
			parsed.forName = forName;
		}

		const valStr = String((rule as Record<string, unknown>)['@_val'] ?? '').trim();
		const val = parseFloat(valStr);
		if (!isNaN(val)) {
			parsed.val = val;
		}

		const factStr = String((rule as Record<string, unknown>)['@_fact'] ?? '').trim();
		const fact = parseFloat(factStr);
		if (!isNaN(fact)) {
			parsed.fact = fact;
		}

		const maxStr = String((rule as Record<string, unknown>)['@_max'] ?? '').trim();
		const max = parseFloat(maxStr);
		if (!isNaN(max)) {
			parsed.max = max;
		}

		const ptType = String((rule as Record<string, unknown>)['@_ptType'] ?? '').trim();
		if (ptType) {
			parsed.ptType = ptType;
		}

		rules.push(parsed);
	}

	return rules;
}

// ============================================================================
// Direction Extraction
// ============================================================================

/**
 * Extract layout direction from algorithm parameters.
 *
 * Searches for `linDir` or `flowDir` parameters in `dgm:alg` elements.
 *
 * @param layoutDef - Parsed layout definition XML object.
 * @param lookup - XML lookup service.
 * @returns Direction value, or undefined if not found.
 */
export function extractDirection(
	layoutDef: Record<string, unknown>,
	lookup: XmlLookupService,
): 'norm' | 'rev' | undefined {
	// Look for alg with param children
	const searchAlg = (parent: Record<string, unknown>): 'norm' | 'rev' | undefined => {
		const alg = lookup.getChildByLocalName(parent, 'alg');
		if (alg) {
			const params = lookup.getChildrenArrayByLocalName(alg, 'param');
			for (const param of params) {
				const type = String((param as Record<string, unknown>)['@_type'] ?? '').trim();
				const val = String((param as Record<string, unknown>)['@_val'] ?? '').trim();
				if (type === 'linDir' || type === 'flowDir') {
					if (val === 'fromR' || val === 'fromB') {
						return 'rev';
					}
					return 'norm';
				}
			}
		}
		return undefined;
	};

	const direct = searchAlg(layoutDef);
	if (direct) {
		return direct;
	}

	const layoutNode = lookup.getChildByLocalName(layoutDef, 'layoutNode');
	if (layoutNode) {
		return searchAlg(layoutNode);
	}

	return undefined;
}
