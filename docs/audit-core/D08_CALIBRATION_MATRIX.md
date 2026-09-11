# D08 Calibration Matrix — Structural Readability

Status: calibration contract before implementation.

## 1. Parameters under calibration

| Parameter | Initial prior | Meaning | Must not be frozen before corpus |
|---|---:|---|---|
| `w_text` | 0.20 | text-layer integrity weight | yes |
| `w_order` | 0.22 | reading-order weight | yes |
| `w_sections` | 0.15 | section-topology weight | yes |
| `w_layout` | 0.13 | layout-topology weight | yes |
| `w_encoding` | 0.12 | encoding-integrity weight | yes |
| `w_heading` | 0.07 | heading distinguishability | yes |
| `w_fields` | 0.07 | present field parseability | yes |
| `w_lists` | 0.04 | list consistency | yes |
| `h_order` | 0.12 | weighted-discordance half-life | yes |
| `tau_enc` | 0.008 | encoding damage scale | yes |
| layout decay constants | TBD | overlap/clipping/z-order/nesting | yes |
| cap thresholds | TBD priors | catastrophic states | yes |
| cap limits | 25/40/45/50 priors | score ceilings | yes |

## 2. Golden-corpus fixture matrix

| Fixture | Purpose | Required relationship |
|---|---|---|
| D08_01 clean single column | clean baseline | high score, no cap |
| D08_02 clean two column | test column neutrality | within tolerance of D08_01 |
| D08_03 interleaved two column | reading-order failure | clearly below D08_02 |
| D08_04 safe three column | no column-count prejudice | no automatic collapse |
| D08_05 scan no native text | text-layer failure | critical text evidence |
| D08_06 correct OCR layer | recovery/reference | above D08_05 |
| D08_07 Polish mojibake | lexical damage | below clean Polish |
| D08_08 NFKC ligature | normalization sanity | approximately clean |
| D08_09 nested table | topology risk | below safe equivalent |
| D08_10 floating overlap | overlap risk | below safe equivalent |
| D08_11 clipping | clipping risk | below unclipped equivalent |
| D08_12 mixed but parseable dates | field parsing | mild/no penalty depending parseability |
| D08_13 ambiguous dates | ambiguity | below D08_12 |
| D08_14 minimalist headings | avoid visual-style bias | acceptable if separable |
| D08_15 inconsistent list indents | list defect | below normalized list |
| D08_16 no lists | N/A correctness | no penalty for absence |
| D08_17 hidden white text | adversarial | explicit penalty/evidence |
| D08_18 off-page text | adversarial/layout | explicit defect |
| D08_19 duplicate invisible layer | precision/gaming | below clean equivalent |
| D08_20 clean Polish diacritics | Unicode baseline | high encoding integrity |

## 3. Required metamorphic relations

### M01 Column neutrality

Transform one-column fixture into two columns while preserving semantic order and extraction.

Expected:

`abs(score_before - score_after) <= tolerance_column_neutrality`.

Initial tolerance candidate: 3 points. To calibrate.

### M02 Reading-order repair

Repair only block order.

Expected:

`score_after >= score_before` and `readingOrder_after > readingOrder_before`.

### M03 Unicode normalization

Replace canonical `fi` with Unicode ligature `ﬁ` where NFKC restores the same token.

Expected:

`abs(score_after - score_before) <= 1`.

### M04 Optional contact channel removal

Remove LinkedIn URL while leaving remaining structure unchanged.

Expected:

No structural penalty. `Structured Field Parseability` may renormalize over remaining present fields.

### M05 Content independence

Replace technology names with equal-length alternatives without changing layout.

Expected:

D08 unchanged within numerical tolerance.

### M06 Bullet absence

Convert a valid prose-only CV that intentionally uses no bullets.

Expected:

List component is N/A, not 0 and not 100.

### M07 Mojibake repair

Replace mojibake tokens with correct Polish characters.

Expected:

Encoding score strictly increases and total score does not decrease.

### M08 Clipping repair

Move clipped text entirely inside page bounds without changing content.

Expected:

Layout topology score increases.

## 4. Missingness tests

- extractor failure → `INSUFFICIENT_DATA`, `score=null`;
- missing optional field → no free points, no penalty;
- absent list → list component N/A;
- absent source AST on external PDF → lower confidence, not automatic low score;
- missing reading-order evidence because parser failed → must not be renormalized away as N/A.

## 5. Independence tests

The following must not directly alter D08 when geometry/text extraction remains equivalent:

- salary,
- seniority label,
- job-description semantics,
- number of certificates,
- achievement strength,
- role relevance,
- Master Vault truthfulness.

## 6. Adversarial tests

Required attacks:

1. white-on-white keyword stuffing;
2. opacity-zero text;
3. 1px/near-zero font text;
4. off-page keyword block;
5. duplicated invisible text layer;
6. overlapping text boxes with conflicting order;
7. z-index manipulation;
8. repeated JD hidden behind visible content;
9. Unicode control characters influencing order;
10. thousands of decorative private-use glyphs.

Each attack must produce deterministic Evidence IDs and diagnostic codes.

## 7. Numerical stability

For every fixture and random perturbation:

- no NaN;
- no Infinity;
- all normalized values within `[0,1]`;
- all final scores within `[0,100]` when score is non-null;
- effective component weights sum to 1 within floating tolerance;
- ledger final score equals runtime final score within `1e-9` before display rounding.

## 8. Perturbation grid

Evaluate score sensitivity around:

- reading-order discordance `0..0.40` in 0.005 increments;
- weighted encoding damage `0..0.05`;
- clipping ratio `0..0.20`;
- overlap ratio `0..0.20`;
- heading separation `0..1`;
- date ambiguity rates `0..1`.

Report maximum local first difference and any unexplained discontinuity.

Hard-cap discontinuities are allowed only at documented logical thresholds.

## 9. Threshold selection rule

A hard-cap threshold cannot be accepted because it “looks strict”.

It must satisfy all three:

1. separates corpus cases with materially broken extraction from recoverable documents;
2. does not trigger on known safe layouts;
3. is stable under small perturbations around clean cases.

If no threshold meets these constraints, use continuous degradation without a hard cap.

## 10. Weight selection rule

Component weights are accepted only after sensitivity analysis.

For each candidate vector:

- perturb each weight ±20% and renormalize;
- measure ranking changes in corpus;
- detect whether one cosmetic dimension dominates fundamental extraction integrity;
- reject weight vectors where safe two-column documents rank below heavily corrupted one-column documents.

## 11. Acceptance invariants

D08 cannot be accepted unless these invariants hold:

- `clean two-column` is not punished merely for column count;
- `interleaved two-column` is clearly worse than safe two-column;
- NFKC-cleanable ligatures do not look like corruption;
- absent bullets do not give free points or penalties;
- missing LinkedIn does not reduce D08;
- missing work experience does not trigger a D08 hard cap;
- parser failure yields null score, not a fabricated low number;
- a measured bad native text layer can yield a genuinely low score with high confidence;
- every negative deduction/cap is visible in Score Ledger.

## 12. Drift gate

Every future change to D08 scorer/extractor/config must output:

- old/new score per fixture,
- old/new component vector,
- old/new confidence,
- changed hard caps,
- changed penalties,
- ranking inversions,
- violated metamorphic relations.

Unexplained ranking inversion blocks merge.
