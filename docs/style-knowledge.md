# Audio-calibrated style knowledge

> **English** | [简体中文](style-knowledge.zh-CN.md)

The application's style knowledge — tempo, key, timbre character, groove idioms — is useful precisely because it is specific. The problem is that this knowledge is produced by a language model, and a model's sense of "this style is usually about 160 BPM and dark" is an *impression*, not a measurement. Impressions are systematically off, and a style library built entirely from impressions quietly degrades the output.

This pipeline measures the claims against real audio and reconciles them.

## 1. Feature extraction (`scripts/extract-features/extract.py`)

librosa-based, per track:

| Feature | Implementation |
|---|---|
| Tempo | `beat_track` |
| Key and mode | `chroma_cqt` + **Krumhansl-Schmuckler** key-profile correlation (major/minor decision with a mode confidence) |
| Timbre profile | **MFCC-13** (mean vector) |
| Spectral shape | `spectral_centroid`, `spectral_rolloff`, `spectral_bandwidth`, `spectral_flatness` |
| Rhythmic activity | `onset_strength` → detected onsets → onset rate |
| Pulse clarity | `plp` (where available) |
| Energy / noisiness | RMS, zero-crossing rate |

The output is a compact per-track profile — a handful of numbers, not audio. That profile is the evidence the calibration step runs on.

## 2. Calibration (`scripts/extract-features/calibration.py`)

Each style claims hard facts (tempo, key, mode) and soft facts (timbre character). Calibration audits both.

### Hard facts are corrected, not just flagged

```text
if |style_default_bpm − audio_mean_bpm| > 15:
    flag the discrepancy
    rewrite the style's tempo as:
        min     = audio p10
        max     = audio p90
        default = round(audio mean)
```

A style claiming 126 BPM against measured audio at 109 BPM (Δ = 17) is not merely warned about — its tempo range is rewritten to the measured distribution, so downstream pattern generation uses a tempo the audio actually supports.

### Soft facts are checked against physics

```text
if spectral_centroid_mean > 2000 Hz and the style claims "dark" or "filtered":
    flag: style claims dark timbre but centroid is bright
if spectral_centroid_mean < 800 Hz and the style claims "bright":
    flag: style claims bright timbre but centroid is dark
```

A style claiming a dark, filtered character while measuring a **4419 Hz** centroid is a contradiction, and it is reported as one.

### Discrepancies cost points

```text
score = max(0, 10 − number_of_discrepancies)
PASS if score >= 8, WARN if >= 5, otherwise FAIL
```

The score is not a health metric for the music; it is a *trust* metric for the style record. A style with a low score should not be used to drive generation until it is corrected.

Flagged styles are written to `data/style_profiles/flagged_styles.json` with the specific diffs, so the disagreements are inspectable rather than buried in a console log.

## 3. What the shipped data actually shows

The calibration output is included in the repository and is unflattering in a useful way. Real entries include:

- **house**: `BPM: JSON=126 vs Audio mean=109.0 (Δ=17)` — and a dark-timbre claim contradicted by a 3253 Hz centroid.
- **jungle**: `BPM: JSON=160 vs Audio mean=138.5` — a 21.5 BPM overstatement.
- **ambient_techno**: a dark-timbre claim contradicted by a 4419 Hz centroid.
- Several styles: `No audio profile found — cannot calibrate`.

That last line is the honest limit of the system: **calibration only covers styles that have audio profiles.** A style without one is unverified, and the data says so rather than implying confidence.

## 4. Why this loop matters more than the model

The interesting engineering claim here is not "we used an LLM to write style metadata". It is:

> We do not trust generated knowledge about music; we measure it, we correct the hard numbers, we cross-check the character claims, and we record the disagreements where a human can see them.

That is also why the correction is written back with **p10/p90/mean** rather than a single replacement number: a distribution is more useful to a generator than a point estimate, and it preserves the measured spread.