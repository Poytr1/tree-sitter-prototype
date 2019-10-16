import { Point } from 'tree-sitter';

export interface Scope {
        id: string;
        defs: Symbol[];
        childrenScope: Scope[];
        parentScope: Scope | undefined;
        startOffset: number | undefined;
        endOffset: number | undefined;
}

export interface Symbol {
        id: string;
        kind: SymbolKind;
        startPos: Point;
        endPos: Point;
        doc?: string;
        params?: string[];
}

export enum SymbolKind {
        CLASS = 0,
        FIELD = 1,
        METHOD = 2,
        LOCAL = 3,
}

