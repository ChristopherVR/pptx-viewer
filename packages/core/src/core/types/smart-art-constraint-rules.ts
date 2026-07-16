import type { XmlObject } from './common';

export type PptxSmartArtConstraintRelationship = 'self' | 'ch' | 'des';
export type PptxSmartArtConstraintOperator = 'none' | 'equ' | 'gte' | 'lte';
export type PptxSmartArtConstraintPointType =
	| 'all'
	| 'doc'
	| 'node'
	| 'norm'
	| 'nonNorm'
	| 'asst'
	| 'nonAsst'
	| 'parTrans'
	| 'pres'
	| 'sibTrans';

export interface PptxSmartArtConstraintTarget {
	for?: PptxSmartArtConstraintRelationship;
	forName?: string;
	pointType?: PptxSmartArtConstraintPointType;
}

/** Editable DiagramML CT_Constraint. */
export interface PptxSmartArtConstraint extends PptxSmartArtConstraintTarget {
	type: string;
	referenceType?: string;
	referenceFor?: PptxSmartArtConstraintRelationship;
	referenceForName?: string;
	referencePointType?: PptxSmartArtConstraintPointType;
	operator?: PptxSmartArtConstraintOperator;
	value?: number;
	factor?: number;
	/** Original constraint retained for foreign attributes and extension content. */
	rawXml?: XmlObject;
}

/** Editable DiagramML CT_NumericRule. */
export interface PptxSmartArtNumericRule extends PptxSmartArtConstraintTarget {
	type: string;
	value?: number;
	factor?: number;
	max?: number;
	/** Original rule retained for foreign attributes and extension content. */
	rawXml?: XmlObject;
}
