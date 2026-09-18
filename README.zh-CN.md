> [English](README.md) | **简体中文**

# StrudelMotifForge

一个基于浏览器的**分层 Strudel 模式作曲**工作台：把一段简短的创作简报变成概念、分层的 live coding 模式、受控变异与解释——并配有一个把生成代码视为不可信的沙箱。

## 为什么做这个

在 Strudel 里做 live coding 音乐又快又有表现力，但它有一个工作流缺口：一个模式只是单一文本产物。没有可以独立变异的*层*概念，没有记录你当时在哪个分支上的机制，而且当你让 LLM「弄暗一点」时也没有任何防护——模型会重写整个模式，改掉你喜欢的地方，而你要到播放时才发现。

我希望这套工作流的 AI 辅助版本表现得像版本控制加 diff：变异一个**具名层**，而被锁定的层保持逐字节一致；每个结果都留作可以回到的分支；生成代码在运行之前先被校验；并解释改了什么。

第二个动机是安全。在浏览器中执行的生成代码是真实的攻击面，因此「运行 LLM 的输出」必须被设计成一条明确不可信的边界，而不是一个便利功能。

## 功能概览

- **简报 → 概念 → 作曲计划。** 一段简短的创作简报变成概念卡片和一份结构化计划（强度、层、角色、手势）。
- **分层模式生成。** 计划变成带有具名标记层的 Strudel 模式，使用角色映射（kick / bass / harmony / lead / texture）与风格知识。
- **受控变异。** 变异算子只施加到**选定的层**，其他层被锁定；对于未知或重叠的目标/锁定集合，引擎会拒绝而不是猜测。
- **风格知识以真实音频校准。** 一条 librosa 管线从真实曲目中测量 BPM、调性/调式、MFCC 音色、频谱形状、起音率与脉冲清晰度；这些测量随后**审计并修正** LLM 产出的风格知识，偏差会被评分并记录。
- **带解释的输出。** 每个生成的模式都附带对计划与所施加变异的解释。
- **版本分支。** 候选模式被保留为分支而不是被覆盖，因此一个想法可以被探索并回到之前的状态。
- **默认离线运行。** Mock AI 是默认提供方，因此整套工作流无需凭据或网络也能使用。

## 工作流

```text
Creative brief
      |
      v
Concept cards  ->  Composition plan (intensity, layers, roles, gestures)
      |
      v
Layer-marked Strudel pattern
      |
      +--> Mutation operators (target layers only; locked layers preserved)
      |         |
      |         v
      |    Validator: balanced delimiters, required stack(), paired markers, unsafe-code scan
      |         |
      |         v
      |    Sandboxed iframe (opaque origin) -> playback
      |
      +--> Version branches (compare / return to any candidate)
```

## 技术要点

- **沙箱在设计上就是不透明的。** 运行时 iframe 创建时把 `sandbox` 属性**只**设为 `allow-scripts`——特别是*不含* `allow-same-origin`。因此生成的 Strudel 代码在不透明源中执行，无法访问应用的 DOM、存储或会话。
- **带版本的消息协议，双向校验。** 父页面与 iframe 通过 `MessageChannel` 通信，使用协议常量与显式握手；消息带请求 id，并在**两端**都按能力白名单校验，超时会报错而不是静默挂起。
- **生成代码在运行之前先被校验**，而且检查是有实质内容的：
  - 花括号、圆括号与方括号配对；
  - 必须存在顶层的 `stack()` 组合子；
  - 层标记必须存在、成对且顺序正确；
  - **七组不安全代码模式**会被拒绝——网络/Worker API、浏览器全局对象、动态代码执行（`eval`/`Function`）、动态 import、对象逃逸原语（`constructor`/`prototype`/`__proto__`/`process`）、全局对象逃逸原语（`Object`/`Reflect`/`Proxy`/`frames`/`opener`），以及计算属性访问。字符串与注释会先被剥离，因此合法文本不会误触发扫描。
- **层锁定是真正的不变量，而不是提示词里的指示。** 变异引擎把模式解析成层，并拒绝未知的目标层、未知的锁定层，以及两个集合之间的任何重叠——因此「不要碰鼓」是由代码强制执行的。
- **服务端加固。** Node 服务强制执行 **20 次请求/分钟/IP** 的速率限制、**Origin 白名单**与 **64 KB 请求体上限**，并把凭据留在服务端，因此它们永远不会进入浏览器包。
- **以音频校准的风格知识。** 风格元数据不是靠信任接受的：测量到的 BPM 与风格声称的速度偏差超过 **15** 时，会触发用测量得到的 p10/p90/均值重写；音色声称会与频谱质心交叉核对（一个「暗」风格测出 **4419 Hz** 的质心会被标记）。每个风格满分 **10** 分（每处偏差扣一分）；8 分及以上为通过。
- **规模，从源码量出：** `src/` 中 117 个 TypeScript/TSX 文件，9,306 行。

## 架构

`docs/architecture.zh-CN.md` 介绍应用与模块布局；`docs/safety-model.zh-CN.md` 记录沙箱、校验器与服务端加固；`docs/style-knowledge.zh-CN.md` 解释音频特征校准回路；`docs/mutation-operators.zh-CN.md` 编目算子系统。

## 我的角色

独立作者：应用架构、模式生成与校验、变异引擎与层锁定模型、沙箱运行时与消息协议、音频特征校准管线、风格知识库以及测试套件。

## 局限与边界

- **没有 MIDI、MusicXML 或音频导出。** 捕获未实现——导出路径只是一个占位。试听通过应用内的沙箱播放器进行。不要期待能拿到渲染好的文件。
- **命名跑在实现前面。** 这个项目叫 StrudelMotifForge，但**没有专门的动机（motif）开发模块**：动机层面的想法由 Concept → CompositionPlan → Mutation 这条管线承载，「motif」只作为一个音高算子名称存留下来，而不是一个子系统。与代码相符的定位是*分层模式作曲工作台*。
- **校准只覆盖有音频档案的风格。** 随附数据中有若干风格被记录为「未找到音频档案——无法校准」，因此校准回路只在一个子集上得到演示，而不是覆盖整个风格库。
- **风格知识只是起点**，不是音乐学参考。它的数字是 LLM 生成的估计值，只是部分经过音频审计。
- **LLM 输出天然可变。** mock 提供方（默认）是确定性的，真实的提供方则不是；校验器约束的是*安全*，不是音乐质量。
- **单用户、本地优先。** 没有协作、没有服务端工程持久化，也没有云同步。
- **算子目录是人工策划的，不是学出来的。** 六个类别共 36 个算子，全部手工编写。

## 仓库范围

这是一个作品集展示仓库。完整开发仓库保持私有。

`selected-code/` 中包含：模式校验器、变异编排器、角色映射与沙箱宿主。`examples/` 中作为数据包含：算子目录与一个风格库。另外包含：架构、安全、校准与算子文档。不包含：环境文件、构建产物、测试产物、完整风格库、LLM 提供方实现与 e2e 测试套件。

## 技术栈

`React 19` · `TypeScript` · `Vite` · `Zustand` · `Dexie` · `CodeMirror 6` · `Zod` · `Strudel / TidalCycles` · `librosa` (feature extraction and calibration) · `Euclidean rhythm` · structured LLM output · sandboxed iframe + `MessageChannel` · `Vitest` · `Playwright`