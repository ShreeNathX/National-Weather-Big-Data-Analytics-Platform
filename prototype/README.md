# NWBDAP - National Weather Big Data Analytics Platform

**Simplified and Fast-Loading Prototype** | SIH 2024 | Zero-Backend Client-Side Lakehouse

A streamlined, lightweight, high-performance prototype demonstrating the complete National Weather Big Data Analytics pipeline: Multi-Source Data Ingestion, Lakehouse Storage (Bronze/Silver/Gold), Rule-Based Citizen Verification, and Early Disaster Alerts.

---

## Real-Time API Telemetry and Disaster Drills

1. **Real-Time Live API Stream**: Directly ingests real-time observations from 6 live meteorological APIs (`api.open-meteo.com`, `flood-api.open-meteo.com`, `marine-api.open-meteo.com`, `wttr.in`, `api.met.no`, `air-quality-api.open-meteo.com`) plus the Mastodon fediverse (`mastodon.social`) for any selected Indian city.
2. **Simulation Drills (Extreme Weather Alarms)**: One-click scenario buttons to demonstrate disaster warning pipelines under critical conditions:
   - **Assam Floods** (Brahmaputra Basin: 88.4 mm rain, 980 m3/s discharge - CRITICAL Flood)
   - **Mumbai Cloudburst** (Konkan Coast: 114.2 mm rain, 3.8 m waves - CRITICAL Rain)
   - **Odisha Cyclone** (Bay of Bengal: 126 km/h gusts, 4.6 m surge - CRITICAL Cyclone)
   - **Jaipur Heatwave** (Thar Desert: 46.8 deg C extreme heat - CRITICAL Heatwave)
   - **Delhi Smog** (Indo-Gangetic Plain: AQI 340 smog baseline)
3. **Streamlined 4-Tab Navigation**:
   - **Live Dashboard**: Real-time KPI summary, live provider endpoints, disaster severity banner, and 6 active sensor cards.
   - **Citizen Verification (Fake Buster)**: Interactive claim tester corroborating citizen disaster reports against live sensor telemetry with confidence scoring.
   - **Big Data Pipeline (Lakehouse)**: Real-time Kafka-style stream buffer to Bronze to Silver to Gold pipeline with live execution logging.
   - **Emergency Action (NDRF)**: Priority dispatch warnings and Standard Operating Procedures (SOPs) dynamically calibrated to current severity.
4. **Resilient Client-Side Fetch**: 2.5s timeouts and graceful fallbacks ensure the dashboard is fast, robust, and never freezes.

---

## Architecture

```
Data Collection        Ingestion Buffer     Processing (Lakehouse)       Serving and Alerting   Consumers
-----------------      ----------------     --------------------------   --------------------   -----------------
Weather APIs       -->  Stream Buffer   -->  Bronze (Raw)            -->  Alert Engine       -->  Emergency Action (NDRF)
Social Media       -->  (in-memory Kafka)-->  Silver (Cleaned)        -->  Verifier           -->  District Admin
Citizen Reports    -->                   -->  Gold (Aggregates)       -->  Live Metrics       -->  JSON Export
```

> Zero AWS. Zero Python Backend. Pure Client-Side JavaScript (ES Modules).

---

## Telemetry Sources (6 APIs)

| No. | Source | Data |
|-----|--------|------|
| 1 | [Open-Meteo](https://open-meteo.com) | Rain, Temperature, Pressure, Wind Gusts |
| 2 | [GloFAS Flood API](https://flood-api.open-meteo.com) | River discharge (m3/s) |
| 3 | [Open-Meteo Marine](https://marine-api.open-meteo.com) | Coastal wave surge (m) |
| 4 | [wttr.in](https://wttr.in) | Observed ground conditions |
| 5 | [MET Norway](https://api.met.no) | Independent Scandinavian forecast model |
| 6 | [Open-Meteo AQI](https://air-quality-api.open-meteo.com) | PM2.5, PM10, US AQI |

---

## How to Run

### 1. Local (Any Static Server)
```bash
# Using Python
cd prototype
python -m http.server 8080
# Open http://localhost:8080 in your browser

# Or using Node.js
npx serve prototype
```

### 2. GitHub Pages (Automated Deployment)
This prototype is automatically deployed via GitHub Actions to GitHub Pages on every push.

Live URL: [NWBDAP Prototype](https://shreenathx.github.io/National-Weather-Big-Data-Analytics-Platform/)

---

## File Structure

```
prototype/
|-- index.html      - Streamlined dashboard (4 tabs, instant scenarios, dark mode)
|-- adapters.js     - 6 Weather API adapters, 1-click scenarios, and verification engine
|-- pipeline.js     - Lakehouse engine: Stream buffer, Bronze to Silver to Gold
|-- schema.js       - Data contracts and record schemas
`-- README.md       - Documentation
```
