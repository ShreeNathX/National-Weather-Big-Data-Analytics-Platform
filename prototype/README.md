# 🇮🇳 NWBDAP — National Weather Big Data Analytics Platform

**Prototype** | SIH 2024 | GitHub Pages Hosted

A fully client-side, zero-backend prototype of the National Weather Big Data Analytics Platform demonstrating the complete data pipeline — from data collection through preprocessing, enrichment/verification, alerting, and consumer views.

---

## 🗺 Architecture (Prototype Scope)

```
Data Collection        Ingestion Buffer     Processing (Lakehouse)       Serving & Alerting     Consumers
─────────────────      ────────────────     ──────────────────────────   ──────────────────     ─────────────────
📡 Weather APIs   ──►  🔄 Stream Buffer  ──►  🟤 Bronze (Raw)         ──►  🚨 Alert Engine  ──►  🚒 Emergency Agency
#  Social Media   ──►  (in-memory Kafka)   ──►  ⚪ Silver (Clean)      ──►  📊 Analyst       ──►  🛡 Admin
📸 Citizen Report                          ──►  🔬 Enrich & Verify
                                           ──►  🟡 Gold (Aggregates)
```

> **No AWS. No NLP/ML. No backend.** Pure rule-based, client-side pipeline using free public APIs.

---

## ✅ Features

| Layer | Implementation |
|-------|---------------|
| **Data Collection** | 6 live free APIs: Open-Meteo, GloFAS River, Marine, wttr.in, MET Norway, AQI |
| **Social Media** | Mastodon public API (#IMD, #flood, #cyclone, etc.) |
| **Citizen Reporter** | In-app form with preset scenarios + live verification |
| **Ingestion Buffer** | In-memory stream buffer simulating Kafka partitions |
| **Bronze Layer** | Raw record store with source metadata & timestamps |
| **Silver Layer** | Value clamping, null-fill, text sanitisation, normalisation |
| **Enrich & Verify** | Rule-based cross-verification of social vs telemetry → Gold aggregates |
| **Alert Engine** | Severity-scored alerts (CRITICAL/HIGH/MODERATE/LOW) by IMD thresholds |
| **Analyst Console** | Full data view + JSON export |
| **Emergency Agency** | Operational CRITICAL/HIGH alert feed + verified reports |
| **Admin** | Full system health + pipeline log |

---

## 🌐 Live Telemetry APIs (100% Free)

| # | Source | Data |
|---|--------|------|
| 1 | [Open-Meteo](https://open-meteo.com) | Temp, Rain, Wind, Pressure |
| 2 | [GloFAS Flood API](https://flood-api.open-meteo.com) | River discharge (m³/s) |
| 3 | [Open-Meteo Marine](https://marine-api.open-meteo.com) | Wave height, coastal surge |
| 4 | [wttr.in](https://wttr.in) | Observed city conditions |
| 5 | [MET Norway](https://api.met.no) | Independent forecast model |
| 6 | [Open-Meteo AQI](https://air-quality-api.open-meteo.com) | PM2.5, PM10, US AQI |

---

## 🚀 How to Run

### GitHub Pages (Recommended)
1. Push this `prototype/` folder to a GitHub repo
2. Go to **Settings → Pages → Source: Deploy from branch → `main` / `prototype` folder**
3. Your platform will be live at `https://<username>.github.io/<repo>/prototype/`

### Local (any static server)
```bash
# Using Python
cd prototype
python -m http.server 8080
# Open http://localhost:8080

# Using Node.js npx
npx serve .
```

> ⚠️ **Must use a local server** — ES modules (`import`) don't work with `file://` directly.

---

## 📁 File Structure

```
prototype/
├── index.html      ← Main dashboard (single-page app, all 11 pages)
├── adapters.js     ← Data Collection: 6 weather APIs + social ingestion + rule-based verifier
├── pipeline.js     ← Pipeline engine: Stream buffer, Bronze→Silver→Gold
├── schema.js       ← Data contracts: createWeatherRecord, createBronzeRecord, etc.
└── README.md       ← This file
```

---

## 🔬 Rule-Based Verification (No NLP/ML)

The verification engine uses **threshold-based rules** against live telemetry:

| Claim | Verified If |
|-------|-------------|
| Flooding | Rain ≥ 10mm OR River ≥ 200 m³/s OR Wave ≥ 2.5m |
| Cyclone | Wind gust ≥ 50 km/h OR Wave ≥ 2.5m |
| Heatwave | Temperature ≥ 40 °C |
| Suspicious | Contradiction between claim and all live telemetry |

---

## 🚨 IMD Alert Thresholds

| Code | Condition |
|------|-----------|
| `EXTREMELY_HEAVY_RAIN` | Rain ≥ 64.5 mm/h |
| `HEAVY_RAIN` | Rain ≥ 15.6 mm/h |
| `MAJOR_RIVER_FLOOD` | River ≥ 800 m³/s |
| `COASTAL_SURGE_CRITICAL` | Wave ≥ 4m |
| `CYCLONE_WIND` | Gust ≥ 90 km/h |
| `EXTREME_HEAT` | Temp ≥ 45°C |
| `BAROMETRIC_DEPRESSION` | Pressure < 990 hPa |

---

## 🛠 Tech Stack

- **Vanilla HTML + CSS + JavaScript** (ES Modules)
- **No frameworks, no build tools, no backend**
- **Google Fonts**: Inter + JetBrains Mono
- **Hosting**: GitHub Pages (static)

---

## 👥 Team

SIH 2024 — National Weather Big Data Analytics Platform
