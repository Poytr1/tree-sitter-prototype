import { SyntaxNode } from "tree-sitter";
import { Scope, Symbol, SymbolKind } from "./common";

export class ASTVisitor {
    public scopeTable: Scope[];
    // private symbols: Symbol[];
    private readonly buffer: String;
    public currentScope: Scope;

    constructor(buffer: string) {
        this.scopeTable = [];
        // this.symbols = [];
        this.buffer = buffer;
    }

    public visit(node: SyntaxNode) {
        if (node === null) {
            return;
        }
        switch (node.type) {
            case 'program': node.children.forEach(child => this.visit(child)); break;
            case 'package_declaration': this.visitPackageDeclaration(node); break;
            // case 'import_declaration': this.visitImportDeclaration(node); break;
            case 'class_declaration': this.visitClassDeclaration(node); break;
            case 'field_declaration': this.visitFieldDeclaration(node); break;
            case 'method_declaration': this.visitMethodDeclaration(node); break;
            // type_identifier + variable_declarator_list
            case 'local_variable_declaration': node.children.forEach(child => this.visit(child)); break;
            case 'local_variable_declaration_statement': node.children.forEach(child => this.visit(child)); break;
            case 'variable_declarator_list': node.children.forEach(child => this.visit(child)); break;
            case 'variable_declarator': this.visitLocalVariableDeclaration(node); break;
            case 'method_invocation': node.children.forEach(child => this.visit(child)); break;
            case 'single_element_annotation': this.visitSingleElementAnnotation(node); break;
            case 'try_statement': node.children.forEach(child => this.visit(child)); break;
            case 'catches': node.children.forEach(child => this.visit(child)); break;
            case 'catch_clause': this.visitCatchClause(node); break;
            case 'block': this.visitBlock(node); break;
            case 'for_statement': node.children.forEach(child => this.visit(child)); break;
            case "enhanced_for_statement": this.visitForStatement(node); break;
            case 'basic_for_statement': this.visitForStatement(node); break;
            case "if_then_else_statement": node.children.forEach(child => this.visit(child)); break;
            case "argument_list": node.children.forEach(child => this.visit(child)); break;
            case "class_instance_creation_expression": node.children.forEach(child => this.visit(child)); break;
            case "unqualified_class_instance_creation_expression": node.children.forEach(child => this.visit(child)); break;
            case "class_body": this.visitBlock(node); break;
            case "return_statement": node.children.forEach(child => this.visit(child)); break;
            // identifier -> lambda_body
            case "lambda_expression": this.visitLambdaExpression(node); break;
            default: {
                // node.children.forEach(child => this.visit(child));
                // this.visit(node.nextNamedSibling);
                break;
            }
        }
        
    }

    private visitPackageDeclaration(node: SyntaxNode) {
        // get package name
        const pakageName = this.buffer.substring(node.child(1).startIndex, node.child(1).endIndex);
        let scope = this.scopeTable.find(scope => scope.id === pakageName);
        // itnialize package scope if not exists
        if (scope == undefined) {
            scope = {
                id: pakageName,
                defs: [],
                childrenScope: [],
                parentScope: null,
                startOffset: node.startIndex,
                endOffset: node.parent.endIndex
            };
            this.scopeTable.push(scope);
        }
        this.currentScope = scope;
    }

    // private visitImportDeclaration(node: SyntaxNode) {
    //     const childCount = node.childCount;
    //     // is glob import?
    //     if (node.child(childCount-1).type === 'asterisk') {
    //         node.children.pop();
    //         this.scopeTable.push({
    //             id: node.children.map(child => this.buffer.substring(child.startIndex, child.endIndex)).join('.'),
    //             parentScope: null,
    //         })
    //     } else {
    //         this.scopeTable.push({
    //             id: node.children.map(child => this.buffer.substring(child.startIndex, child.endIndex)).join('.'),
    //             parentScope: null,
    //         })
    //     }
    //     this.visit(node.nextNamedSibling);
    // }

    private visitClassDeclaration(node: SyntaxNode) {
        // get class name
        const classNameNode = node.children.find(child => child.type === 'identifier');
        if (classNameNode !== null) {
            const className = this.buffer.substring(classNameNode.startIndex, classNameNode.endIndex);
            const classScope = {
                id: className,
                // @ts-ignore
                defs: [],
                parentScope: this.currentScope,
                // @ts-ignore
                childrenScope: [],
                startOffset: node.startIndex,
                endOffset: node.endIndex
            };
            this.scopeTable.push(classScope);
            this.currentScope.childrenScope.push(classScope);
            this.currentScope.defs.push({
                id: className,
                kind: SymbolKind.CLASS,
                startPos: classNameNode.startPosition,
                endPos: classNameNode.endPosition
                
            });
            this.currentScope = classScope;
        }
        node.children.find(child => child.type === 'class_body').children.forEach(child => this.visit(child));
        this.currentScope = this.currentScope.parentScope;
    }

    private visitFieldDeclaration(node: SyntaxNode) {
        const varDeclList = node.children.find(child => child.type === 'variable_declarator_list');
        varDeclList.children.forEach(child => {
            this.addDef(this.currentScope, this.buffer.substring(child.startIndex, child.endIndex), SymbolKind.FIELD, child);
        });
    }

