# chart-benchmark

Three-way benchmark: **Lightweight Charts** (TradingView, MIT, Canvas 2D) vs **Apache ECharts** (Canvas 2D) vs a **WebGL candlestick renderer** built with the same GPU-accelerated approach as [charts.finterm.xyz](https://charts.finterm.xyz).

Open `benchmark.html` in any Chromium-based browser to run it yourself, or run headlessly:

```bash
npm install
node run-benchmark.js          # headless, saves results.json
node run-benchmark.js --headed # watch it run
```

---

## What is measured

**Synchronous render time per operation** — not frames per second.

- **Canvas 2D (LW Charts, ECharts):** `performance.now()` before and after each synchronous draw call. RAF-based FPS is meaningless in headless Chrome — without vsync, RAF fires at 120fps regardless of render load.
- **WebGL:** `gl.finish()` after each `drawArrays()` call blocks until the GPU completes its command queue, giving true GPU render time. Same geometry format as charts.finterm.xyz: each candle = 6 vertices for the body quad + 2 vertices for the wick line.

**Operations:**
- **setData**: upload full OHLCV dataset and render initial chart
- **Pan (500 ops)**: slide a fixed visible window across the full dataset
- **Zoom (200 ops)**: vary the visible window from 10 candles to the full dataset

Effective FPS = `min(60, 1000 / p50_ms)`.

---

## Results (Apple M5, Headless Chromium 149)

### setData — initial render time (ms, lower is better)

| Candles | Lightweight Charts | Apache ECharts | WebGL (Finterm) |
|---|---|---|---|
| 1,000 | 33.2 | 33.8 | **0.6** |
| 5,000 | 16.2 | 8.5 | **1.4** |
| 10,000 | 14.7 | 20.1 | **4.1** |
| 50,000 | 44.8 | 27.9 | **11.8** |
| 100,000 | 75.3 | 41.2 | **26.8** |

WebGL setData is faster because it only uploads a flat Float32Array to a GPU buffer. Canvas 2D libraries do JavaScript-side layout, axis computation, and incremental draw calls during the initial render.

Note: Canvas 2D setData times here include two rAF callbacks to flush the rendering pipeline before measuring. This adds ~16ms floor on headless Chrome; absolute setData numbers are less meaningful than pan/zoom times.

### Pan — render time per operation (ms, p50 / p95 / max)

| Candles | LW p50 | LW p95 | LW max | EC p50 | EC p95 | EC max | WebGL p50 | WebGL p95 | WebGL max |
|---|---|---|---|---|---|---|---|---|---|
| 1,000 | 0.0 | 0.0 | 0.1 | 0.2 | 0.4 | 2.1 | 0.0 | 0.0 | 0.1 |
| 5,000 | 0.0 | 0.0 | 0.1 | 0.4 | 0.6 | 1.6 | 0.0 | 0.0 | 0.1 |
| 10,000 | 0.0 | 0.1 | 0.1 | 0.5 | 0.7 | 1.4 | 0.0 | 0.0 | 0.1 |
| 50,000 | 0.0 | 0.0 | 0.1 | 0.6 | 0.8 | 4.1 | 0.0 | 0.0 | 0.1 |
| 100,000 | 0.0 | 0.0 | 0.1 | 0.7 | 0.9 | **6.3** | 0.0 | 0.0 | **0.1** |

**LW Charts and WebGL both show 0.0ms p50 and 0.1ms max across all scales** — effectively free. Each pan step changes a uniform value and calls `drawArrays()` with the same vertex buffer; the GPU doesn't re-upload geometry.

ECharts pan cost grows with dataset size. The 6.3ms max at 100k is fine on an M5, but on a mid-range 2022 Windows laptop (~2.5× slower for Canvas 2D), that spike becomes ~16ms — right at the frame budget threshold. Larger datasets or lower-end hardware will drop frames.

### Zoom — render time per operation (ms, p50 / p95)

| Candles | LW p50 | LW p95 | EC p50 | EC p95 | WebGL p50 | WebGL p95 |
|---|---|---|---|---|---|---|
| 1,000 | 0.0 | 0.0 | 0.3 | 2.1 | 0.0 | 0.0 |
| 5,000 | 0.0 | 0.0 | 0.5 | 1.0 | 0.0 | 0.0 |
| 10,000 | 0.0 | 0.0 | 0.9 | 1.2 | 0.0 | 0.0 |
| 50,000 | 0.0 | 0.0 | 0.6 | 0.9 | 0.0 | 0.0 |
| 100,000 | 0.0 | 0.0 | 0.9 | 1.2 | 0.0 | 0.0 |

LW Charts and WebGL zoom: both 0ms p50/p95 at all scales. ECharts zoom stays under 2ms p95 — fine in practice.

### All eff FPS (pan p50)

All three hit ≥60fps effective at every scale on M5. The distinguishing factor is **max spike** behavior — LW Charts and WebGL cap at 0.1ms; ECharts reaches 6.3ms at 100k.

---

## What this doesn't benchmark

**TradingView widget**: the free embed is an `<iframe>` loading tradingview.com. You cannot instrument its render calls from the parent page. Separately measured: iframe load time via the `load` event — cold ~3,100ms on a residential connection, warm ~620ms. The iframe payload is ~5MB of JS for the full TradingView application.

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

Or open `benchmark.html` in Chrome/Edge/Brave and click "Run benchmark".

Results from the automated run on Apple M5 are in [`results.json`](./results.json).
