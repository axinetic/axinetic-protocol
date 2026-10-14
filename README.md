# Axinetic

A live Solana board: boosted names ranked by traded volume, refreshed every minute.

[![Live site](https://img.shields.io/badge/live-axinetic.fun-f1e8d3?labelColor=000000)](https://axinetic.fun)

- **Chain:** Solana
- **Contract address:** pending

## Overview

Axinetic reads the promoted-token list, keeps Solana entries, resolves each name to its deepest pool and shows the ten largest by 24h volume. Figures redraw on a 60 second cadence and pause while the tab is hidden.

## Features

- Live top ten with price, 24h change, volume, liquidity and a copy-address button
- Ticker driven by the same readings
- Stat tiles with count-up and change flash
- Exponential backoff on source failure, last good reading kept
- Reduced-motion fallback for every animation
- Register-driven links: unstated records render inert

## Links

- X: https://x.com/axinetic
- GitHub: https://github.com/axinetic/axinetic-protocol

## Build

```bash
npm install
npm run build
```

Output lands in `dist/`.

## License

MIT
