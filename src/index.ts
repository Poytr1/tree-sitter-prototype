import Parser from 'tree-sitter';
// @ts-ignore
import Java from 'tree-sitter-java';
// @ts-ignore
import * as fs from 'fs';
import { ASTVisitor } from './ASTVisitor';
import { Scope } from './common';
import assert from 'assert';

const parser = new Parser();

// Set Java parser
parser.setLanguage(Java);
const content = fs.readFileSync('test_resources/FullHandler.java', 'utf8');
const treeJava = parser.parse(content);
const astVisitor = new ASTVisitor(content);
astVisitor.visit(treeJava.rootNode);
// resolve `monitor` in `return this.getFull(unit, fullParams.isReference(), textDocument, monitor);`
const result = resolveSymbol(2190, 2197, astVisitor.currentScope, content);
console.log(JSON.stringify(result));
assert.deepEqual(result, {id:"monitor",kind:3,startPos:{row:50,column:58},endPos:{row:50,column:65}});

function resolveSymbol(start: number, end: number, currentScope: Scope, source: string) {
        let scope = currentScope;
        // top-down search to get belonged scope
        while (start >= scope.startOffset && end <= scope.endOffset) {
                if (scope.childrenScope.length === 0) {
                        break;
                }
                for (let childScope of scope.childrenScope) {
                        if (childScope.startOffset <= start && childScope.endOffset >= end) {
                                scope = childScope;
                        }
                }
        }
        const symName = source.substring(start, end);
        // bottom-up search
        let finded = scope.defs.find(def => def.id === symName);
        while (finded === undefined) {
                scope = scope.parentScope;
                if (scope === null) {
                        break;
                }
                finded = scope.defs.find(def => def.id === symName);
        }
        return finded;
}