    private visitMethodDeclaration(node: SyntaxNode) {
        const methodHeaderNode = node.children.find(child => child.type === 'method_header');
        // methodHeaderNode: type_identifier + method_declarator
        const methodDeclNode = methodHeaderNode.child(1);

        // methodDeclNode: identifier(...formal_parameter)
        // TODO: add parameter information
        this.addDef(
            this.currentScope,
            this.buffer.substring(methodDeclNode.child(0).startIndex, methodDeclNode.child(0).endIndex),
            SymbolKind.METHOD,
            methodDeclNode.child(0)
        );
        const methodScope = {
            id: this.buffer.substring(methodDeclNode.child(0).startIndex, methodDeclNode.child(0).endIndex),
            // @ts-ignore
            defs: [],
            parentScope: this.currentScope,
            // @ts-ignore
            childrenScope: [],
            startOffset: node.startIndex,
            endOffset: node.endIndex
        }
        this.currentScope.childrenScope.push(methodScope);
        this.scopeTable.push(methodScope);
        this.currentScope = methodScope;
        methodDeclNode.children.filter(child => child.type === 'formal_parameter').forEach(child => {
            this.addDef(methodScope, this.buffer.substring(child.child(1).startIndex, child.child(1).endIndex), SymbolKind.LOCAL, child.child(1));
        });
        const methodBodyNode = node.children.find(child => child.type === 'method_body');
        this.visit(methodBodyNode.firstChild);
        this.currentScope = methodScope.parentScope;
    }

    private visitLocalVariableDeclaration(node: SyntaxNode) {
        const varNode = node.children.find(child => child.type === 'variable_declarator_id');
        // variable_declarator_list (variable_declarator () )
        this.addDef(this.currentScope, this.buffer.substring(varNode.startIndex, varNode.endIndex), SymbolKind.LOCAL, varNode);
    }

    private visitBlock(node: SyntaxNode) {
        const blockScope = {
            id: `${this.currentScope.id}-${this.currentScope.childrenScope.length}`,
            // @ts-ignore
            defs: [],
            parentScope: this.currentScope,
            // @ts-ignore
            childrenScope: [],
            startOffset: node.startIndex,
            endOffset: node.endIndex
        }
        this.scopeTable.push(blockScope);
        this.currentScope.childrenScope.push(blockScope);
        this.currentScope = blockScope;
        node.children.forEach(child => this.visit(child));
        this.currentScope = blockScope.parentScope;
    }

    private visitCatchClause(node: SyntaxNode) {
        const catchClauseScope = {
            id: `${this.currentScope.id}-${this.currentScope.childrenScope.length}`,
            //@ts-ignore
            defs: [],
            //@ts-ignore
            childrenScope: [],
            parentScope: this.currentScope,
            startOffset: node.startIndex,
            endOffset: node.endIndex
        }
        this.currentScope.childrenScope.push(catchClauseScope);
        this.scopeTable.push(catchClauseScope);
        this.currentScope = catchClauseScope;
        node.children.filter(child => child.type === 'catch_formal_parameter').forEach(child => {
            this.addDef(catchClauseScope, this.buffer.substring(child.child(1).startIndex, child.child(1).endIndex), SymbolKind.LOCAL, child.child(1));
        });
        this.visit(node.lastChild);
        this.currentScope = catchClauseScope.parentScope;
    }

    private visitForStatement(node: SyntaxNode) {
        const forStatScope = {
            id: `${this.currentScope.id}-${this.currentScope.childrenScope.length}`,
            //@ts-ignore
            defs: [],
            //@ts-ignore
            childrenScope: [],
            parentScope: this.currentScope,
            startOffset: node.startIndex,
            endOffset: node.endIndex
        }
        this.currentScope.childrenScope.push(forStatScope);
        this.scopeTable.push(forStatScope);
        this.currentScope = forStatScope;
        const varNode = node.children.find(child => child.type === "variable_declarator_id");
        this.addDef(forStatScope, this.buffer.substring(varNode.startIndex, varNode.endIndex), SymbolKind.LOCAL, varNode);
        this.visit(node.lastChild);
        this.currentScope = forStatScope.parentScope;
    }

    private visitLambdaExpression(node: SyntaxNode) {
        const lambdaScope = {
            id: `${this.currentScope.id}-${this.currentScope.childrenScope.length}`,
            //@ts-ignore
            defs: [],
            //@ts-ignore
            childrenScope: [],
            parentScope: this.currentScope,
            startOffset: node.startIndex,
            endOffset: node.endIndex
        }
        this.currentScope.childrenScope.push(lambdaScope);
        this.scopeTable.push(lambdaScope);
        this.currentScope = lambdaScope;
        this.addDef(lambdaScope, this.buffer.substring(node.firstChild.startIndex, node.firstChild.endIndex), SymbolKind.LOCAL, node.firstChild);
        this.visit(node.lastChild);
        this.currentScope = lambdaScope.parentScope;
    }

    private visitMethodInvocation(node: SyntaxNode) {}

    private visitSingleElementAnnotation(node: SyntaxNode) {}

    private addDef(scope: Scope, symbolName: string, kind: SymbolKind, node: SyntaxNode) {
        if (scope.defs.find(def => def.id === symbolName) === undefined) {
            scope.defs.push({
                id: symbolName,
                kind: kind,
                startPos: node.startPosition,
                endPos: node.endPosition
            })
        }
    }


}