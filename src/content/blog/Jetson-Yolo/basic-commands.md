---
title: "@Jetson YOLO: Basic Commands"
description: Jetson 和 Ubuntu 入门前先熟悉一组最常用的命令行命令，避免后续环境配置时卡在基础操作上。
pubDate: 2026-05-02
updatedDate: 2026-05-02
order: 2
draft: false
tags:
  - Jetson
  - Ubuntu
  - CLI
  - Beginner
---

Before touching CUDA, TensorRT, or conda, it helps to be comfortable with a small set of Linux command-line operations. Jetson setup becomes much less frustrating once basic navigation and package management feel natural.

## Getting Started

Open the terminal with `Ctrl + Alt + T`, or search for `Terminal` from the application menu.

## Navigation

### Show the Current Directory

```bash
pwd
```

Prints the full path of the directory you are currently in.

### List Files

```bash
ls
```

Lists files and folders in the current directory.

### Change Directory

```bash
cd /path/to/directory
```

Example:

```bash
cd Documents
```

## File and Directory Operations

### Create a Directory

```bash
mkdir new_directory
```

### Create an Empty File

```bash
touch new_file.txt
```

### Copy Files

```bash
cp source_file destination
```

Example:

```bash
cp file.txt /home/user/Documents
```

### Move or Rename Files

```bash
mv old_name new_name
```

Example:

```bash
mv file.txt new_directory/
```

### Remove Files

```bash
rm file.txt
```

To remove a directory and its contents:

```bash
rm -r directory_name
```

## Viewing and Editing Files

### Print a File

```bash
cat file.txt
```

### Edit with Nano

```bash
nano file.txt
```

### Read a File Page by Page

```bash
less file.txt
```

## System Information

### Disk Usage

```bash
df -h
```

### Memory Usage

```bash
free -h
```

### Running Processes

```bash
top
```

### System Information

```bash
uname -a
```

## Installing Software

### Update Package Index

```bash
sudo apt update
```

### Upgrade Installed Packages

```bash
sudo apt upgrade
```

### Install a Package

```bash
sudo apt install package_name
```

Example:

```bash
sudo apt install curl
```

## Manual Pages

Use `man` when you want the built-in documentation for a command.

```bash
man ls
```

## Helpful Shortcuts

- `Ctrl + C` stops the current command
- `Ctrl + Z` suspends the current command
- `Ctrl + R` searches command history
- `Tab` auto-completes file and directory names

## Quick Practice

```bash
mkdir my_first_directory
cd my_first_directory
touch hello.txt
echo "Hello, Ubuntu!" > hello.txt
cat hello.txt
```

If these operations feel comfortable, the rest of the Jetson YOLO setup will be much easier to follow.
