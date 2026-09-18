> [English](architecture.md) | **简体中文**

# 架构

一个单页应用，可信核心被刻意做得很小，另有一个 Node 服务，其存在只是为了把凭据挡在浏览器之外。

## 仓库布局

```text
src/
  ai/               LLM provider adapters (mock is the default)
  components/       React UI: panels, layout, shared components
  mock/             deterministic mock concepts and content
  modules/
    code-generator/ brief/plan -> Strudel code (role mapping, templates)
    layer-lock/     parses a pattern into named layers
    mutation-engine/ applies operators to target layers only
    pattern-validator/ static validation of generated code
    runtime/        sandbox iframe host + versioned message protocol
  stores/           Zustand state slices (pattern, version branch, style, ...)
  types/            shared domain types
server/             Node service: AI proxy, Origin allowlist, rate limiting
shared/             types shared between client and server
data/               style libraries, style profiles, creative operators
e2e/                Playwright end-to-end tests
```

## 分层

### 1. 领域层 —— 类型与 schema

工作流在变成代码之前先被表达为数据：`CompositionPlan`、概念卡片、层、角色、手势、版本分支。由于计划是结构化的，生成是计划的函数，而不是自由形式提示词的产物；变异则可以针对具名层。

### 2. 生成层 —— `modules/code-generator`

把计划变成 Strudel 模式。根据计划的速度与强度，角色映射决定哪个 Strudel 惯用法与模板适合某个角色（kick、bass、harmony、lead、texture），并在 groove 逻辑需要时使用欧几里得节奏辅助函数。

### 3. 完整性层 —— `modules/layer-lock` + `modules/mutation-engine`

模式使用 `@agent:layer:<name>:start` / `:end` 标记解析成**具名层**。随后变异被施加到显式的目标集合，同时保留一个锁定集合。引擎在做任何工作之前会校验这些集合：

- 未知目标层 → 报错，
- 未知锁定层 → 报错，
- 目标集合为空 → 报错，
- 某个层同时出现在两个集合中 → 报错。

正是这个机制把「只改 lead」从一句请求变成了一个不变量。

### 4. 校验层 —— `modules/pattern-validator`

每个候选模式在被执行之前都先作为*文本*校验：分隔符配对、必需的顶层 `stack()`、标记的存在/配对/顺序，以及七组不安全代码扫描（见 `docs/safety-model.zh-CN.md`）。

### 5. 执行层 —— `modules/runtime`

生成代码在按 `sandbox="allow-scripts"` 创建的沙箱 iframe 中执行——刻意**不含** `allow-same-origin`，因此该 frame 运行在不透明源中。父页面与 frame 通过 `MessageChannel` 通信，使用带版本号的协议、握手、请求 id、超时，以及双边的能力校验。

### 6. 状态层 —— `stores/`

Zustand 切片持有当前模式、层状态、风格选择与**版本分支**树，因此候选可以被比较和回退，而不是被覆盖。

### 7. 服务层 —— `server/`

一个小型 Node 服务，提供 AI 代理（因此 API key 留在服务端）、静态资源服务、Origin 白名单、请求体上限与逐 IP 速率限制。

## 值得点明的设计决策

1. **生成代码是不可信输入。** 它被解析、校验，并在不透明源沙箱中执行——与用户提供的脚本应当受到的对待相同。
2. **层是变更的单位。** 变异、锁定、比较——一切都作用于具名层，这正是 AI 辅助编辑变得足够安全可用的原因。
3. **计划是结构化的。** 结构化计划可以被 diff、被解释、被校验，而自由形式的模型输出做不到。
4. **默认离线。** mock 提供方意味着整条管线可以在无网络、无凭据的情况下演练，这也让测试套件变成确定性的。
5. **用分支，不用覆盖。** 每次变异都产出一个候选，可以放弃它而不丢失之前的状态。