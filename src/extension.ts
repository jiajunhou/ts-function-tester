import * as vscode from 'vscode';
import { CodeParser, FunctionInfo } from './codeParser';
import { CodeExecutor } from './codeExecutor';
import { TestPanelProvider } from './webviewProvider';

/**
 * CodeLens Provider - 在函数上方显示"测试"按钮
 */
class FunctionTestCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor(private getFunctions: () => FunctionInfo[]) {}

  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!['typescript', 'javascript'].includes(document.languageId)) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const functions = this.getFunctions();

    // 为每个函数添加 CodeLens
    functions.forEach(func => {
      const line = func.startLine - 1;
      const range = new vscode.Range(line, 0, line, 0);
      
      codeLenses.push(new vscode.CodeLens(range, {
        title: '$(play) TesterRunner',
        command: 'tsFunctionTester.testThisFunction',
        arguments: [func.name]
      }));
    });

    return codeLenses;
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }
}

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('TypeScript/JavaScript 函数测试器已激活');

  const codeParser = new CodeParser();
  const codeExecutor = new CodeExecutor();

  // 注册 Webview 提供器
  const provider = new TestPanelProvider(context.extensionUri);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TestPanelProvider.viewType,
      provider
    )
  );

  // 当前活动编辑器的函数列表
  let currentFunctions: FunctionInfo[] = [];

  // 注册 CodeLens 提供器（先创建，避免初始化顺序问题）
  const testCodeLensProvider = new FunctionTestCodeLensProvider(() => currentFunctions);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file', language: 'typescript' },
      testCodeLensProvider
    ),
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file', language: 'javascript' },
      testCodeLensProvider
    )
  );

  // 监听文本编辑器变化
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        updateFunctionList(editor);
      }
    })
  );

  // 监听文档内容变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        updateFunctionList(editor);
      }
    })
  );

  // 初始化时更新
  if (vscode.window.activeTextEditor) {
    updateFunctionList(vscode.window.activeTextEditor);
  }

  /**
   * 更新函数列表
   */
  function updateFunctionList(editor: vscode.TextEditor) {
    const document = editor.document;
    
    console.log('[调试] 文件类型:', document.languageId, '文件名:', document.fileName);
    
    // 只处理 TS/JS 文件
    if (!['typescript', 'javascript'].includes(document.languageId)) {
      console.log('[调试] 不支持的文件类型，跳过');
      provider.updateFunctions([]);
      return;
    }

    try {
      const sourceCode = document.getText();
      const fileName = document.fileName;
      currentFunctions = codeParser.parseFunctions(sourceCode, fileName);
      console.log('[调试] 解析到函数:', currentFunctions.map(f => f.name));
      provider.updateFunctions(currentFunctions);
      
      // 刷新 CodeLens
      testCodeLensProvider.refresh();
    } catch (error) {
      console.error('解析函数失败:', error);
      vscode.window.showErrorMessage(`解析函数失败: ${error}`);
    }
  }

  /**
   * 处理 Webview 消息
   */
  provider.setMessageHandler(async (message) => {
    if (message.type === 'executeFunction') {
      await handleFunctionExecution(message);
    } else if (message.type === 'jumpToDefinition') {
      await handleJumpToDefinition(message);
    }
  });

  /**
   * 跳转到函数定义
   */
  async function handleJumpToDefinition(message: any) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const functionName = message.functionName;

    // 查找函数信息
    const functionInfo = currentFunctions.find(f => f.name === functionName);
    if (!functionInfo) return;

    // 跳转到函数定义位置
    const position = new vscode.Position(functionInfo.startLine - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    
    // 聚焦到编辑器
    vscode.window.showTextDocument(editor.document);
  }

  /**
   * 执行函数
   */
  async function handleFunctionExecution(message: any) {
    const functionName = message.functionName;
    const args = message.arguments || [];
    const testArgs = message.testArgs; // 添加：获取测试参数
    const index = message.index || 0;

    // 查找函数信息
    const functionInfo = currentFunctions.find(f => f.name === functionName);
    if (!functionInfo) {
      provider.sendExecutionResult({
        success: false,
        error: `未找到函数 "${functionName}"`,
        index: index
      });
      return;
    }

    try {
      // 传递原始参数值（字符串）和类型，让沙箱自己解析
      const argsWithTypes = args.map((arg: any) => ({
        value: arg.value,
        type: arg.type
      }));

      // 执行函数（传递 testArgs 和 isClass）
      const result = await codeExecutor.executeFunction(
        functionInfo.fullText,
        functionName,
        argsWithTypes,
        functionInfo.isAsync,
        testArgs, // 传递测试参数
        functionInfo.isClass // 传递是否是类
      );

      // 添加 index 到结果中
      provider.sendExecutionResult({
        ...result,
        index: index
      });
    } catch (error: any) {
      provider.sendExecutionResult({
        success: false,
        error: error.message || String(error),
        index: index
      });
    }
  }

  // 注册命令：打开测试面板
  context.subscriptions.push(
    vscode.commands.registerCommand('tsFunctionTester.openPanel', () => {
      vscode.commands.executeCommand('workbench.view.extension.tsFunctionTester');
    })
  );

  // 注册命令：测试当前函数
  context.subscriptions.push(
    vscode.commands.registerCommand('tsFunctionTester.testFunction', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('请先打开一个文件');
        return;
      }

      // 打开侧边栏
      vscode.commands.executeCommand('workbench.view.extension.tsFunctionTester');
      
      // 更新函数列表
      updateFunctionList(editor);
    })
  );

  // 注册命令：测试当前函数
  context.subscriptions.push(
    vscode.commands.registerCommand('tsFunctionTester.testThisFunction', async (functionName: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('请先打开一个文件');
        return;
      }

      // 打开侧边栏
      vscode.commands.executeCommand('workbench.view.extension.tsFunctionTester');
      
      // 更新函数列表
      updateFunctionList(editor);
      
      // 延迟一下确保 UI 更新后再发消息
      setTimeout(() => {
        provider.focusOnFunction(functionName);
      }, 200);
    })
  );
}

/**
 * 插件停用
 */
export function deactivate() {
  console.log('TypeScript/JavaScript 函数测试器已停用');
}
