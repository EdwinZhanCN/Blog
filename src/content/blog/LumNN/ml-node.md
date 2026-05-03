---
title: MLNode
description: MLNode 把预处理、模型执行和后处理统一成同一个最小执行边界，方便 LumNN 组合和复用。
pubDate: 2026-04-20
updatedDate: 2026-04-20
order: 3
draft: false
tags:
  - LumNN
  - Core
  - Node
---

A model is not the only thing that can perform inference work. Before a model runs, an image may need to be resized and normalized. After a model runs, logits may need to be decoded into labels, boxes, or embeddings. LumNN treats all of these steps as nodes.

`MLNode` is the smallest execution boundary in the core layer. It consumes named packets and returns named packets. The trait does not say whether the node is an ONNX model, an ndarray transform, or a future remote call. That choice belongs to the implementation.

```rust
#[async_trait]
pub trait MLNode: Send + Sync {
    fn name(&self) -> &str;

    fn input_descriptors(&self) -> &HashMap<String, MLPacketDescriptor>;

    fn output_descriptors(&self) -> &HashMap<String, MLPacketDescriptor>;

    async fn execute(
        &self,
        inputs: HashMap<String, MLPacket>,
        context: &MLContext,
    ) -> Result<HashMap<String, MLPacket>, String>;
}
```

The important detail is `&self`. A node does not require exclusive access from the pipeline. If it owns mutable runtime state, it must protect that state internally. `OrtNode` does this by wrapping its ONNX Runtime session in a mutex.

That design makes shared nodes possible:

```rust
let vision_encoder: MLNodeRef = Arc::new(OrtNode::new(
    context.as_ref(),
    "models/siglip_vision_encoder.onnx",
    "vision_encoder".to_string(),
)?);
```

A shared node is not just shared code. It is shared execution state. For an `OrtNode`, this means sharing the same model session and accepting that concurrent callers will queue at the session lock.
