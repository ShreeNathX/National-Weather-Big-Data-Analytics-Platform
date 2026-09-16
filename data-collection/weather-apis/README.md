# 🇮🇳 National Weather Big Data Analytics & Disaster Verification Platform

A scalable, fault-tolerant real-time data collection and disaster verification layer designed for India under the **Smart India Hackathon (SIH)** framework.

This platform automatically ingests live meteorological telemetry (satellite rainfall, river flow models, coastal surge, air quality) and cross-verifies citizen reports and social media posts tagged with **#IMD**, **#Flood**, **#MumbaiRains**, and other disaster hashtags to detect fake, misleading, or outdated weather reports in real time.

---

## 🏗️ Architecture Overview

```
 [ LIVE METEOROLOGICAL TELEMETRY ]           [ MULTI-SOURCE SOCIAL & CITIZEN FEEDS ]
  • Open-Meteo Weather (Rain, Gusts, Baro)     • Federated Social Nodes (Mastodon, Mstdn)
  • GloFAS River Flood Model (Discharge m³/s)   • Citizen Emergency Reporter Pipeline
  • Open-Meteo Coastal Marine (Wave Surge m)   • Real-Time Hashtags (#IMD, #MumbaiRains)
  • wttr.in (City Observations)                            │
  • MET Norway (Meteorological Institute)                   │
  • Open-Meteo AQI (PM2.5, PM10, US AQI)                   │
                │                                           │
                ▼                                           ▼
      [ Fault-Tolerant Ingestion Layer (Promise.allSettled + cache: 'no-store') ]
                                        │
                                        ▼
                     [ AUTOMATED VERIFICATION ENGINE ]
         Cross-checks citizen/social claims against physical ground telemetry:
          • Claim: "Severe flash flood in Jaipur #IMD #Flood"
          • Live Telemetry: Jaipur Rain = 0.0 mm, River Discharge = Normal
          • Verdict: 🔴 SUSPICIOUS / FAKE REPORT (91% Confidence)
                                        │
                                        ▼
                   [ UNIFIED WEB DASHBOARD & ANALYTICS UI ]
         • Real-time disaster matrix across all 6 connected APIs
         • Live social feed with automated verification badges
         • State-wise disaster monitoring for all Indian river basins
```

---

## 🌐 100% Free Live Telemetry APIs (Zero API Keys Required)

Every telemetry feed is completely free, publicly accessible, and requires no API key or paid subscription:

| # | Telemetry Source | Endpoint / Provider | Disaster Focus | Telemetry Metrics |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Open-Meteo Weather** | `api.open-meteo.com` | Flash Floods & Storms | Precipitation (`mm`), Rain (`mm`), Wind Gusts (`km/h`), Pressure (`hPa`), Temp (`°C`) |
| **2** | **GloFAS River Flood Model** | `flood-api.open-meteo.com` | River Inundation | River Discharge (`m³/s`) for Indian river basins (Ganga, Brahmaputra, Kosi, Yamuna) |
| **3** | **Open-Meteo Coastal Marine** | `marine-api.open-meteo.com` | Cyclones & Coastal Floods | Coastal Wave Height (`m`), Wave Period (`s`) for Indian coastlines |
| **4** | **wttr.in Weather** | `wttr.in/{city}?format=j1` | Observed Local Weather | Precipitation (`mm`), Relative Humidity (`%`), Pressure (`hPa`), Sky Conditions |
| **5** | **MET Norway** | `api.met.no` | Independent Cross-Check | European Meteorological Institute model (`air_temperature`, `precipitation_amount`) |
| **6** | **Open-Meteo AQI** | `air-quality-api.open-meteo.com` | Smog & Air Emergencies | US AQI, PM2.5 (`µg/m³`), PM10 (`µg/m³`) |

> **Note on Fault Isolation**: All API calls use `Promise.allSettled()` with strict timeout controllers and `cache: 'no-store'`. If any network drops, only that source marks `NOT CONNECTED`, while all other feeds continue operating simultaneously without freezing.

---

## 🛰️ Multi-Source Social & Citizen Data Collection

