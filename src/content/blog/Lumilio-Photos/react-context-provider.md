---
title: "@Lumilio-Photos: React Context Provider"
description: 用 UploadContext 把 Lumilio-Photos 的上传状态、WASM 初始化和上传流程集中到一个可复用的前端状态边界里。
pubDate: 2026-05-02
updatedDate: 2026-05-02
order: 2
draft: false
tags:
  - Lumilio Photos
  - React
  - Context API
  - Frontend
---

参考项目 [流明集](https://github.com/EdwinZhanCN/Lumilio-Photos)

在使用 React.js 框架的前端应用中，状态管理是至关重要的一部分，完善的状态管理系统也是 React 框架受众多前端开发者青睐的原因之一。React 原生提供了几个比较重要的状态管理钩子，分别为 `useState`、`useReducer`、`useContext`、`useMemo` 和 `useRef`。

什么是状态管理？引用 React 官方文档的原文：

> [**State** is like a component’s memory.](https://react.dev/learn/state-a-components-memory) It lets a component keep track of some information and change it in response to interactions. For example, a `Button` might keep track of `isHovered` state.

## `useState`

这是 React 框架中最基础、最常用的 hook。从见到它的第一刻起，你就能窥探到整个 React 框架是如何设计 hooks 的。即，暴露一个变量、一个方法，并传入一些起始参数。

```typescript
const [count, setCount] = useState<number>(0);
```

这是一个经典的计数状态，通过一个暴露的 `setCount` 方法来控制 `count` 的值，这个值的生命周期仅在页面未刷新之前有效。这也是 React 状态管理最简单、最小的范式。

## `useReducer`

`useReducer` 是 `useState` 的一种替代方案。当状态逻辑复杂，或者下一个状态依赖于前一个状态时，`useReducer` 通常是更好的选择。Simply put，当你写了很多 `useState` 时，那么你就该考虑将它们封装成 `useReducer`。与 `useState` 相同，`useReducer` 也遵循了 React hooks 的经典设计，暴露了一个 `state` 变量和一个 `dispatch` 方法。你需要传入一个 `reducer` 方法和 `initialState` 初始变量。该 hook 借鉴了 React 的经典状态管理库 Redux。

```ts
function reducer(state: { count: number }, action: { type: string }) {
	switch (action.type) {
		case "increment":
			return { count: state.count + 1 };
		case "decrement":
			return { count: state.count - 1 };
		default:
			throw new Error();
	}
}

const [state, dispatch] = useReducer(reducer, initialState);
```

该 `useReducer` 通过一个 `dispatch` 方法，可以使用不同的 `action` 同时接管两个状态，提升了代码整洁性和可维护性。

## `useContext`

`useContext` 将会为本篇内容的重点。它用于在组件树中进行跨层级状态共享，想象一下下面这种组件情景：

```jsx
import React, { useState } from "react";

const componentStyle = (color) => ({
  border: `2px solid ${color}`,
  borderRadius: "8px",
  padding: "16px",
  margin: "16px",
  textAlign: "center",
});

function ComponentC({ user }) {
  console.log("ComponentC rendered. I need the 'user' prop.");
  return (
    <div style={componentStyle("red")}>
      <h3>组件 C</h3>
      <p>你好, {user.name}！</p>
    </div>
  );
}

function ComponentB({ user }) {
  console.log("ComponentB rendered. I don't need 'user', but I have to pass it down.");
  return (
    <div style={componentStyle("orange")}>
      <h2>组件 B</h2>
      <p>我只是一个“中间人”。</p>
      <ComponentC user={user} />
    </div>
  );
}

function ComponentA({ user }) {
  console.log("ComponentA rendered. I also don't need 'user', just passing it along.");
  return (
    <div style={componentStyle("blue")}>
      <h1>组件 A</h1>
      <ComponentB user={user} />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState({ name: "小明" });

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <h2>属性钻探 (Prop Drilling) 示例</h2>
      <p>
        <code>user</code> 状态从 <strong>App</strong> 组件开始，穿过 <strong>组件A</strong> 和
        <strong>组件B</strong>，最终到达 <strong>组件C</strong>。
      </p>
      <ComponentA user={user} />
    </div>
  );
}
```

显而易见，数据 `user` 从最顶层的 `App` 组件开始，流经 `A`、`B`，最终到达组件 `C`。这造成了不必要的数据传递。组件 `A` 和 `B` 成了“管道工”，它们的代码因为需要传递一个与自己毫无关系的 `user` 属性稍显臃肿。当我们同级的子组件更多，或者子组件更深时，每个组件的 props 就被大量无关属性占据，从而使得整体代码变得十分臃肿。

同时，这极大地增加了维护难度，降低了组件的可复用性。当任何子组件需要一个新的属性时，你需要同时更改其所有父组件。其次，因为我们在中间组件硬编码了对某些属性的传递，这使得它们与其他不使用该传递属性的父组件一起使用时变得困难。

我们称这种结构为 **Prop Drilling**。

### 如何避免？使用 `useContext`

## React Context Provider：状态管理的利器

在前端开发中，尤其是在像 Lumilio-Photos 这样复杂的应用中，状态管理是一个核心挑战。当组件层级较深时，通过 props 一层层地传递数据会变得非常繁琐且难以维护。React Context API 正是为了解决这一痛点而生，它提供了一种在组件树中共享数据的方式，而无需显式地通过 props 传递。

### 为什么选择 Context API？

想象一下 Lumilio-Photos 的文件上传功能：多个组件例如文件选择器、拖拽区域、上传进度条、错误提示都需要访问和修改上传状态，例如文件列表、上传进度、WASM 模块是否就绪等。如果每次都通过 props 传递，代码会变得非常臃肿。

Context API 的优势在于：

1. 简化数据传递：避免了 props drilling，让组件可以更直接地访问所需数据。
2. 全局状态管理：适用于那些在整个应用中都需要访问的“全局”数据，例如用户认证信息、主题设置，或者像我们这里的文件上传状态。
3. 解耦组件：消费者组件不再需要关心数据从何而来，只需从 Context 中获取即可，从而降低了组件间的耦合度。

### Context API 的核心概念

Context API 主要由三个部分组成：

- **`React.createContext`**：创建一个 Context 对象。当 React 渲染一个订阅了这个 Context 对象的组件时，它会从组件树中离自身最近的那个 Provider 中读取到当前 Context 的值。
- **`Context.Provider`**：一个 React 组件，它允许消费组件订阅 Context 的变化。Provider 接收一个 `value` prop，这个 `value` 将会被传递给所有后代消费组件。一个 Provider 可以有多个后代消费组件。
- **`useContext` Hook**：在函数组件中订阅 Context 的方式。它接收一个 Context 对象作为参数，并返回该 Context 的当前值。

### 手把手构建 `UploadContext`

现在，让我们结合 Lumilio-Photos 项目中的 `UploadContext.tsx` 示例，一步步剖析如何构建一个功能完善的 React Context。

#### 1. 定义状态接口与动作类型

首先，我们需要明确上传功能所需的所有状态，以及可以对这些状态执行的所有操作。这有助于我们清晰地规划数据结构和状态更新逻辑。

```typescript
interface UploadState {
  files: File[];
  previews: (string | null)[];
  filesCount: number;
  isDragging: boolean;
  wasmReady: boolean;
  readonly maxPreviewFiles: number;
}

type UploadAction =
  | { type: "SET_DRAGGING"; payload: boolean }
  | { type: "SET_FILES"; payload: { files: File[]; previews: (string | null)[] } }
  | { type: "SET_WASM_READY"; payload: boolean }
  | { type: "CLEAR_FILES" };
```

#### 2. 初始化状态与 Reducer

为了更好地管理复杂的状态逻辑，我们通常会结合 `useReducer` hook。`useReducer` 类似于 Redux，它接收一个 reducer 函数和一个初始状态，并返回当前状态以及一个 dispatch 函数。

```typescript
const initialState: UploadState = {
  files: [],
  previews: [],
  filesCount: 0,
  isDragging: false,
  wasmReady: false,
  maxPreviewFiles: 30,
};

const uploadReducer = (
  state: UploadState,
  action: UploadAction,
): UploadState => {
  switch (action.type) {
    case "SET_DRAGGING":
      return { ...state, isDragging: action.payload };
    case "SET_FILES":
      state.previews.forEach((url) => url && URL.revokeObjectURL(url));
      return {
        ...state,
        files: action.payload.files,
        previews: action.payload.previews,
        filesCount: action.payload.files.length,
      };
    case "SET_WASM_READY":
      return { ...state, wasmReady: action.payload };
    case "CLEAR_FILES":
      state.previews.forEach((url) => url && URL.revokeObjectURL(url));
      return { ...state, files: [], previews: [], filesCount: 0 };
    default:
      return state;
  }
};
```

#### 3. 创建 Context 对象

使用 `React.createContext` 创建 `UploadContext` 对象。

```typescript
interface UploadContextValue {
  state: UploadState;
  dispatch: Dispatch<UploadAction>;
  workerClientRef: React.RefObject<WasmWorkerClient | null>;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent, handleFiles?: (files: FileList) => void) => void;
  clearFiles: (fileInputRef: RefObject<HTMLInputElement | null>) => void;
  BatchUpload: (selectedFiles: FileList) => Promise<void>;
  isProcessing: boolean;
  resetUploadStatus: () => void;
  uploadProgress: number;
  hashcodeProgress: {
    numberProcessed?: number;
    total?: number;
    error?: string;
    failedAt?: number;
  } | null;
  isGeneratingHashCodes: boolean;
}

export const UploadContext = createContext<UploadContextValue | undefined>(
  undefined,
);
```

#### 4. 构建 Provider 组件

`UploadProvider` 是 Context 的核心，它负责管理状态、初始化 WASM 模块、处理拖拽事件、协调上传操作，并将所有这些通过 `value` prop 传递给子组件。

```typescript
export default function UploadProvider({ children }: UploadProviderProps) {
  const [state, dispatch] = useReducer(uploadReducer, initialState);
  const { wasmReady, previews } = state;

  const showMessage = useMessage();
  const workerClientRef = useRef<WasmWorkerClient | null>(null);
  const uploadProcess = useUploadProcess(workerClientRef, wasmReady);

  const handleDragOver = useCallback((e: DragEvent) => { /* ... */ }, []);
  const handleDragLeave = useCallback((e: DragEvent) => { /* ... */ }, []);
  const handleDrop = useCallback((e: DragEvent, handleFiles?: (files: FileList) => void) => { /* ... */ }, []);
  const clearFiles = useCallback((fileInputRef: RefObject<HTMLInputElement | null>) => { /* ... */ }, []);

  useEffect(() => {
    if (!workerClientRef.current) {
      workerClientRef.current = new WasmWorkerClient();
    }
    const initWasm = async () => {
      try {
        await workerClientRef.current?.initGenThumbnailWASM();
        await workerClientRef.current?.initGenHashWASM();
        dispatch({ type: "SET_WASM_READY", payload: true });
        console.log("WASM module initialized successfully");
      } catch (error) {
        console.error("Failed to initialize WASM:", error);
      }
    };
    initWasm();

    return () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [previews]);

  const BatchUpload = useCallback(
    async (selectedFiles: FileList) => {
      if (!wasmReady || !selectedFiles.length) {
        showMessage(
          "error",
          "Cannot upload: WASM not initialized or no files selected",
        );
        return;
      }
      try {
        await uploadProcess.processFiles(selectedFiles);
      } catch (error: any) {
        showMessage("error", `Upload process failed: ${error.message}`);
      }
      uploadProcess.resetStatus();
    },
    [wasmReady, uploadProcess, showMessage],
  );

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      workerClientRef,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      clearFiles,
      BatchUpload,
      isProcessing: uploadProcess.isGeneratingHashCodes || uploadProcess.isUploading,
      resetUploadStatus: uploadProcess.resetStatus,
      uploadProgress: uploadProcess.uploadProgress,
      hashcodeProgress: uploadProcess.hashcodeProgress,
      isGeneratingHashCodes: uploadProcess.isGeneratingHashCodes,
    }),
    [
      state,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      clearFiles,
      BatchUpload,
      uploadProcess.isGeneratingHashCodes,
      uploadProcess.isUploading,
      uploadProcess.resetStatus,
      uploadProcess.uploadProgress,
      uploadProcess.hashcodeProgress,
    ],
  );

  return (
    <UploadContext.Provider value={contextValue}>
      {children}
    </UploadContext.Provider>
  );
}
```

#### 5. 创建自定义 Hook 消费 Context

为了方便组件消费 Context，我们通常会创建一个自定义 hook。这不仅提供了类型安全，还能在 Context 未正确提供时抛出错误。

```typescript
export function useUploadContext() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUploadContext must be used within an UploadProvider");
  }
  return context;
}
```

### 如何使用 `UploadContext`？

1. 在应用根部包裹 `UploadProvider`，确保所有需要访问上传状态的组件都在 `UploadProvider` 的子树中。

```tsx
function App() {
  return (
    <UploadProvider>
      <YourComponents />
    </UploadProvider>
  );
}
```

2. 在子组件中使用 `useUploadContext`。

```tsx
function FileUploadComponent() {
  const { state, BatchUpload, clearFiles } = useUploadContext();

  const handleFileSelect = async (files: FileList) => {
    await BatchUpload(files);
  };

  return (
    <div>
      <p>Files selected: {state.filesCount}</p>
      <button onClick={() => clearFiles(fileInputRef)}>Clear</button>
    </div>
  );
}
```

## 总结

一个典型的 `Context` 包括以下内容：

```tsx
interface State {}
type Action {}
const initialState = ()
const Reducer = ()
interface ContextValue {}
interface ProviderProps {}
export const Context = createContext<ContextValue | undefined>(undefined);
export default function Provider() {}
function useContext() {}
```
