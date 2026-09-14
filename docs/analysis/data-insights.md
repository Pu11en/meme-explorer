# Data Insights — Findings from Recorded Batches

Running log of patterns and signals discovered from live pipeline data.
Updated as new batches accumulate. All findings based on real recordings.

---

## Signal Performance (30 batches · 42,202 coins · 99 organic migrators)

| Signal | Catches | FP Rate | Precision |
|--------|---------|---------|-----------|
| ⚡ 10 Burst ≥100 buys 0-10s + sustain≥0.3 | 17/99 (17%) | 0.36% | 8.9% |
| ⏱ 30 Burst ≥200 buys 0-30s + sustain≥0.4 | 25/99 (25%) | 0.35% | 11.7% |
| 🟢 60 Burst ≥60 uniq @60s + slot<5 | 75/99 (76%) | 0.00% | 43.4% |
| 🔵 120 Burst ≥80 uniq @120s + slot<5 | 77/99 (78%) | 0.00% | 38.7% |
| Combined 60+120 | 78/99 (79%) | 0.00% | — |

**60 Burst is the action signal.** 43% precision, zero false positives on 42k coins.
10/30 Burst are velocity alerts only — too noisy to act on alone.

---

## Time of Day (CDT) — Organic Rate

| Hour | Organic Rate | Notes |
|------|-------------|-------|
| 8AM  | 0.13% | Worst |
| 9AM  | 0.11% | Worst |
| 10AM | 0.35% | Good |
| 11AM | 0.31% | Good |
| 12PM | 0.31% | Good |
| 1PM  | 0.17% | Average |
| 2PM  | 0.14% | Average |
| 3PM  | 0.20% | Average |
| 4PM  | 0.32% | Good |

**10AM–12PM CDT is 3x better than 8–9AM.** The market wakes up mid-morning.
4PM also has a secondary peak. Early morning sessions are the weakest.

---

## Fast vs Slow Organic Migrators

|                 | Fast <1m | Mid 1–5m | Slow >5m |
|-----------------|----------|----------|----------|
| Unique @60s     | 309      | 158      | 100      |
| Buys @60s       | 486      | 234      | 133      |
| Whale buyers    | 175      | 93       | 49       |
| Count           | 29       | 36       | 32       |

Fast migrants have 2x the unique buyers and whales vs slow ones.
The 60 Burst threshold of ≥60 uniq is conservative — real rockets hit 200–400.

---

## SOL Volume → Migration Speed

| SOL @60s     | n  | Avg speed | Median speed |
|--------------|----|-----------|-------------|
| < 100 SOL    | 41 | 7m 29s    | 5m 13s |
| 100–1k SOL   | 21 | 2m 39s    | 1m 01s |
| > 10k SOL    | 34 | 3m 34s    | 1m 07s |

Higher SOL volume = faster migration. Median for high-SOL coins is ~1 minute.

---

## Sniper Ratio — Negative Filter

Sniper ≥80% occurs in **50% of bundles** but only **20% of organics**.
High sniper concentration is a bundle signal, not an organic one.

Organic avg sniper ratio: 64.6%  
Bundle avg sniper ratio: 73.9%

Snipers chase winners but bundles attract more concentrated bot activity.

---

## New Signal Dimensions — Strongest Separators Found

Computed from per-second bars data (bars_3min). No w60 needed.

| Metric | Organic median | Non-mig median | Separation |
|--------|---------------|----------------|------------|
| Active seconds 0-60 | 51s | 3s | **17x** |
| Longest dead streak | 3s | 46s | **15x** |
| Buy CV (volatility) | 0.95 | 4.64 | **5x steadier** |
| Peak buy window | 15s in | 0s in | 3.7x |
| Sustain 10s | 1.03 | 0.00 | — |

**Active seconds** and **dead streak** are the two biggest separators ever found —
bigger than raw buy counts. Organic coins buy in 51 of 60 seconds. Dead coins buy in 3.

### Why these can't be standalone action signals
FP rates are too high (8–13%) to act on alone — they fire on bundles too.
Best use: early warning / "keep watching" filter at the 30-second mark.

### Updated Signal Stack

| Time | Signal | Purpose | FP Rate | Precision |
|------|--------|---------|---------|-----------|
| 10s | ⚡ 10 Burst ≥100 buys + sustain≥0.3 | Extreme rocket — act NOW | 0.36% | 8.9% |
| 30s | 👀 active≥35 + gap≤10 | Keep watching filter | 7.7% | 1.8% |
| 60s | 🟢 60 Burst ≥60 uniq + slot<5 | **Action signal** | 0.00% | 43.4% |
| 120s | 🔵 120 Burst ≥80 uniq + slot<5 | Action signal | 0.00% | 38.7% |

The 30s watch signal catches 70/99 organics (71%) and fires 30 seconds before
60 Burst — giving early warning time. Not to buy, but to be ready.

---

## Repeat Developer Pattern

Identified 6 creator wallets with 2+ organic launches from trades parquet.
Creator field in migrators.json is null — must derive from first trade signer.

| Wallet (short) | Launches | Avg migration | Notable coins |
|---------------|----------|--------------|---------------|
| bwamJzzt...dNfSXa | 5 | 1m32s | CASHLESS, faucat, Memes Into Money ×2, Anonymous Dog |
| AV7PjXHL...JP8gUz | 3 | **0m14s** | Popcat, Baton, peecash — all sub-30s |
| Fzz2amRo...jE4rp4 | 2 | **0m02s** | Airdrop + DIAMOND HANDS — same batch, both <3s |
| B32QbbdD...9SJqnC | 2 | 1m58s | NASDOG (448 uniq), PumpFun Strategy |
| 8X5z6yBx...yU2uPi | 2 | 2m31s | Milestone, Don key |
| dtrzJPj7...XMedXy | 2 | 7m38s | Make Holders Win Again, flying tesla roadster |

**Key insight:** AV7PjXHL and Fzz2amRo consistently launch sub-30-second migrants.
Any new coin from those wallets = buy without waiting for signals.

Name patterns (across 99 organics): "airdrop" (5x), "baton" (5x), "cat" (3x),
"hodl" (3x), "faucat" (2x), "popcat" (2x), "twine" (2x).

---

## Market Tempo — Organic Rate by Date

| Date     | Batches | Organic Rate (rolling avg) | Notes |
|----------|---------|--------------------------|-------|
| Sep 10   | 4       | 0.07–0.18%               | First day |
| Sep 11   | 9       | 0.10–0.21%               | Normal |
| Sep 12   | 9       | 0.18–0.41%               | Hot session |
| Sep 13   | 8+      | 0.08–0.28%               | Cooling |

The market has hot and cold sessions. batch-030 and batch-031 had zero organics.
batch-020 (Sep 12, 4PM CDT) had 12 organics in one hour — biggest outlier recorded.

---

## Key Metric Ratios (organic vs non-migrating)

| Metric | Organic avg | Non-mig avg | Ratio |
|--------|------------|-------------|-------|
| Buys 0-60s | 272 | 21 | 13x |
| Active seconds 0-60 | 43s | 9s | 4.6x |
| Longest dead streak | 7s | 40s | — |
| Buy CV (volatility) | 1.31 | 10.76 | 8x steadier |
| Peak buy window | 19s in | 5s in | — |

Organic coins buy across 43 of 60 seconds. Dead coins buy in 9.
Organic buying is 8x steadier (lower volatility). Bundles spike and crater.
Organic peak buy rate happens at ~20s in. Bundle peak is at 0–5s.
