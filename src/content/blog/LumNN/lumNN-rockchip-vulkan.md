---
title: "@LumNN: MNN Vulkan Inference On Rockchip"
description: 使用 MNN Vulkan 推理框架在 Rockchip 上进行推理
pubDate: 2026-05-24
updatedDate: 2026-05-24
heroImage: ""
order: 1
tags:
  - LumNN
  - Home Native
  - Inference
draft: true
---
## TL;DR

本章将会介绍如何在 Rockchip 上使用 Lumen-Hub 的 mnn-vulkan 后端进行推理。

设备目标为 Radxa Zero-3W。

关于 Radxa Zero-3W:
- 带有 Rockchip RK3566 SoC
- 4GB RAM
- GPU 为 Arm® Mali™‑G52‑2EE，支持：
    - OpenGL® ES1.1 / 2.0 / 3.0 / 3.1 / 3.2
    - Vulkan® 1.1, OpenCL™ 2.0
- 使用 64GB SD 存储


具体系统信息如图：

![[Screenshot 2026-05-24 at 7.27.33 PM.png]]
## 配置 Vulkan

我们直接获取Mali GPU 的官方驱动 （参考：[E-COM](https://www.e-com-net.com/article/1923692077665808384.htm)）：

```bash
# 下载并安装
mkdir Downloads && cd Downloads
wget https://repo.rock-chips.com/edge/debian-release-v2.0.0/pool/main/r/rockchip-mali/rockchip-mali_1.9-12_arm64.deb
sudo dpkg -i rockchip-mali_1.9-12_arm64.deb

# 动态链接
sudo ln -s /usr/lib/aarch64-linux-gnu/libmali-valhall-g610-g6p0-wayland-gbm-vulkan.so /usr/lib/aarch64-linux-gnu/libmali.so


# 配置 vulkan 驱动描述文件
sudo mkdir -p /etc/vulkan/icd.d/
echo '{
    "file_format_version": "1.0.0",
    "ICD": {
        "library_path": "/usr/lib/aarch64-linux-gnu/libmali-valhall-g610-g6p0-wayland-gbm-vulkan.so",
        "api_version": "1.0.0"
    }
}' | sudo tee /etc/vulkan/icd.d/mali.json

# 下载 vulkan 工具
apt install vulkan-tools

# 检查 vulkan info
vulkaninfo
```

## 下载并安装 Lumen-Hub


