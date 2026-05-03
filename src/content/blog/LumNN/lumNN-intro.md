---
title: "@LumNN: Home Native ML Inference Framework"
description: 面向家庭部署和本地优先场景的机器学习推理框架设想，从 Home Native 的问题定义开始。
pubDate: 2026-04-20
updatedDate: 2026-04-20
heroImage: ""
order: 1
tags:
  - LumNN
  - Home Native
  - Inference
draft: false
---
## 动机

> 如今，自部署(Self-hosted)应用及服务的需求正在稳定增长。从企业级解决方案，例如群晖、TrueNAS，到现在流行的飞牛OS(fnOS)，以及快速发展的本地AI/机器学习解决方案，例如Ollama、vLLM等，可以预料到，家庭部署的本地服务器将会在不久的未来成为不可或缺的基础设施之一。

## TL;DR

本博客将会介绍以下内容

- 什么是"Home Native"，他与"Cloud Native"有什么不同与相似之处？
- 当前的本地机器学习服务方案
	- 运行时
	- 硬件
	- Trade-Offs
- LumNN简介

## Home Native

Home Native, 取自，参考自Cloud Native。最直接的翻译便是“家原生”，在这里，家并不是一个传统的人文观念，其代表的是一种，资源受限，本地优先以及流程敏感的服务部署环境。

我们完全可以从云原生（Cloud Native）的对立面去叙述家原生。

云原生的主要要素可以涵盖以下 4 个部分：
- 容器化 & 动态编排
- DevOps (Development & Operations)
- 微服务
- CI/CD (Continuous Integration and Continuous Delivery)

具体的定义可以参考CNCF

> Cloud native practices empower organizations to develop, build, and deploy workloads in computing environments (public, private, hybrid cloud) to meet their organizational needs at scale in a programmatic and repeatable manner. It **is characterized by loosely coupled systems that interoperate in a manner that is secure, resilient, manageable, sustainable, and observable.**
> 
> Cloud native technologies and architectures typically consist of some combination of containers, service meshes, multi-tenancy, microservices, immutable infrastructure, serverless, and declarative APIs — this list is non-exhaustive.
