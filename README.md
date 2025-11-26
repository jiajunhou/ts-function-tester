# ScriptTesters

VSCode 插件，用于实时测试 TypeScript 和 JavaScript 函数，无需编写测试代码。

## 功能特性

- 自动解析 TS/JS 文件中的函数
- 侧边栏直接输入参数测试
- 支持复杂类型（对象、数组、泛型）
- 支持高阶函数（函数返回函数）
- 支持类型守卫语法
- 参数自动缓存
- 历史记录快速回填
- JSON 结果语法高亮
- 显示执行时间
- CodeLens 快速跳转

## 使用方法

### 基础使用

1. 打开包含 TypeScript 或 JavaScript 函数的文件
2. 点击左侧活动栏的 ScriptTesters 图标
3. 在侧边栏中展开要测试的函数
4. 填写参数值
5. 点击执行按钮查看结果

### 参数输入格式

**简单类型**
```
数字: 42
字符串: hello
布尔值: true
```

**对象**
```json
{"name": "张三", "age": 25}
```

**数组**
```json
[1, 2, 3]
["a", "b", "c"]
```

**函数**
```javascript
(x) => x * 2
```

**函数数组**
```javascript
[(x) => x + 10, (x) => x * 2]
```

### 高阶函数测试

当函数返回另一个函数时，会出现"返回函数的测试参数"输入框，用于测试返回的函数。

示例：
```typescript
function createMultiplier(factor: number) {
  return (x: number) => x * factor;
}
```

测试步骤：
- 参数 factor: `5`
- 返回函数测试参数: `10`
- 结果: `50`

## 支持的函数类型

### 基础函数
```typescript
function add(a: number, b: number): number {
  return a + b;
}
```

### 泛型函数
```typescript
function first<T>(arr: T[]): T {
  return arr[0];
}
```

### 类型守卫
```typescript
function filterNumbers<T>(arr: T[], guard: (item: T) => item is number): number[] {
  return arr.filter(guard);
}
```

### 函数组合
```typescript
function pipe<T>(...fns: ((arg: T) => T)[]): (arg: T) => T {
  return (initialValue: T) => fns.reduce((acc, fn) => fn(acc), initialValue);
}
```

### 数据处理
```typescript
function groupBy<T, K extends string | number>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}
```

## 限制说明

### 不支持的场景

**异步网络请求**
```typescript
// 不支持
async function fetchUser(id: number) {
  const response = await fetch('/api/user');
  return response.json();
}

// 改为同步模拟
function mockFetchUser(id: number) {
  return { id, name: `用户${id}` };
}
```

**DOM 操作**
```typescript
// 不支持
function updateDOM(text: string) {
  document.getElementById('app').innerHTML = text;
}

// 改为返回数据
function generateHTML(text: string): string {
  return `<div>${text}</div>`;
}
```

**全局状态**
```typescript
// 不支持
let counter = 0;
function increment() {
  counter++;
  return counter;
}

// 改为参数传递
function increment(counter: number): number {
  return counter + 1;
}
```

**对象方法连续调用**
```typescript
// 不支持
class Counter {
  private count = 0;
  increment() { this.count++; }
  getValue() { return this.count; }
}

// 改为接收操作数组
function processCounter(initial: number, operations: string[]): number {
  let count = initial;
  operations.forEach(op => {
    if (op === 'increment') count++;
    else if (op === 'decrement') count--;
  });
  return count;
}
```

**文件系统访问**
```typescript
// 不支持
function readFile(path: string) {
  return fs.readFileSync(path, 'utf-8');
}

// 改为接收内容
function parseContent(content: string) {
  return content.split('\n');
}
```

## 技术说明

- 运行环境: Node.js VM 沙箱
- 支持语法: ES2020 + TypeScript
- 执行超时: 30 秒
- 使用 TypeScript Compiler API 转译代码

## 常见问题

**Q: 为什么显示 "invalid JSON"？**

A: JSON 格式要求使用双引号，检查：
- 属性名必须加引号: `{"name": "value"}`
- 字符串值使用双引号: `["hello", "world"]`

**Q: 如何输入特殊字符？**

A: 直接在 textarea 输入框中输入，支持所有字符包括反引号、$、换行符等。

**Q: 函数数组的顺序重要吗？**

A: 对于 `compose` 函数（从右到左执行），顺序会影响结果；`pipe` 函数从左到右执行。

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 调试
按 F5 启动调试会话
```

## 版本

1.0.0

## 许可

MIT
