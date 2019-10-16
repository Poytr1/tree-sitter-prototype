import Parser from 'tree-sitter';
// @ts-ignore
import Java from 'tree-sitter-java';
// @ts-ignore
import * as fs from 'fs';
import { ASTVisitor } from './ASTVisitor';
import { Scope, SymbolKind } from './common';
import assert from 'assert';

const parser = new Parser();

// Set Java parser
parser.setLanguage(Java);

const fileList = ['test_resources/FullHandler.java', 'test_resources/Full.java', 'test_resources/FullParams.java'];
let scopes: Scope[] = [];
let astVisitor: ASTVisitor;
let content: string;

fileList.forEach(filePath => {
        content = fs.readFileSync(filePath, 'utf8');
        const treeJava = parser.parse(content);
        astVisitor = new ASTVisitor(filePath, scopes);
        astVisitor.visit(treeJava.rootNode);
});

// resolve `monitor` in `return this.getFull(unit, fullParams.isReference(), textDocument, monitor);`
const result = resolveSymbol(2190, 2197, scopes, fs.readFileSync('test_resources/FullHandler.java', 'utf8'), 'test_resources/FullHandler.java');
console.log(JSON.stringify(result));
assert.deepEqual(result, {id:"monitor",kind:3,startPos:{row:50,column:58},endPos:{row:50,column:65}});

const result1 = resolveSymbol(1887, 1891, scopes, fs.readFileSync('test_resources/FullHandler.java', 'utf8'), 'test_resources/FullHandler.java');
const result2 = resolveSymbol(1897, 1907, scopes, fs.readFileSync('test_resources/FullHandler.java', 'utf8'), 'test_resources/FullHandler.java');

console.log(JSON.stringify(result1));
assert.deepEqual(result1, {id:"Full",kind:0,startPos:{row:5,column:13},endPos:{row:5,column:17}});

console.log(JSON.stringify(result2));
assert.deepEqual(result2, {id:"FullParams",kind:0,startPos:{row:6,column:13},endPos:{row:6,column:23}});







function resolveSymbol(start: number, end: number, scopeTable: Scope[], source: string, filePath: string) {
        let scope = scopeTable.find(scope => scope.id === filePath);
        let finded = undefined;
        const symName = source.substring(start, end);
        // top-down search to get belonged scope
        if (scope !== undefined) {
                while (start >= scope.startOffset && end <= scope.endOffset) {
                        if (scope.childrenScope.length === 0) {
                                break;
                        }
                        let allChecked = true;
                        for (let childScope of scope.childrenScope) {
                                if (childScope.startOffset <= start && childScope.endOffset >= end) {
                                        scope = childScope;
                                        allChecked = false;
                                }
                        }
                        if (allChecked === true) { break; }
                }
                // bottom-up search
                finded = scope.defs.find(def => def.id === symName);
                while (finded === undefined) {
                        let tmpScope = scope.parentScope;
                        if (tmpScope === undefined) {
                                break;
                        } else {
                                scope = scope.parentScope;
                                finded = scope.defs.find(def => def.id === symName);
                        }
                }
        }
        // search under the same package
        if (finded === undefined) {
                const BreakException = {};
                // const packageScope = scope.parentScope;
                const leftChildrenScope = scope.childrenScope.filter(child => child.id !== filePath);
                // search class, method, field
                try {
                        leftChildrenScope.forEach(childScope => {
                                // childScope.defs.forEach(def => def.id === symName)
                                for (let def of childScope.defs) {
                                        if (def.kind === SymbolKind.CLASS && def.id === symName) {
                                                finded = def;
                                                throw BreakException;
                                        }
                                }
                                childScope.childrenScope.forEach(minorScope => {
                                        finded = minorScope.defs.find(def => def.id === symName);
                                        if (finded !== undefined) {
                                                throw BreakException;
                                        }
                                })
                        });
                } catch (e) {
                        if (e !== BreakException) throw e;
                }
        }
        return finded;
}