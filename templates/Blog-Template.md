---
title: 文章标题
pubDate: 2026-04-20
# 以下都可以留空，想到再填
description:
order: 1
tags:
# sketch = 故意没写完 · inked = 写完了 · shelved = 项目停了，笔记留着
status: sketch
# true 时只在 npm run dev 里可见；想让别人看到时改成 false，不需要先“写完”
draft: true
---

> 这里可以放摘要、导语，或者一句重点说明。

## 前言

这里写开场内容。说明这篇文章要解决什么问题、适合谁看、读完能得到什么。

## 一、主要内容小节

正常写正文内容。

你可以写列表：

- 第一条
- 第二条
- 第三条

也可以写有序列表：

1. 步骤一
2. 步骤二
3. 步骤三

## 二、代码示例

```ts
export function greet(name: string) {
  return `Hello, ${name}!`;
}

## 提示块（和 Obsidian 的 callout 写法一致）

> [!note] 可选标题
> 这里的内容在 Obsidian 和网站上看起来是一样的。

> [!warning]
> warning / caution / danger / important 会带一个朱红色的点。

## 带文件名的代码块

```ts title="src/greet.ts"
export const greet = (name: string) => `Hello, ${name}!`;
```