The platform monitors real-time weather posts and citizen alerts across:
1. **Public Social Networks**: Multi-node federated query (`mastodon.social`, `mstdn.social`) streaming posts with Indian weather hashtags.
2. **Indian Weather Hashtags Monitored**:
   - `#IMD` — Official Indian Meteorological Department forecasts & alerts
   - `#MumbaiRains` — High-frequency urban monsoon inundation
   - `#DelhiWeather` — Extreme temperature and smog alerts
   - `#ChennaiRains` — Coromandel storm events
   - `#AssamFloods` — Brahmaputra river overflow updates
   - `#flood`, `#cyclone`, `#cloudburst`, `#heatwave`, `#weatherupdate`, `#Thunderstorm`
3. **Citizen Emergency Reporter**: Directly ingests citizen reports with location, timestamp, and incident description into the verification pipeline.

---

## 🔍 How the Verification Engine Works (Currently Implemented)

The verification algorithm (`verifyReport` in `adapters.js`) compares the semantic claim of any incoming post or citizen submission against simultaneous ground-truth sensor telemetry:

### 1. Flood & Waterlogging Verification (`#Flood`, `#Waterlogging`)
- **Telemetry Inspected**: `rain_mm` across Open-Meteo, wttr.in, and MET Norway, plus `river_discharge_m3s` from GloFAS, and `wave_height_m` from coastal marine telemetry.
- **Verified (`🟢 VERIFIED REPORT`, 94% confidence)**: If live rainfall $\ge 10\text{ mm}$ or river discharge $\ge 200\text{ m}^3/\text{s}$ or wave surge $\ge 2.5\text{ m}$.
- **Contradicted (`🔴 SUSPICIOUS / FAKE REPORT`, 91% confidence)**: If all live APIs report $0.0\text{ mm}$ rainfall and normal river discharge at that specific Indian city.

### 2. Cyclone & High Wind Verification (`#Cyclone`, `#Storm`)
- **Telemetry Inspected**: `wind_gust_kmh` and atmospheric pressure drop.
- **Verified (`🟢 VERIFIED REPORT`, 92% confidence)**: If live wind gusts $\ge 50\text{ km/h}$.
- **Contradicted (`🔴 SUSPICIOUS / FAKE REPORT`, 85% confidence)**: If recorded wind speed is normal calm breeze ($< 25\text{ km/h}$).

### 3. Heatwave Verification (`#Heatwave`)
- **Telemetry Inspected**: `temp_c` from station and satellite feeds.
- **Verified (`🟢 VERIFIED REPORT`, 95% confidence)**: If temperature $\ge 40^\circ\text{C}$.
- **Contradicted (`🔴 SUSPICIOUS / FAKE REPORT`, 88% confidence)**: If temperature is below threshold.

---

## 📁 Repository Structure

```text
data-collection/weather-apis/
├── .env          # Server port configuration (PORT=3000)
├── schema.js     # Standardized schema for telemetry, disaster metrics, and social verification
├── adapters.js   # 6 Live APIs + Multi-network social fetchers + Verification Engine
├── index.html    # All-in-one responsive web dashboard & analytics matrix
└── README.md     # System documentation and architecture guide
```

---

## 🚀 How to Run & Verify

1. Start a lightweight HTTP server in `data-collection/weather-apis`:
   ```powershell
   python -m http.server 3000
   # Or using npx:
   npx serve .
   ```
2. Open your browser to:
   ```text
   http://localhost:3000
   ```
3. **What to test**:
   - **Select an Indian River Basin / State** (e.g., *Assam (Brahmaputra Basin)*, *Bihar (Kosi/Ganga Basin)*, *Maharashtra (Mumbai)*, *Odisha*).
   - Observe that **all 6 telemetry cards display `CONNECTED`** with live values.
   - Click different **hashtag pills** (`#IMD`, `#MumbaiRains`, `#flood`) to stream live posts.
   - Type any custom claim in the tester box (e.g., *"Huge flash flood submerged city #IMD #Flood in Jaipur"*) and click **"Verify Report Against Live Telemetry"** to watch the automated verification engine flag contradictions in real time.
