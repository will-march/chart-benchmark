# chart-benchmark

Benchmark comparing [Lightweight Charts](https://github.com/tradingview/lightweight-charts) (TradingView, MIT) vs [Apache ECharts](https://echarts.apache.org) for candlestick chart embeds at scale.

Open `benchmark.html` in any Chromium-based browser to run it yourself. Or run headlessly:

```bash
npm install
node run-benchmark.js          # headless
node run-benchmark.js --headed # watch it run
```

---

## What is measured

**Synchronous render time per operation** — not frames per second. Canvas 2D draw calls are synchronous JavaScript, so `performance.now()` before and after each call gives the actual render budget consumed.

- **setData**: time to load the full OHLCV dataset and render the initial chart
- **Pan p50/p95/max**: distribution of `scrollToPosition()` / `dispatchAction(dataZoom)` times across 500 steps spanning the full data range
- **Zoom p50/p95/max**: distribution of `setVisibleRange()` times across 200 steps from 2% to 99% of the data

Effective FPS = `min(60, 1000 / p50_ms)`. A p50 of 1ms → 60fps. A p50 of 20ms → 50fps. The p95 and max show worst-case jank.

**Why not raw FPS?** Headless Chromium renders without vsync at ~120fps regardless of render load. Measuring RAF count gives 120fps for everything, which is not useful.

---

## Results (Apple M5, Headless Chromium 149)

### setData — initial render time (ms, lower is better)

| Candles | Lightweight Charts | ECharts |
|---|---|---|
| 1,000 | **1.7** | 25.7 |
| 5,000 | **4.8** | 14.7 |
| 10,000 | **7.3** | 11.7 |
| 50,000 | 22.5 | **25.1** |
| 100,000 | 45.7 | **38.8** |

ECharts pays a fixed initialization cost (~20ms) regardless of dataset size — visible at 1k candles where it's ~15× slower than LW Charts. Above 50k they converge. Both exceed one frame (16.7ms) at 100k, though neither would block interaction since setData is a one-time cost.

### Pan p50 / p95 / max (ms, per scrollToPosition call)

| Candles | LW p50 | LW p95 | LW max | EC p50 | EC p95 | EC max |
|---|---|---|---|---|---|---|
| 1,000 | 0.0 | 0.1 | 0.2 | 0.2 | 0.4 | 2.0 |
| 5,000 | 0.0 | 0.1 | 0.1 | 0.4 | 0.6 | 1.5 |
| 10,000 | 0.0 | 0.0 | 0.1 | 0.5 | 0.7 | 1.7 |
| 50,000 | 0.0 | 0.0 | 0.1 | 0.6 | 0.8 | 5.7 |
| 100,000 | 0.0 | 0.0 | 0.1 | 0.8 | 0.9 | **9.2** |

Lightweight Charts pan cost is effectively zero at all scales on this hardware. ECharts grows with dataset size and shows spikes up to 9.2ms at 100k.

**Scaling to slower hardware**: these numbers are from an Apple M5. A mid-range 2022 Windows laptop (i5-1235U) typically runs Canvas 2D work at ~2.5× the cost. At that multiplier, ECharts pan max at 100k → ~23ms — exceeding the 16.7ms frame budget and dropping below 60fps on a visible spike.

### Zoom p50 / p95 (ms)

| Candles | LW p50 | LW p95 | EC p50 | EC p95 |
|---|---|---|---|---|
| 1,000 | 0.0 | 0.0 | 0.2 | 2.0 |
| 5,000 | 0.0 | 0.0 | 0.5 | 1.0 |
| 10,000 | 0.0 | 0.0 | 0.8 | 1.2 |
| 50,000 | 0.0 | 0.0 | 0.6 | 0.9 |
| 100,000 | 0.0 | 0.0 | 0.9 | 1.2 |

---

## What this doesn't benchmark

**TradingView widget**: the free embed is an `<iframe>` loading tradingview.com. You cannot instrument its render calls from the parent page. What we can measure (and did, separately): iframe load time via the `load` event. Cold: ~3s on a residential connection. Warm (browser cache): ~600ms. The iframe payload is ~5MB of JS for the full TradingView application.

**charts.finterm.xyz**: also iframe-based, with a WebGL renderer. WebGL render calls are not synchronous JS — the GPU runs the shader asynchronously after the draw call returns. The correct benchmark for WebGL is GPU timestamp queries, which require the `EXT_disjoint_timer_query_webgl2` extension. We didn't include it here because the measurement methodology differs from Canvas 2D.

The blog post that accompanies this benchmark covers both iframe options qualitatively.

---

## Synthetic data

Candles are generated with a random-walk close price (±1.2% per bar), realistic high/low wicks, and hourly timestamps starting from Unix 1,700,000,000. No real market data is fetched.

---

## Run it yourself

```bash
git clone https://github.com/will-march/chart-benchmark
cd chart-benchmark
npm install
node run-benchmark.js
# results saved to results.json
```

Or just open `benchmark.html` in Chrome/Edge/Brave and click "Run benchmark".

Results from the automated run are in [`results.json`](./results.json).
