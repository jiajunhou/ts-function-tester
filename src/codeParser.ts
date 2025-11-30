import * as ts from 'typescript';

/**
 * 函数参数信息
 */
export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
}

/**
 * 函数信息
 */
export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  startLine: number;
  endLine: number;
  fullText: string;
  isAsync: boolean;
  isClass?: boolean; // 是否是类（构造函数）
  className?: string; // 所属类名（如果是类方法）
}

/**
 * TypeScript/JavaScript 代码解析器
 */
export class CodeParser {
  /**
   * 从源代码中提取所有函数定义
   */
  public parseFunctions(sourceCode: string, fileName: string = 'temp.ts'): FunctionInfo[] {
    const sourceFile = ts.createSourceFile(
      fileName,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const functions: FunctionInfo[] = [];

    const visit = (node: ts.Node) => {
      // 处理函数声明
      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push(this.extractFunctionInfo(node, sourceCode, sourceFile));
      }
      // 处理箭头函数和函数表达式
      else if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(declaration => {
          if (declaration.initializer) {
            if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) {
              const funcInfo = this.extractFunctionFromVariable(declaration, sourceCode, sourceFile);
              if (funcInfo) {
                functions.push(funcInfo);
              }
            }
          }
        });
      }
      // 处理类声明
      else if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.getText(sourceFile);
        
        // 提取类本身（作为构造函数）
        const classInfo = this.extractClassInfo(node, className, sourceFile);
        if (classInfo) {
          functions.push(classInfo);
        }
        
        // 提取类的方法
        node.members.forEach(member => {
          if (ts.isMethodDeclaration(member) && member.name) {
            const methodInfo = this.extractMethodInfo(member, className, sourceFile);
            if (methodInfo) {
              functions.push(methodInfo);
            }
          }
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functions;
  }

  /**
   * 从函数声明中提取信息
   */
  private extractFunctionInfo(node: ts.FunctionDeclaration, sourceCode: string, sourceFile: ts.SourceFile): FunctionInfo {
    const name = node.name?.getText(sourceFile) || 'anonymous';
    const parameters = this.extractParameters(node, sourceFile);
    const returnType = this.extractReturnType(node, sourceFile);
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const fullText = node.getText(sourceFile);
    const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;

    return {
      name,
      parameters,
      returnType,
      startLine: startLine + 1,
      endLine: endLine + 1,
      fullText,
      isAsync
    };
  }

  /**
   * 从变量声明中提取函数信息（箭头函数/函数表达式）
   */
  private extractFunctionFromVariable(
    declaration: ts.VariableDeclaration,
    sourceCode: string,
    sourceFile: ts.SourceFile
  ): FunctionInfo | null {
    const initializer = declaration.initializer;
    if (!initializer || (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer))) {
      return null;
    }

    const name = declaration.name.getText(sourceFile);
    const parameters = this.extractParameters(initializer, sourceFile);
    const returnType = this.extractReturnType(initializer, sourceFile);
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(declaration.getStart());
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(declaration.getEnd());
    const fullText = declaration.getText(sourceFile);
    const isAsync = initializer.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;

    return {
      name,
      parameters,
      returnType,
      startLine: startLine + 1,
      endLine: endLine + 1,
      fullText,
      isAsync
    };
  }

  /**
   * 提取函数参数信息
   */
  private extractParameters(node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression, sourceFile: ts.SourceFile): ParameterInfo[] {
    return node.parameters.map(param => {
      const name = param.name.getText(sourceFile);
      const type = param.type ? param.type.getText(sourceFile) : 'any';
      const optional = param.questionToken !== undefined;

      return { name, type, optional };
    });
  }

  /**
   * 提取返回类型
   */
  private extractReturnType(node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression, sourceFile: ts.SourceFile): string {
    if (node.type) {
      return node.type.getText(sourceFile);
    }
    return 'any';
  }

  /**
   * 提取函数体代码
   */
  public extractFunctionBody(functionInfo: FunctionInfo): string {
    return functionInfo.fullText;
  }

  /**
   * 从类声明中提取信息（将类作为构造函数）
   */
  private extractClassInfo(
    node: ts.ClassDeclaration,
    className: string,
    sourceFile: ts.SourceFile
  ): FunctionInfo | null {
    // 找到构造函数
    const constructor = node.members.find(m => ts.isConstructorDeclaration(m)) as ts.ConstructorDeclaration | undefined;
    
    const parameters = constructor ? constructor.parameters.map(param => {
      const name = param.name.getText(sourceFile);
      const type = param.type ? param.type.getText(sourceFile) : 'any';
      const optional = param.questionToken !== undefined;
      return { name, type, optional };
    }) : [];

    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const fullText = node.getText(sourceFile);

    return {
      name: className,
      parameters,
      returnType: className,
      startLine: startLine + 1,
      endLine: endLine + 1,
      fullText,
      isAsync: false,
      isClass: true
    };
  }

  /**
   * 从类方法中提取信息
   */
  private extractMethodInfo(
    node: ts.MethodDeclaration,
    className: string,
    sourceFile: ts.SourceFile
  ): FunctionInfo | null {
    const name = node.name.getText(sourceFile);
    const parameters = node.parameters.map(param => {
      const paramName = param.name.getText(sourceFile);
      const type = param.type ? param.type.getText(sourceFile) : 'any';
      const optional = param.questionToken !== undefined;
      return { name: paramName, type, optional };
    });
    const returnType = node.type ? node.type.getText(sourceFile) : 'any';
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    const fullText = node.getText(sourceFile);
    const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;

    return {
      name: `${className}.${name}`,
      parameters,
      returnType,
      startLine: startLine + 1,
      endLine: endLine + 1,
      fullText,
      isAsync,
      className
    };
  }
}
