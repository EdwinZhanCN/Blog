---
title: "@Lumen: Pragmatic Inference Like Triton"
pubDate: 2026-04-20
updatedDate: 2026-04-20
description: Lumen 在 task-wise 后端中用 metadata 引入 Triton-like tensor fast path 的一次架构设计记录。
order: 1
draft: false
tags:
  - Lumen
  - Inference
  - Triton
  - Architecture
---
## Introduction

在 Lumen 里，我最近重新看了一遍 inference request 的边界。

问题很简单：如果一个图片请求进来，它到底应该是一张 `image/jpeg`，还是一个已经 resize 到 `224x224`、转成 `NCHW`、normalize 完成的 tensor？

这两个输入看起来都可以叫做“图片推理”，但是它们对后端的要求完全不同。前者需要 task backend 自己做 preprocess，后者则更接近 Triton 的 model-level tensor request，可以直接进入 forward path。

不过 Lumen 的后端并不是 model-wise 部署的。它不是一个纯粹的高性能 model serving system，而是 task-wise 的：`clip_embed`、`ocr`、`face_detection` 这些 task 才是路由入口。所以我们不能简单地把 Triton 的 API 语义完整搬过来，然后用 `model_name` 做路由。

对此，我们选择了一个更克制的设计：不改 proto，不改 REST，不改变 task-wise routing，只在 `InferRequest.Meta` 上加一层可选的 tensor fast path contract。

```go
type InferRequest struct {
    CorrelationId string
    Task          string
    Payload       []byte
    PayloadMime   string
    Meta          map[string]string
}
```

`Task` 仍然是主语义。metadata 只回答一个问题：

> 这个 payload 是 raw task input，还是已经符合当前 task 的 model-ready tensor？

## 两条输入路径

Lumen 现在可以把输入分成两类：

```text
raw route:
  image/jpeg, image/png, text/plain ...
  -> task backend decode
  -> preprocess
  -> model input
  -> dynamic batching
  -> forward

tensor fast path:
  tensor bytes
  + lumen.* metadata descriptor
  -> validate descriptor
  -> skip preprocess
  -> dynamic batching
  -> forward
```

这里的关键点是：fast path 并不改变路由。即使 metadata 里带了 `lumen.model.id`，它也只是 task backend 内部校验用的信息，不能拿来做全局路由。

这样做是因为 Lumen 的抽象仍然是 task-first，而不是 model-first。

## Metadata Contract

我们为这条 fast path 定义了一组保留字段：

```text
lumen.input.kind = raw | tensor

lumen.tensor.dtype = fp32 | fp16 | uint8 | int64
lumen.tensor.shape = [1,3,224,224]
lumen.tensor.layout = NCHW
lumen.tensor.format = contiguous
lumen.tensor.byte_order = little

lumen.preprocess.id = clip_image_openai_v1
lumen.preprocess.skip = true

lumen.model.id = clip_vision_encoder
lumen.model.version = v1
```

Simply put，`lumen.input.kind=tensor` 表示调用方在说：

> 我已经完成 preprocess，这个 payload 可以被当前 task 的后端当成模型输入来解释。

但是后端不会盲信它。它至少要检查：

1. dtype 是否支持
2. shape 是否可解析
3. layout 是否在 allowlist 内
4. byte length 是否等于 `dtype_size * shape_product`
5. preprocess id 是否属于当前 task 认可的 contract
6. v1 是否偷偷传了 payload batch

这里也是因为 tensor 的危险不在于它不能被解析，而在于它可能“看起来对，但语义错”。

比如同样是 `[1,3,224,224]` 的 `fp32` tensor，它可能是 RGB，也可能是 BGR；可能用了 OpenAI CLIP 的 mean/std，也可能用了 SigLIP 的 preprocess。shape 是对的，但结果会悄悄错掉。

所以 `preprocess.id` 是这个设计里的核心字段之一。

## SDK Builder

为了不让用户手写一堆 metadata，我们在 builder 层加了 helper。

```go
req := types.NewInferRequest("clip_embed").
    ForTensorInput(tensorBytes, "", types.TensorDescriptor{
        DType:        "fp32",
        Shape:        []int64{1, 3, 224, 224},
        Layout:       "NCHW",
        PreprocessID: "clip_image_openai_v1",
        ModelID:      "clip_vision_encoder",
        ModelVersion: "v1",
    }).
    Build()
```

