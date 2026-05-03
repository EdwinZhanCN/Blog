---
title: "@Jetson YOLO: Downloads Applications"
description: Jetson YOLO 环境里最关键的两个工具是 Anaconda 和 VS Code，这篇先把它们装对。
pubDate: 2026-05-02
updatedDate: 2026-05-02
order: 4
draft: false
tags:
  - Jetson
  - Anaconda
  - VS Code
  - Setup
---

Before building the actual YOLO environment, install the two tools that make the rest of the workflow manageable: Anaconda for Python environment management and Visual Studio Code for editing and running code.

## Anaconda

Anaconda ships with `conda`, which is the part that matters most here. On Jetson, isolated environments are especially useful because Python, PyTorch, TensorRT, and ARM-specific dependencies have to stay aligned.

Conda helps with:

- package and dependency management
- creating isolated Python environments
- switching between base and project-specific interpreters

### Install Anaconda

Go to the official download page: [Anaconda](https://www.anaconda.com/download/success)

For Jetson Orin Nano, choose the ARM64 installer, for example:

- `64-Bit (AWS Graviton2 / ARM64) Installer`

Then install it from the terminal:

```bash
cd ~/Downloads
bash Anaconda3-xxxx-Linux-aarch64.sh
```

During installation:

- press `Enter` to read the license
- type `yes` to agree
- keep the default install path unless you have a reason not to
- type `yes` when asked whether to initialize conda

Reboot afterward:

```bash
reboot
```

## Visual Studio Code

VS Code is a good fit for Jetson because it stays useful without being as heavy as a full IDE.

On Jetson Orin Nano, I do not recommend starting with large IDEs like PyCharm if your goal is lightweight local inference work. They can consume memory that is better left to the actual model runtime.

You can still explore alternatives like:

- NeoVim
- Sublime Text

But VS Code gives a clean middle ground for this tutorial series.

### Install VS Code

Download the ARM64 `.deb` build from the official page:

[VS Code Downloads](https://code.visualstudio.com/Download)

Then install it:

```bash
cd ~/Downloads
sudo dpkg -i code_xxxx_arm64.deb
```

Once these two tools are installed, you are ready to create the YOLO-specific conda environment.
