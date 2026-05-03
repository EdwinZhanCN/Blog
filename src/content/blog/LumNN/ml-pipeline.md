---
title: MLPipeline
description: MLPipeline 先用最保守的串行执行路径，把 LumNN 节点之间的数据边界固定下来。
pubDate: 2026-04-20
updatedDate: 2026-04-20
order: 4
draft: false
tags:
  - LumNN
  - Core
  - Pipeline
---

A pipeline is the simplest useful way to connect nodes. It does not try to be a graph scheduler yet. It runs one node, takes the output packets, and gives them to the next node.

That choice is deliberately conservative. Before adding branches, joins, schedulers, or dynamic batching, LumNN first needs a stable boundary for what flows between steps. `MLPipeline` gives that boundary a concrete execution path.

```rust
let pipeline = MLPipeline::builder("siglip", context.clone())
    .then(preprocess)
    .then_shared(vision_encoder.clone())
    .then(postprocess)
    .build()?;

let outputs = pipeline.run(HashMap::from([
    ("image".to_string(), input_packet),
])).await?;
```

There are two ways to add a node:

```rust
.then(node)
```

Use this when the pipeline receives a fresh node instance.

```rust
.then_shared(node_ref.clone())
```

Use this when multiple pipelines should share the same node instance. This is useful when SigLIP and PaliGemma use different preprocessing and postprocessing, but share the same expensive vision encoder.

The pipeline itself does not know whether a node is cheap, expensive, CPU-bound, or backed by ONNX Runtime. That policy belongs inside the node.
