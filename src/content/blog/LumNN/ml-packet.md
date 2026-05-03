---
title: MLPacket
description: LumNN 里在节点之间流动的不是裸 tensor，而是带有 shape 和 dtype 契约的 MLPacket。
pubDate: 2026-04-20
updatedDate: 2026-04-20
order: 2
draft: false
tags:
  - LumNN
  - Core
  - Runtime Contract
---

Most examples of model inference start with a tensor. In LumNN, the value that moves between nodes is not only a tensor. It is an `MLPacket`: a payload plus the contract that describes how the payload should be interpreted.

This matters because a pipeline may connect CPU preprocessing, an ONNX Runtime model, and CPU postprocessing. If every node exposed its backend-specific tensor type, the pipeline would quickly become tied to one runtime. `MLPacket` gives the pipeline one common object to pass around, while still allowing the payload to live in different runtimes.

```rust
let descriptor = MLPacketDescriptor::new(
    MLPacketDataType::Float32,
    vec![1, 3, 224, 224],
);

let packet = context.packet_from_host_tensor(
    descriptor,
    HostTensor::Float32(pixel_values),
)?;
```

The descriptor is not documentation. It is checked when the packet is built and when a node receives input. If a node expects `[1, 3, 224, 224]` but receives `[1, 224, 224, 3]`, LumNN should fail at the boundary where the mistake becomes visible.

For models that support dynamic batch size, the contract can say that only the first dimension is flexible:

```rust
let expected = MLPacketDescriptor::new(
    MLPacketDataType::Float32,
    vec![1, 3, 224, 224],
)
.with_dynamic_batch();

let actual = MLPacketDescriptor::new(
    MLPacketDataType::Float32,
    vec![4, 3, 224, 224],
);

expected.validate_compatibility(&actual, "pixel_values")?;
```
