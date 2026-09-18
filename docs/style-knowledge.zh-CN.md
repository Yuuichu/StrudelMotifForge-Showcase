> [English](style-knowledge.md) | **简体中文**

# 以音频校准的风格知识

应用的风格知识——速度、调性、音色特征、groove 惯用法——之所以有用，正是因为它具体。问题在于，这些知识由语言模型产出，而模型对「这个风格通常大约 160 BPM 且偏暗」的感觉是一种*印象*，不是测量。印象会系统性地偏，而一个完全由印象搭起来的风格库会悄悄劣化输出。

这条管线用真实音频来测量这些声称并与之调和。

## 1. 特征提取（`scripts/extract-features/extract.py`）

基于 librosa，逐曲目：

| 特征 | 实现 |
|---|---|
| 速度 | `beat_track` |
| 调性与调式 | `chroma_cqt` + **Krumhansl-Schmuckler** 调性剖面相关（大调/小调判定，带调式置信度） |
| 音色剖面 | **MFCC-13**（均值向量） |
| 频谱形状 | `spectral_centroid`、`spectral_rolloff`、`spectral_bandwidth`、`spectral_flatness` |
| 节奏活动 | `onset_strength` → 检出的起音 → 起音率 |
| 脉冲清晰度 | `plp`（在可用时） |
| 能量 / 噪声性 | RMS、过零率 |

输出是一份紧凑的逐曲目剖面——少量数字，而不是音频。这份剖面就是校准步骤所依据的证据。

## 2. 校准（`scripts/extract-features/calibration.py`）

每个风格都声称一些硬事实（速度、调性、调式）与软事实（音色特征）。校准对两者都做审计。

### 硬事实会被修正，而不只是被标记

```text
if |style_default_bpm − audio_mean_bpm| > 15:
    flag the discrepancy
    rewrite the style's tempo as:
        min     = audio p10
        max     = audio p90
        default = round(audio mean)
```

一个声称 126 BPM 而测得音频为 109 BPM（Δ = 17）的风格，不只是被警告——它的速度范围会被重写为测量得到的分布，因此下游的模式生成会使用音频实际支持的速度。

### 软事实会与物理现实对照检查

```text
if spectral_centroid_mean > 2000 Hz and the style claims "dark" or "filtered":
    flag: style claims dark timbre but centroid is bright
if spectral_centroid_mean < 800 Hz and the style claims "bright":
    flag: style claims bright timbre but centroid is dark
```

一个声称暗、被滤波的特征却测出 **4419 Hz** 质心的风格是自相矛盾的，而系统就把它当作矛盾来报告。

### 偏差会扣分

```text
score = max(0, 10 − number_of_discrepancies)
PASS if score >= 8, WARN if >= 5, otherwise FAIL
```

这个分数不是音乐的健康指标，而是风格记录的*可信度*指标。分数低的风格在被修正之前，不应当用来驱动生成。

被标记的风格连同具体差异写入 `data/style_profiles/flagged_styles.json`，因此这些分歧是可检查的，而不是埋在控制台日志里。

## 3. 随附数据实际显示了什么

校准输出随仓库一起提供，而且以有用的方式显得并不好看。真实条目包括：

- **house**：`BPM: JSON=126 vs Audio mean=109.0 (Δ=17)`——以及一条被 3253 Hz 质心否定的暗音色声称。
- **jungle**：`BPM: JSON=160 vs Audio mean=138.5`——高估了 21.5 BPM。
- **ambient_techno**：一条被 4419 Hz 质心否定的暗音色声称。
- 若干风格：`No audio profile found — cannot calibrate`。

最后这行是这套系统诚实的边界：**校准只覆盖有音频档案的风格。** 没有音频档案的风格就是未经验证的，而数据如实说明了这一点，而不是暗示有把握。

## 4. 为什么这条回路比模型本身更重要

这里有意思的工程主张不是「我们用 LLM 写了风格元数据」。而是：

> 我们不信任关于音乐的生成式知识；我们测量它、修正硬数字、交叉核对特征声称，并把分歧记录在人能看到的地方。

这也是为什么修正值以 **p10/p90/均值** 写回，而不是一个单一的替换数字：对一个生成器来说，分布比点估计更有用，而且它保留了测量到的离散程度。