底层还是普通的 `InferRequest`。没有新 proto，没有新 endpoint，只是 builder 帮我们写入 `Meta`：

```go
func (b *InferRequestBuilder) WithTensorDescriptor(
    dtype string,
    shape []int64,
    layout string,
) *InferRequestBuilder {
    return b.WithInputKind("tensor").
        WithMeta("lumen.tensor.dtype", dtype).
        WithMeta("lumen.tensor.shape", shapeJSON).
        WithMeta("lumen.tensor.layout", layout).
        WithMeta("lumen.tensor.format", "contiguous").
        WithMeta("lumen.tensor.byte_order", "little")
}
```

这样子，我们保持了 API 的轻量，同时把弱契约集中到了一个 namespace 里，而不是让每个 task 自己发明一套 metadata。

## 为什么不支持 Payload Batch

一个很自然的问题是：既然已经传 tensor 了，那能不能传 `[8,3,224,224]`？

第一版我希望不支持。

原因是 Lumen 这里要解决的是 request-wise dynamic batching，而不是让用户自己构造 payload batch。多个逻辑请求应该仍然是多个 request：

```text
request A: [1,3,224,224]
request B: [1,3,224,224]
request C: [1,3,224,224]

backend dynamic batch:
  -> [3,3,224,224]
```

如果允许用户自己传 `[8,3,224,224]`，response 拆分、错误归因、timeout、correlation id、metrics 都会变复杂。更重要的是，它会把 batching 的执行策略泄漏成 payload 语义。

所以 v1 的规则很简单：

```text
如果 layout 带 batch dim，例如 NCHW / NHWC
第一维必须是 1
```

多请求吞吐交给后端 scheduler，而不是交给调用方手搓 payload batch。

## 后端如何使用

后端仍然先看 task：

```text
InferRequest(task, payload, meta)
  -> route by task
  -> inspect lumen.input.kind
```

如果是 raw input：

```text
decode image
resize / normalize / layout transform
create PreparedModelRequest
```

如果是 tensor fast path：

```text
parse tensor descriptor
validate byte length
validate preprocess id
create PreparedModelRequest
```

最后它们进入同一个内部结构：

```go
type PreparedModelRequest struct {
    Task         string
    ModelID      string
    ModelVersion string
    DType        string
    Shape        []int64
    Layout       string
    PreprocessID string
    Tensor       []byte
}
```

真正的 dynamic batching 不应该按“用户请求长什么样”来分组，而应该按 execution signature：

```text
task
effective model id/version
dtype
shape
layout
preprocess id
runtime/device profile
```

这样 raw route 和 tensor route 最终可以汇合，但不会把不同 contract 的 tensor 混在一起。

## 和 Triton 的关系

这套设计确实有一点 Triton 的味道，但它不是 Triton-compatible API。

Triton 的核心是 model-wise serving：请求天然是 model-level tensor request，scheduler 可以围绕 model config 做 batching。

Lumen 这里更像是：

```text
task-wise API
+ optional Triton-like tensor metadata
+ backend-owned validation
```

它不追求成为一个通用高性能 serving layer。它只是给可信 SDK、本机 pipeline、内部组件留了一条 fast path：当调用方已经知道怎么把 raw input 变成 model-ready tensor 时，不需要后端再做一遍 preprocess。

## 小结

最后这个设计可以收敛成几条规则：

```text
1. Task 永远是路由主键
2. Raw input 是默认路径
3. Tensor input 必须显式声明 lumen.input.kind=tensor
4. Tensor fast path 必须 validate，不允许 blind trust
5. preprocess.id 是语义 contract，不是装饰字段
6. v1 不允许用户构造 payload batch
7. dynamic batching 仍然是后端执行策略
```

这样做的好处是，我们没有为了 fast path 重写 Lumen 的后端架构，也没有把 proto 提前复杂化。

它只是给现有 `InferRequest` 加了一层更明确的解释方式：当 payload 是 raw input, Lumen 负责把它变成模型输入；当 payload 已经是 tensor，Lumen 负责确认它真的符合当前 task 的输入 contract。
