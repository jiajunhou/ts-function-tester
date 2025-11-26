import * as vm from 'vm';
import * as ts from 'typescript';

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime?: number;
}

/**
 * 代码执行器
 */
export class CodeExecutor {
  /**
   * 执行函数代码（支持高阶函数测试）
   */
  public async executeFunction(
    functionCode: string,
    functionName: string,
    argsWithTypes: Array<{value: string, type: string}>, // 修改：接收原始字符串
    isAsync: boolean,
    testArgs?: string // 新增：高阶函数测试参数
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // 将 TypeScript 编译为 JavaScript
      const jsCode = this.transpileTypeScript(functionCode);

      // 创建沙箱环境
      const sandbox = this.createSandbox();

      // 🔥 关键：将 TypeScript 转译能力注入沙箱
      sandbox._transpileTS = (code: string) => {
        try {
          return this.transpileTypeScript(code);
        } catch (e: any) {
          return code; // 转译失败就返回原始代码
        }
      };

      // 将原始参数值传入沙箱（不预处理）
      sandbox._argsData = argsWithTypes.map(arg => arg.value);
      sandbox._testArgsStr = testArgs || '';
      sandbox._functionName = functionName;

      // 在沙箱中执行代码（定义所有函数）
      const script = new vm.Script(jsCode);
      const context = vm.createContext(sandbox);
      script.runInContext(context);

  
      const executionScript = new vm.Script(`
        (async function() {
          // ============ 步骤1：在沙箱内解析参数 ============
          const parsedArgs = _argsData.map((value, index) => {
            const trimmed = value.trim();
            console.log('[沙箱调试] 参数' + index + ' 原始值:', trimmed);
            if (!trimmed) return undefined;
            
        
            let codeToEval = trimmed;
            
            // 如果包含类型注解，先转译
            if (trimmed.includes(':') || trimmed.includes('item is')) {
              const transpiled = _transpileTS(trimmed);
              console.log('[沙箱调试] 参数' + index + ' 转译后:', transpiled);
              // 清理 TS 编译器输出
              codeToEval = transpiled
                .replace(/^"use strict";?\s*/g, '')
                .replace(/^Object\.defineProperty\([^)]+\);?\s*/g, '')
                .replace(/^exports\.__esModule[^;]+;?\s*/g, '')
                .replace(/;\s*$/g, '')  // 移除末尾分号
                .trim();
              console.log('[沙箱调试] 参数' + index + ' 清理后:', codeToEval);
            }
            
            // 直接 eval
            try {
              const result = eval('(' + codeToEval + ')');
        
              return result;
            } catch (evalError) {
             
            }
            
            // 尝试 JSON 解析
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              try {
                const result = JSON.parse(trimmed);
               
                return result;
              } catch (jsonError) {
                
              }
            }
            
            // 特殊值
            if (trimmed === 'true') return true;
            if (trimmed === 'false') return false;
            if (trimmed === 'null') return null;
            if (trimmed === 'undefined') return undefined;
            if (trimmed === 'NaN') return NaN;
            if (trimmed === 'Infinity') return Infinity;
            
            // 数字
            const num = Number(trimmed);
            if (!isNaN(num)) return num;
            
            // 字符串（移除引号）
            if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
                (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
              return trimmed.slice(1, -1);
            }
            
            // 默认字符串
            console.log('[沙箱调试] 参数' + index + ' -> 默认返回字符串');
            return trimmed;
          });
          
          console.log('[沙箱执行] 解析后的参数:', parsedArgs);
          console.log('[沙箱执行] 目标函数:', ${functionName});
          console.log('[沙箱执行] 函数源码:', ${functionName}.toString());
          
       
          const funcStr = ${functionName}.toString();
          const hasRestParams = funcStr.includes('...');
          
  
          
          // ============ 步骤2：执行目标函数 ============
          let result;
          
          // 如果函数使用剩余参数且第一个参数是数组，则展开数组
          if (hasRestParams && parsedArgs.length === 1 && Array.isArray(parsedArgs[0])) {
            console.log('[沙箱执行] 检测到剩余参数，展开数组传递');
            if (${isAsync}) {
              result = await ${functionName}(...parsedArgs[0]);
            } else {
              result = ${functionName}(...parsedArgs[0]);
            }
          } else {
            if (${isAsync}) {
              result = await ${functionName}(...parsedArgs);
            } else {
              result = ${functionName}(...parsedArgs);
            }
          }
          
          console.log('[沙箱执行] 函数返回结果类型:', typeof result);
          
          // ============ 步骤3：如果返回函数且有测试参数，立即执行 ============
          if (typeof result === 'function' && _testArgsStr && _testArgsStr.trim()) {
            console.log('[沙箱执行] 检测到返回函数，测试参数:', _testArgsStr);
            
            // 在同一个沙箱内解析测试参数
            const testArgs = _testArgsStr.split(',').map(arg => {
              const trimmed = arg.trim();
              const num = Number(trimmed);
              if (!isNaN(num)) return num;
              try { return JSON.parse(trimmed); } catch {}
              return trimmed;
            });
            
            console.log('[沙箱执行] 测试参数解析:', testArgs);
            
        
            if (${isAsync}) {
              result = await result(...testArgs);
            } else {
              result = result(...testArgs);
            }

          }
          
          return result;
        })()
      `);
      
      let result = executionScript.runInContext(context);
      
      // 如果是 Promise，等待结果
      if (result && typeof result.then === 'function') {
        result = await result;
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result: this.serializeResult(result), // 序列化结果
        executionTime
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 将 TypeScript 编译为 JavaScript
   */
  private transpileTypeScript(code: string): string {
    const result = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        strict: false,
        esModuleInterop: true
      }
    });
    return result.outputText;
  }

  /**
   * 创建安全的沙箱环境
   */
  private createSandbox(): any {
    // 创建功能完整的沙箱，支持复杂场景
    const sandbox = {
      console: {
        log: (...args: any[]) => console.log('[函数输出]', ...args),
        error: (...args: any[]) => console.error('[函数错误]', ...args),
        warn: (...args: any[]) => console.warn('[函数警告]', ...args),
        info: (...args: any[]) => console.info('[函数信息]', ...args)
      },
      // 定时器
      setTimeout: setTimeout,
      setInterval: setInterval,
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
      // Promise 和异步
      Promise: Promise,
      // 基础类型
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Date: Date,
      Math: Math,
      JSON: JSON,
      RegExp: RegExp,
      Set: Set,
      Map: Map,
      WeakMap: WeakMap,
      WeakSet: WeakSet,
      Symbol: Symbol,
      // 错误类型
      Error: Error,
      TypeError: TypeError,
      RangeError: RangeError,
      SyntaxError: SyntaxError,
      ReferenceError: ReferenceError,
      // 工具函数
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      encodeURI: encodeURI,
      decodeURI: decodeURI,
      encodeURIComponent: encodeURIComponent,
      decodeURIComponent: decodeURIComponent,

      undefined: undefined,
      null: null,
      NaN: NaN,
      Infinity: Infinity
    };

    return sandbox;
  }

  /**
   * 序列化结果以便传输
   */
  private serializeResult(result: any): any {
    if (result === undefined) {
      return 'undefined';
    }
    if (result === null) {
      return 'null';
    }
    if (typeof result === 'function') {
      const funcStr = result.toString();
      return {
        _type: 'function',
        _hint: '返回了一个函数（高阶函数）',
        _source: funcStr.length > 150 ? funcStr.substring(0, 150) + '...' : funcStr,
        _suggestion: '提示：这是一个高阶函数，返回了另一个函数。如需测试返回的函数，请创建一个包装函数。'
      };
    }
    if (result instanceof Error) {
      return {
        type: 'Error',
        message: result.message,
        stack: result.stack
      };
    }
    if (typeof result === 'object') {
      try {
        return JSON.parse(JSON.stringify(result));
      } catch {
        return String(result);
      }
    }
    return result;
  }

  /**
   * 解析参数值
   */
  public parseArgumentValue(value: string, type: string): any {
    if (!value || value.trim() === '') {
      return undefined;
    }

    const trimmedValue = value.trim();

    try {
      // 1. 检测是否是函数数组（包含 => 或 function 关键字）
      if (trimmedValue.startsWith('[') && (trimmedValue.includes('=>') || trimmedValue.includes('function'))) {
        try {
          console.log('[参数解析] 检测到函数数组:', trimmedValue);
          
          // 先转译 TypeScript 为 JavaScript
          let jsCode = trimmedValue;
          if (trimmedValue.includes(':') || trimmedValue.includes('item is')) {
            const wrappedCode = `const _tempArray = ${trimmedValue};`;
            console.log('[参数解析] 包装代码:', wrappedCode);
            
            const transpiled = this.transpileTypeScript(wrappedCode);
            console.log('[参数解析] 转译结果:', transpiled);
            
            // 提取转译后的数组部分
            const match = transpiled.match(/_tempArray = ([^;]+);/);
            if (match) {
              jsCode = match[1];
              console.log('[参数解析] 提取的JS数组:', jsCode);
            }
          }
          
          // 使用 eval 执行（支持函数）
          const result = eval(jsCode);
        
          return result;
        } catch (evalError) {
          console.error('[参数解析] 函数数组解析失败:', evalError);
        }
      }
      
      // 2. 尝试解析为普通 JSON（对象、数组等）
      if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
        return JSON.parse(trimmedValue);
      }

      // 2. 布尔值
      if (trimmedValue === 'true') { return true; }
      if (trimmedValue === 'false') { return false; }

      // 3. null 和 undefined
      if (trimmedValue === 'null') { return null; }
      if (trimmedValue === 'undefined') { return undefined; }

      // 4. 特殊值
      if (trimmedValue === 'NaN') { return NaN; }
      if (trimmedValue === 'Infinity') { return Infinity; }
      if (trimmedValue === '-Infinity') { return -Infinity; }

      // 5. Date 类型（支持多种格式）
      if (type === 'Date' || type.includes('Date')) {
        // ISO 字符串、时间戳等
        const date = new Date(trimmedValue);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      // 6. 特殊对象构造（new Map、new Set、new Date 等）
      if (trimmedValue.startsWith('new ')) {
        try {
          // 使用 eval 执行构造器
          return eval(trimmedValue);
        } catch {
          return null;
        }
      }

      // 7. 函数类型（支持箭头函数和 function 声明）
      if (type.includes('=>') || type.startsWith('(') || type.includes('item is')) {

        if (trimmedValue.includes('=>') || trimmedValue.startsWith('function')) {
          try {
            console.log('[参数解析] 原始输入:', trimmedValue);
            console.log('[参数解析] 类型:', type);
            
            let jsCode = trimmedValue;
            
            // 如果包含类型注解，先转译
            if (trimmedValue.includes(':') || trimmedValue.includes('item is')) {
              try {
                // 包装成完整的箭头函数再转译
                const wrappedCode = `const _tempFunc = ${trimmedValue};`;
                console.log('[参数解析] 包装代码:', wrappedCode);
                
                const transpiled = this.transpileTypeScript(wrappedCode);
                console.log('[参数解析] 转译结果:', transpiled);
                
                // 提取转译后的函数部分 - 兼容多种格式
                let match = transpiled.match(/var _tempFunc = ([^;]+);/);
                if (!match) {
                  match = transpiled.match(/const _tempFunc = ([^;]+);/);
                }
                if (!match) {
                  // 尝试匹配到换行符
                  match = transpiled.match(/_tempFunc = ([^\n;]+)/);
                }
                
                if (match) {
                  jsCode = match[1];
                  console.log('[参数解析] 提取的JS函数:', jsCode);
                } else {
                  console.log('[参数解析] 无法提取函数，使用原始输入');
                }
              } catch (transpileError) {
                console.log('[参数解析] 转译失败，尝试直接执行:', transpileError);
              }
            }
            
            // 执行转译后的 JavaScript 代码
            let func;
            try {
              func = eval(`(${jsCode})`);
              console.log('[参数解析] eval成功，函数类型:', typeof func);
            } catch (e1: any) {
              console.log('[参数解析] eval(括号)失败:', e1.message);
              try {
                func = eval(jsCode);
                console.log('[参数解析] eval(无括号)成功');
              } catch (e2: any) {
                console.log('[参数解析] eval(无括号)失败:', e2.message);
                // 最后尝试使用 Function 构造器
                const arrowMatch = jsCode.match(/\(([^)]*)\)\s*=>\s*(.+)/);
                if (arrowMatch) {
                  const params = arrowMatch[1];
                  const body = arrowMatch[2];
                  console.log('[参数解析] Function构造器 - 参数:', params, '函数体:', body);
                  func = new Function(params, `return ${body}`);
                }
              }
            }
            
            if (func && typeof func === 'function') {
      
              return func;
            } else {
       
            }
          } catch (err) {
         
            return null;
          }
        }
        return null; // 函数参数默认 null
      }

      // 8. 数字类型
      if (type.toLowerCase() === 'number' || !isNaN(Number(trimmedValue))) {
        const num = Number(trimmedValue);
        if (!isNaN(num)) {
          return num;
        }
      }

      // 9. 字符串（移除引号）
      if ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
          (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))) {
        return trimmedValue.slice(1, -1);
      }

      // 10. 默认作为字符串
      return trimmedValue;
    } catch (error) {
      // 解析失败，返回原始字符串
      return trimmedValue;
    }
  }
}
