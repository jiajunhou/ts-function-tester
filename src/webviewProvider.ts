import * as vscode from 'vscode';
import { FunctionInfo } from './codeParser';

/**
 * Webview 提供器
 */
export class TestPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'tsFunctionTesterPanel';
  private _view?: vscode.WebviewView;
  private _pendingFunctions?: FunctionInfo[]; // 缓存待发送的函数列表

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('[Webview] resolveWebviewView 被调用，初始化 webview');
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 设置消息监听器
    if (this._messageHandler) {
      webviewView.webview.onDidReceiveMessage(this._messageHandler);
    }

    // 发送缓存的函数列表
    if (this._pendingFunctions) {
      console.log('[Webview] 发送缓存的函数列表，数量:', this._pendingFunctions.length);
      this.updateFunctions(this._pendingFunctions);
      this._pendingFunctions = undefined;
    }
  }

  private _messageHandler?: (message: any) => void;

  /**
   * 更新函数列表
   */
  public updateFunctions(functions: FunctionInfo[]) {
    console.log('[Webview] updateFunctions 调用，函数数量:', functions.length, 'view 存在:', !!this._view);
    
    if (this._view) {
      console.log('[Webview] 发送 updateFunctions 消息到前端');
      this._view.webview.postMessage({
        type: 'updateFunctions',
        functions: functions
      });
    } else {
      // webview 未初始化，缓存起来
      console.log('[Webview] view 未初始化，缓存函数列表');
      this._pendingFunctions = functions;
    }
  }

  /**
   * 发送执行结果
   */
  public sendExecutionResult(result: any) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'executionResult',
        result: result
      });
    }
  }

  /**
   * 设置消息处理器
   */
  public setMessageHandler(handler: (message: any) => void) {
    this._messageHandler = handler;
    if (this._view) {
      this._view.webview.onDidReceiveMessage(handler);
    }
  }

  /**
   * 聚焦到指定函数
   */
  public focusOnFunction(functionName: string) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'focusOnFunction',
        functionName: functionName
      });
    }
  }

  /**
   * 生成 Webview HTML
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>函数测试器</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 0;
    }

    .container {
      width: 100%;
      min-width: 320px;
    }

    .function-list {
      list-style: none;
    }

    .function-item {
      border-bottom: 1px solid var(--vscode-panel-border);
      cursor: pointer;
    }

    .function-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: background-color 0.1s;
    }

    .function-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .function-item.expanded .function-header {
      background: var(--vscode-list-activeSelectionBackground);
    }

    .expand-icon {
      width: 16px;
      height: 16px;
      display: inline-block;
      transition: transform 0.2s;
      flex-shrink: 0;
    }

    .function-item.expanded .expand-icon {
      transform: rotate(90deg);
    }

    .function-info {
      flex: 1;
    }

    .function-name {
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      flex: 1;
      cursor: pointer;
      color: var(--vscode-textLink-foreground);
      text-decoration: underline;
    }

    .function-name:hover {
      color: var(--vscode-textLink-activeForeground);
    }

    .function-signature {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-family: var(--vscode-editor-font-family);
    }

    .test-panel {
      background: var(--vscode-sideBar-background);
      border-top: 1px solid var(--vscode-panel-border);
      padding: 16px;
      display: none;
    }

    .function-item.expanded .test-panel {
      display: block;
    }

    .param-group {
      margin-bottom: 12px;
    }

    .param-label {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .param-type {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    .param-input {
      width: 100%;
      padding: 8px 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      border-radius: 2px;
    }

    .param-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .param-input.error {
      border-color: #f48771;
      background: rgba(244, 135, 113, 0.1);
    }

    .button-group {
      display: flex;
      gap: 4px;
      margin-top: 10px;
    }

    button {
      padding: 4px 10px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      font-size: 11px;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border);
    }

    button.secondary:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .result-panel {
      margin-top: 10px;
      padding: 0;
      background: transparent;
      border: none;
      display: none;
      font-size: 12px;
    }

    .result-panel.show {
      display: block;
    }

    .result-output {
      padding: 10px 12px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      white-space: pre;
      word-break: break-all;
      line-height: 1.6;
      min-height: 40px;
      display: block;
      overflow-x: auto;
      tab-size: 2;
    }

    .result-loading {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--vscode-descriptionForeground);
      border-top-color: var(--vscode-foreground);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .json-key {
      color: #9cdcfe;
    }

    .json-string {
      color: #ce9178;
    }

    .json-number {
      color: #b5cea8;
    }

    .json-boolean {
      color: #569cd6;
    }

    .json-null {
      color: #569cd6;
    }

    .result-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      display: block;
    }

    .execution-time {
      margin-top: 4px;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state {
      padding: 20px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .history-list {
      display: none;
    }

    .history-list.show {
      display: block;
    }

    .history-item {
      padding: 3px 8px;
      cursor: pointer;
      font-size: 11px;
      border-left: 2px solid transparent;
      background: var(--vscode-input-background);
      margin-bottom: 2px;
    }

    .history-item:hover {
      background: var(--vscode-list-hoverBackground);
      border-left-color: var(--vscode-focusBorder);
    }

    .error-hint {
      font-size: 10px;
      color: #f48771;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="container">
    <ul class="function-list" id="functionList">
      <li class="empty-state">请打开 TypeScript 或 JavaScript 文件</li>
    </ul>
  </div>

  <script>
    console.log('[前端] 脚本开始执行');
    
    const vscode = acquireVsCodeApi();
    console.log('[前端] vscode API 获取成功');
    
    let currentFunction = null;
    let functions = [];
    const functionHistory = {};
    const MAX_HISTORY_PER_FUNC = 3;
    const classInstances = {}; // 保存类实例 {className: instance}
    
    const state = vscode.getState() || {};
    const paramCache = state.paramCache || {};
    
    console.log('[前端] 初始化完成，准备监听消息');

    window.addEventListener('message', event => {
      const message = event.data;
      console.log('[前端] 收到消息:', message);
      
      try {
        if (message.type === 'updateFunctions') {
          console.log('[前端] 更新函数列表，数量:', message.functions.length);
          functions = message.functions;
          renderFunctionList(functions);
        } else if (message.type === 'executionResult') {
          showResult(message.result);
        } else if (message.type === 'focusOnFunction') {
          focusOnFunction(message.functionName);
        }
      } catch (error) {
        console.error('[前端] 处理消息出错:', error);
      }
    });

    function renderFunctionList(funcs) {
      console.log('[前端] renderFunctionList 被调用，函数数量:', funcs.length);
      const listEl = document.getElementById('functionList');
      
      if (funcs.length === 0) {
        console.log('[前端] 没有函数，显示空状态');
        listEl.innerHTML = '<li class="empty-state">未找到可测试的函数</li>';
        return;
      }

      console.log('[前端] 开始渲染函数列表...');
      
      // 分组：类和普通函数
      const classes = {}; // {className: {class: classInfo, methods: [methodInfo]}}
      const regularFunctions = [];
      
      funcs.forEach(func => {
        if (func.isClass) {
          // 类本身
          classes[func.name] = { class: func, methods: [] };
        } else if (func.className) {
          // 类方法
          if (!classes[func.className]) {
            classes[func.className] = { class: null, methods: [] };
          }
          classes[func.className].methods.push(func);
        } else {
          // 普通函数
          regularFunctions.push(func);
        }
      });
      
      let html = '';
      let index = 0;
      
      // 渲染普通函数
      regularFunctions.forEach(func => {
        const params = func.parameters.map(p => 
          p.name + (p.optional ? '?' : '') + ': ' + p.type
        ).join(', ');
        
        html += '<li class="function-item" data-index="' + index + '">' +
          '<div class="function-header">' +
          '<span class="expand-icon">▶</span>' +
          '<div class="function-info">' +
          '<div class="function-name">func: ' + func.name + '</div>' +
          '<div class="function-signature">(' + params + ') => ' + func.returnType + (func.isAsync ? ' [async]' : '') + '</div>' +
          '</div>' +
          '</div>' +
          '<div class="test-panel">' +
          '<div class="param-inputs" data-index="' + index + '"></div>' +
          '<div class="history-list" data-index="' + index + '" style="margin-bottom: 8px;"></div>' +
          '<div class="button-group">' +
          '<button class="execute-btn" data-index="' + index + '">执行</button>' +
          '<button class="secondary clear-btn" data-index="' + index + '">清空</button>' +
          '</div>' +
          '<div class="result-panel" data-index="' + index + '">' +
          '<span class="result-label">Output:</span>' +
          '<div class="result-output"></div>' +
          '<div class="execution-time"></div>' +
          '</div>' +
          '</div>' +
          '</li>';
        index++;
      });
      
      // 渲染类
      Object.keys(classes).forEach(className => {
        const classData = classes[className];
        const classInfo = classData.class;
        
        if (!classInfo) return; // 没有类定义，只有方法（理论上不应该发生）
        
        // 类头部
        html += '<li class="function-item class-item" data-index="' + index + '">' +
          '<div class="function-header">' +
          '<span class="expand-icon">▶</span>' +
          '<div class="function-info">' +
          '<div class="function-name">class: ' + className + '</div>' +
          '</div>' +
          '</div>' +
          '<div class="test-panel">';
        
        // 构造函数
        const constructorParams = classInfo.parameters.map(p => 
          p.name + (p.optional ? '?' : '') + ': ' + p.type
        ).join(', ');
        
        html += '<div style="margin-bottom: 12px; padding-left: 16px;">' +
          '<div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">constructor(' + constructorParams + ')</div>' +
          '<div class="param-inputs" data-index="' + index + '"></div>' +
          '<div class="history-list" data-index="' + index + '" style="margin-bottom: 8px;"></div>' +
          '<div class="button-group">' +
          '<button class="execute-btn" data-index="' + index + '">创建实例</button>' +
          '<button class="secondary clear-btn" data-index="' + index + '">清空</button>' +
          '</div>' +
          '<div class="result-panel" data-index="' + index + '">' +
          '<span class="result-label">Output:</span>' +
          '<div class="result-output"></div>' +
          '<div class="execution-time"></div>' +
          '</div>' +
          '</div>';
        
        index++;
        
        // 类方法
        classData.methods.forEach(method => {
          const methodName = method.name.split('.')[1]; // 去掉 "User." 前缀
          const methodParams = method.parameters.map(p => 
            p.name + (p.optional ? '?' : '') + ': ' + p.type
          ).join(', ');
          
          html += '<div class="method-wrapper" style="margin-bottom: 12px; padding-left: 16px; border-left: 2px solid var(--vscode-panel-border);">' +
            '<div class="method-name" style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; cursor: pointer;" data-method-index="' + index + '">' +
            methodName + '(' + methodParams + ') => ' + method.returnType +
            '</div>' +
            '<div class="param-inputs" data-index="' + index + '" style="display: none;"></div>' +
            '<div class="history-list" data-index="' + index + '" style="margin-bottom: 8px; display: none;"></div>' +
            '<div class="button-group" style="display: none;">' +
            '<button class="execute-btn method-execute-btn" data-index="' + index + '">执行</button>' +
            '<button class="secondary clear-btn" data-index="' + index + '">清空</button>' +
            '</div>' +
            '<div class="result-panel" data-index="' + index + '" style="display: none;">' +
            '<span class="result-label">Output:</span>' +
            '<div class="result-output"></div>' +
            '<div class="execution-time"></div>' +
            '</div>' +
            '</div>';
          
          index++;
        });
        
        html += '</div></li>';
      });
      
      listEl.innerHTML = html;

      listEl.querySelectorAll('.function-header').forEach((header) => {
        header.addEventListener('click', (e) => {
          const item = e.currentTarget.closest('.function-item');
          const index = parseInt(item.dataset.index);
          const isExpanded = item.classList.contains('expanded');
          
          // 关闭所有已展开的项
          document.querySelectorAll('.function-item.expanded').forEach(i => {
            i.classList.remove('expanded');
          });
          
          if (!isExpanded) {
            item.classList.add('expanded');
            currentFunction = functions[index];
            
            // 渲染参数输入框
            const container = item.querySelector('.test-panel > .param-inputs');
            if (container && currentFunction.parameters) {
              console.log('[前端] 渲染参数:', currentFunction.name, currentFunction.parameters.length);
              renderParams(container, currentFunction.parameters, currentFunction.name);
            }
            renderFunctionHistory(index);
          } else {
            currentFunction = null;
          }
        });
      });

      listEl.querySelectorAll('.execute-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          executeFunction(index);
        });
      });

      listEl.querySelectorAll('.clear-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          clearInputs(index);
        });
      });
      
      listEl.querySelectorAll('.function-name').forEach((nameEl) => {
        nameEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = e.target.closest('.function-item');
          const index = parseInt(item.dataset.index);
          const func = functions[index];
          
          vscode.postMessage({
            type: 'jumpToDefinition',
            functionName: func.name,
            line: func.line
          });
        });
      });
      
      // 添加类方法点击事件
      listEl.querySelectorAll('.method-name').forEach((methodEl) => {
        methodEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const methodIndex = parseInt(methodEl.dataset.methodIndex);
          const wrapper = methodEl.closest('.method-wrapper');
          const func = functions[methodIndex];
          
          // 切换展开/收起
          const container = wrapper.querySelector('.param-inputs');
          const buttonGroup = wrapper.querySelector('.button-group');
          const resultPanel = wrapper.querySelector('.result-panel');
          
          if (container.style.display === 'none') {
            // 展开：渲染参数输入框
            container.style.display = 'block';
            buttonGroup.style.display = 'flex';
            renderParams(container, func.parameters, func.name);
            currentFunction = func;
          } else {
            // 收起
            container.style.display = 'none';
            buttonGroup.style.display = 'none';
            resultPanel.style.display = 'none';
            currentFunction = null;
          }
        });
      });
    }

    function toggleFunction(index, item) {
      const wasExpanded = item.classList.contains('expanded');
      
      document.querySelectorAll('.function-item.expanded').forEach(i => {
        i.classList.remove('expanded');
      });

      if (!wasExpanded) {
        item.classList.add('expanded');
        currentFunction = functions[index];
        renderParamInputs(index, currentFunction.parameters);
        renderFunctionHistory(index);
      } else {
        currentFunction = null;
      }
    }
    
    function focusOnFunction(functionName) {
      const index = functions.findIndex(f => f.name === functionName);
      if (index === -1) return;
      
      const item = document.querySelector('.function-item[data-index="' + index + '"]');
      if (!item) return;
      
      toggleFunction(index, item);
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function renderParamInputs(index, params) {
      const item = document.querySelector('.function-item[data-index="' + index + '"]');
      if (!item) return;
      
      // 在 item 内部查找 param-inputs 容器
      const container = item.querySelector('.param-inputs[data-index="' + index + '"]');
      if (!container) return;
      
      const func = functions[index];
      
      if (params.length === 0) {
        container.innerHTML = '<p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 8px;">无参数</p>';
        return;
      }

      let html = params.map(param => {
        const cachedValue = getCachedParam(func.name, param.name);
        return '<div class="param-group">' +
          '<label class="param-label">' +
          param.name + ' <span class="param-type">' + param.type + '</span>' +
          '</label>' +
          '<textarea class="param-input" data-param="' + param.name + '" data-type="' + param.type + '" ' +
          'placeholder="' + param.type + '" rows="1" ' +
          'style="resize: vertical; min-height: 32px; font-family: var(--vscode-editor-font-family);">' +
          cachedValue + '</textarea>' +
          '</div>';
      }).join('');
      
      container.innerHTML = html;
      
      setTimeout(() => {
        const inputs = container.querySelectorAll('.param-input');
        inputs.forEach(input => {
          input.addEventListener('input', (e) => {
            const paramName = e.target.dataset.param;
            saveParamCache(func.name, paramName, e.target.value);
          });
        });
      }, 0);
    }

    // 直接渲染参数到指定容器
    function renderParams(container, params, functionName) {
      if (!params || params.length === 0) {
        container.innerHTML = '<p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 8px;">无参数</p>';
        return;
      }

      let html = params.map(param => {
        const cachedValue = getCachedParam(functionName, param.name);
        
        // 检测是否是函数类型参数
        const isFunctionType = param.type.includes('=>') || param.type.includes('Function') || /^[A-Z]/.test(param.type);
        const placeholder = isFunctionType 
          ? '例：(a, b) => a + b'
          : param.type;
        
        // 为函数类型生成示例
        let exampleBtn = '';
        if (isFunctionType && param.type.includes('number')) {
          exampleBtn = '<button class="example-btn" data-param="' + param.name + '" data-example="(a, b, c) => a + b + c" style="margin-top: 4px; padding: 2px 8px; font-size: 11px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; cursor: pointer;">填充示例函数</button>';
        } else if (isFunctionType) {
          exampleBtn = '<button class="example-btn" data-param="' + param.name + '" data-example="(x) => x * 2" style="margin-top: 4px; padding: 2px 8px; font-size: 11px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; cursor: pointer;">填充示例函数</button>';
        }
        
        return '<div class="param-group">' +
          '<label class="param-label">' +
          param.name + ' <span class="param-type">' + param.type + '</span>' +
          (isFunctionType ? ' <span style="color: #858585; font-size: 10px;">← 输入函数</span>' : '') +
          '</label>' +
          '<textarea class="param-input" data-param="' + param.name + '" data-type="' + param.type + '" ' +
          'placeholder="' + placeholder + '" rows="' + (isFunctionType ? '2' : '1') + '" ' +
          'style="resize: vertical; min-height: ' + (isFunctionType ? '48px' : '32px') + '; font-family: var(--vscode-editor-font-family);">' +
          cachedValue + '</textarea>' +
          exampleBtn +
          '</div>';
      }).join('');
      
      container.innerHTML = html;
      
      setTimeout(() => {
        const inputs = container.querySelectorAll('.param-input');
        inputs.forEach(input => {
          input.addEventListener('input', (e) => {
            const paramName = e.target.dataset.param;
            saveParamCache(functionName, paramName, e.target.value);
          });
        });
        
        // 添加示例按钮的点击事件
        const exampleBtns = container.querySelectorAll('.example-btn');
        exampleBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const paramName = btn.dataset.param;
            const example = btn.dataset.example;
            const input = container.querySelector('.param-input[data-param="' + paramName + '"]');
            if (input) {
              input.value = example;
              saveParamCache(functionName, paramName, example);
            }
          });
        });
      }, 0);
    }

    function executeFunction(index) {
      if (!currentFunction) return;

      // 对于类方法，从 method-wrapper 查找元素
      let item, inputs, panel, output;
      
      const func = functions[index];
      if (func.className && !func.isClass) {
        // 类方法：查找 method-wrapper
        const methodName = document.querySelector('.method-name[data-method-index="' + index + '"]');
        if (!methodName) return;
        const wrapper = methodName.closest('.method-wrapper');
        if (!wrapper) return;
        
        inputs = wrapper.querySelectorAll('.param-input');
        panel = wrapper.querySelector('.result-panel');
        output = panel.querySelector('.result-output');
      } else {
        // 普通函数或类构造函数
        item = document.querySelector('.function-item[data-index="' + index + '"]');
        if (!item) return;
        inputs = item.querySelectorAll('.param-input');
        panel = item.querySelector('.result-panel');
        output = panel.querySelector('.result-output');
      }
      
      inputs.forEach(input => {
        input.classList.remove('error');
        const errorHint = input.parentElement.querySelector('.error-hint');
        if (errorHint) errorHint.remove();
      });
      
      const args = [];
      let hasError = false;
      
      inputs.forEach(input => {
        const paramName = input.dataset.param;
        const type = input.dataset.type;
        const value = input.value.trim();
        
        const validation = validateInput(value, type);
        if (!validation.valid) {
          input.classList.add('error');
          const hint = document.createElement('div');
          hint.className = 'error-hint';
          hint.textContent = validation.error;
          input.parentElement.appendChild(hint);
          hasError = true;
        }
        
        args.push({ value: value || '', type: type });
      });
      
      if (hasError) return;
      
      // 检查是否是类方法
      if (func.className && !func.isClass) {
        // 这是类方法，检查实例是否存在
        const instance = classInstances[func.className];
        if (!instance) {
          panel.style.display = 'block';
          output.textContent = '错误：请先创建 ' + func.className + ' 的实例';
          output.style.color = '#f48771';
          return;
        }
      }
      
      panel.style.display = 'block';
      panel.classList.add('show');
      output.innerHTML = '<div class="result-loading"></div><span>执行中...</span>';
      output.style.color = 'var(--vscode-foreground)';
      
      saveToHistory({
        functionName: currentFunction.name,
        args: args,
        timestamp: Date.now()
      });

      vscode.postMessage({
        type: 'executeFunction',
        functionName: currentFunction.name,
        arguments: args,
        index: index,
        isMethod: func.className && !func.isClass, // 标记是否是类方法
        className: func.className, // 传递类名
        instance: func.className && !func.isClass ? classInstances[func.className] : undefined // 传递实例
      });
      
      console.log('发送执行请求:', {
        functionName: currentFunction.name,
        args: args,
        index: index,
        isMethod: func.className && !func.isClass,
        className: func.className
      });
    }

    function clearInputs(index) {
      const item = document.querySelector('.function-item[data-index="' + index + '"]');
      item.querySelectorAll('.param-input').forEach(input => {
        input.value = '';
      });
      const resultPanel = item.querySelector('.result-panel');
      resultPanel.classList.remove('show');
    }

    function showResult(result) {
      const index = result.index || 0;
      const func = functions[index];
      
      let panel, output, time;
      
      if (func && func.className && !func.isClass) {
        // 类方法：查找 method-wrapper
        const methodName = document.querySelector('.method-name[data-method-index="' + index + '"]');
        if (!methodName) return;
        const wrapper = methodName.closest('.method-wrapper');
        if (!wrapper) return;
        
        panel = wrapper.querySelector('.result-panel');
        output = panel.querySelector('.result-output');
        time = panel.querySelector('.execution-time');
      } else {
        // 普通函数或类构造函数
        const item = document.querySelector('.function-item[data-index="' + index + '"]');
        if (!item) return;
        
        panel = item.querySelector('.result-panel');
        output = panel.querySelector('.result-output');
        time = panel.querySelector('.execution-time');
      }

      panel.style.display = 'block';
      panel.classList.add('show');
      
      if (result.success) {
        output.innerHTML = formatResult(result.result);
        output.style.color = 'var(--vscode-foreground)';
        
        // 如果是类构造函数，保存实例
        if (func && func.isClass && result.result) {
          classInstances[func.name] = result.result;
          console.log('[前端] 保存类实例:', func.name, result.result);
        }
      } else {
        output.textContent = result.error;
        output.style.color = '#f48771';
      }

      if (result.executionTime !== undefined) {
        time.textContent = 'execution time: ' + result.executionTime + 'ms';
      }
    }

    function formatResult(result) {
      if (typeof result === 'object' && result !== null) {
        const jsonStr = JSON.stringify(result, null, 2);
        return syntaxHighlight(jsonStr);
      }
      return escapeHtml(String(result));
    }

    function syntaxHighlight(json) {
      // 先转义 HTML
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      // 高亮 JSON 元素
      return json
        // 高亮键名（包括冒号）
        .replace(/"([^"]*?)":/g, '<span class="json-key">"$1"</span>:')
        // 高亮字符串值（不包括键名）
        .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/\\[\\s*"([^"]*)"/g, '[<span class="json-string">"$1"</span>')
        .replace(/,\\s*"([^"]*)"/g, ', <span class="json-string">"$1"</span>')
        // 高亮数字
        .replace(/: (-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)/g, ': <span class="json-number">$1</span>')
        .replace(/\\[\\s*(-?\\d+)/g, '[<span class="json-number">$1</span>')
        .replace(/,\\s*(-?\\d+)/g, ', <span class="json-number">$1</span>')
        // 高亮布尔值
        .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
        .replace(/\\[\\s*(true|false)/g, '[<span class="json-boolean">$1</span>')
        .replace(/,\\s*(true|false)/g, ', <span class="json-boolean">$1</span>')
        // 高亮 null
        .replace(/: null/g, ': <span class="json-null">null</span>')
        .replace(/\\[\\s*null/g, '[<span class="json-null">null</span>')
        .replace(/,\\s*null/g, ', <span class="json-null">null</span>');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function saveParamCache(functionName, paramName, value) {
      if (!paramCache[functionName]) {
        paramCache[functionName] = {};
      }
      paramCache[functionName][paramName] = value;
      vscode.setState({ ...state, paramCache });
    }

    function getCachedParam(functionName, paramName) {
      return paramCache[functionName]?.[paramName] || '';
    }

    function validateInput(value, type) {
      if (!value) {
        return { valid: true };
      }

      const lowerType = type.toLowerCase();

      try {
        if (lowerType === 'number') {
          if (isNaN(Number(value))) {
            return { valid: false, error: 'not a number' };
          }
        } else if (lowerType === 'boolean') {
          if (value !== 'true' && value !== 'false') {
            return { valid: false, error: 'must be true or false' };
          }
        } else if (value.startsWith('{') || value.startsWith('[')) {
          if (value.includes('=>') || value.includes('function')) {
            return { valid: true };
          }
          JSON.parse(value);
        }
      } catch (e) {
        return { valid: false, error: 'invalid JSON' };
      }

      return { valid: true };
    }

    function saveToHistory(record) {
      const funcName = record.functionName;
      if (!functionHistory[funcName]) {
        functionHistory[funcName] = [];
      }
      
      functionHistory[funcName].unshift(record);
      if (functionHistory[funcName].length > MAX_HISTORY_PER_FUNC) {
        functionHistory[funcName].pop();
      }
      
      const funcIndex = functions.findIndex(f => f.name === funcName);
      if (funcIndex !== -1) {
        renderFunctionHistory(funcIndex);
      }
    }

    function renderFunctionHistory(funcIndex) {
      const func = functions[funcIndex];
      if (!func) return;

      const historyContainer = document.querySelector('.history-list[data-index="' + funcIndex + '"]');
      if (!historyContainer) return;

      const history = functionHistory[func.name] || [];
      
      if (history.length === 0) {
        historyContainer.classList.remove('show');
        historyContainer.innerHTML = '';
        return;
      }

      historyContainer.classList.add('show');
      historyContainer.innerHTML = '<div style="font-size: 10px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">Recent:</div>' +
        history.map((record, index) => {
          const argsStr = record.args.map(a => {
            const val = a.value.length > 20 ? a.value.substring(0, 20) + '...' : a.value;
            return val;
          }).join(', ');

          return '<div class="history-item" data-func-index="' + funcIndex + '" data-history-index="' + index + '" style="font-family: var(--vscode-editor-font-family);">' +
            func.name + '(' + argsStr + ')' +
            '</div>';
        }).join('');

      historyContainer.querySelectorAll('.history-item').forEach(histItem => {
        histItem.addEventListener('click', (e) => {
          e.stopPropagation();
          const fIndex = parseInt(histItem.dataset.funcIndex);
          const hIndex = parseInt(histItem.dataset.historyIndex);
          replayHistory(fIndex, hIndex);
        });
      });
    }

    function replayHistory(funcIndex, historyIndex) {
      const func = functions[funcIndex];
      if (!func) return;

      const history = functionHistory[func.name];
      if (!history || !history[historyIndex]) return;

      const record = history[historyIndex];
      const item = document.querySelector('.function-item[data-index="' + funcIndex + '"]');
      if (!item) return;

      // 确保展开
      if (!item.classList.contains('expanded')) {
        item.classList.add('expanded');
        currentFunction = func;
        
        const container = item.querySelector('.test-panel > .param-inputs');
        if (container) {
          renderParams(container, func.parameters, func.name);
        }
      }

      // 增加等待时间，确保输入框完全渲染
      setTimeout(() => {
        const inputs = item.querySelectorAll('.param-input');
        console.log('[前端] 回填历史记录:', func.name, '输入框数量:', inputs.length, '参数数量:', record.args.length);
        
        record.args.forEach((arg, i) => {
          if (inputs[i]) {
            inputs[i].value = arg.value;
            console.log('[前端] 回填参数', i, ':', arg.value);
          }
        });
      }, 100);
    }
  </script>
</body>
</html>`;
  }
}
