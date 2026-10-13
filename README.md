# NWBDAP - National Weather Big Data Analytics Platform

Live Prototype: [NWBDAP — National Weather Big Data Analytics Platform](https://shreenathx.github.io/National-Weather-Big-Data-Analytics-Platform/)

Smart India Hackathon (SIH) 2024 Project.

NWBDAP is a high-performance, client-side Lakehouse analytics platform demonstrating an end-to-end meteorological and disaster early-warning data pipeline: multi-source data ingestion, stream buffering, Bronze-Silver-Gold Lakehouse processing, rule-based citizen report verification, and dynamic disaster alerting.

---

## Live Demo

Access the interactive web prototype directly via GitHub Pages:
- [NWBDAP — National Weather Big Data Analytics Platform](https://shreenathx.github.io/National-Weather-Big-Data-Analytics-Platform/)

---

## System Architecture

```
Data Collection        Ingestion Buffer     Processing (Lakehouse)       Serving and Alerting   Consumers
-----------------      ----------------     --------------------------   --------------------   -----------------
Weather APIs       -->  Stream Buffer   -->  Bronze (Raw Storage)    -->  Alert Engine       -->  NDRF Emergency Action
Social Media Streams   (In-Memory Kafka)    Silver (Cleaned Storage)     Citizen Verifier        District Administration
Citizen Reports                             Gold (Aggregations)          Live Telemetry KPIs     Analytical JSON Export
```

### Architectural Highlights
- Zero backend dependencies: Runs entirely client-side using JavaScript ES Modules.
- In-memory event stream processing mimicking distributed Kafka pipelines.
- Multi-tier data lakehouse storage model:
  - Bronze Tier: Raw immutable data ingestion from external APIs and citizen reports.
  - Silver Tier: Data validation, range clamping, deduplication, and schema normalization.
  - Gold Tier: High-level metric aggregation, anomaly flags, and disaster alert evaluation.
- Verifier Engine: Cross-references crowdsourced disaster claims against authoritative live meteorological sensor telemetry with confidence scoring.

---

## Live Telemetry Sources

The platform aggregates real-time observational data from six independent meteorological and environmental providers:

| Source | Provider | Telemetry Metrics |
|---|---|---|
| Open-Meteo Weather | open-meteo.com | Precipitation, temperature, surface pressure, wind gusts |
| GloFAS Flood API | flood-api.open-meteo.com | River discharge rates (m3/s) |
| Open-Meteo Marine | marine-api.open-meteo.com | Coastal wave height and storm surge (m) |
| wttr.in | wttr.in | Ground-level weather conditions |
| MET Norway | api.met.no | Scandinavian meteorological forecast model |
| Open-Meteo Air Quality | air-quality-api.open-meteo.com | PM2.5, PM10, and US AQI indices |
| Social Telemetry | mastodon.social | Public social mentions and crowdsourced status updates |

---

## Disaster Simulation Scenarios

The prototype includes pre-configured critical disaster drills for rapid evaluation:
- Assam Floods: Brahmaputra Basin (88.4 mm rainfall, 980 m3/s river discharge - Critical Flood Alert)
- Mumbai Cloudburst: Konkan Coast (114.2 mm rainfall, 3.8 m coastal waves - Critical Rain Alert)
- Odisha Cyclone: Bay of Bengal (126 km/h wind gusts, 4.6 m storm surge - Critical Cyclone Alert)
- Jaipur Heatwave: Thar Desert (46.8 deg C extreme temperatures - Critical Heatwave Alert)
- Delhi Smog: Indo-Gangetic Plain (AQI 340 severe smog baseline)

---

## Repository Structure

```
.
|-- .github/
|   `-- workflows/
|       `-- deploy.yml       # GitHub Actions workflow for automatic Pages deployment
|-- data-collection/         # Data ingestion scripts and API schema definitions
|   `-- weather-apis/
|-- prototype/               # Interactive Lakehouse and disaster dashboard
|   |-- adapters.js          # API clients, simulation drills, and verification engine
|   |-- index.html           # Main dashboard user interface
|   |-- pipeline.js          # Stream buffer and Bronze -> Silver -> Gold Lakehouse engine
|   |-- schema.js            # Data contracts and record schemas
|   `-- README.md            # Prototype component documentation
|-- Archi.png                # Architecture diagram
`-- README.md                # Main repository documentation
```

---

## Local Development

To run the prototype locally on your machine:

1. Clone the repository:
   ```bash
   git clone https://github.com/ShreeNathX/National-Weather-Big-Data-Analytics-Platform.git
   cd National-Weather-Big-Data-Analytics-Platform
   ```

2. Start a static HTTP server:
   ```bash
   # Using Python
   python -m http.server 8080

   # Or using Node.js
   npx serve .
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8080/prototype/
   ```

---

## Deployment

Continuous deployment is handled via GitHub Actions:
- Any commit pushed to the repository automatically deploys the `prototype/` application to GitHub Pages.
- Production URL: [NWBDAP — National Weather Big Data Analytics Platform](https://shreenathx.github.io/National-Weather-Big-Data-Analytics-Platform/)
