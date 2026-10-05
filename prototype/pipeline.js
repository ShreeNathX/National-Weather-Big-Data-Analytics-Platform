// ============================================================
// pipeline.js  –  In-process Pipeline Engine
// Stages: Ingest → Bronze → Silver (preprocess) → Enrich&Verify → Gold
// No AWS, No NLP/ML — pure rule-based, client-side
// ============================================================
import { createBronzeRecord, createSilverRecord, createGoldRecord } from './schema.js';
import { verifyReport } from './adapters.js';

// ── In-memory Stream Buffer (simulates Kafka topic partitions) ──
class StreamBuffer {
  constructor(name) {
    this.name = name;
    this._queue = [];
    this._subscribers = [];
    this._stats = { ingested: 0, processed: 0, errors: 0 };
  }

  /** Push a raw event onto the buffer */
  push(event) {
    const bronze = createBronzeRecord(event.data, event.sourceType);
    this._queue.push(bronze);
    this._stats.ingested++;
    this._notify(bronze);
    return bronze;
  }

  /** Subscribe to new events */
  subscribe(fn) { this._subscribers.push(fn); }

  /** Drain all pending records */
  drain() {
    const batch = [...this._queue];
    this._queue = [];
    return batch;
  }

  _notify(record) { this._subscribers.forEach(fn => fn(record)); }

  get stats() { return { ...this._stats, pending: this._queue.length }; }
}

// ── Preprocessing Stage: Raw → Bronze → Silver ──
export function preprocessBronze(bronzeRecord) {
  const raw = bronzeRecord.raw;

  if (bronzeRecord._sourceType === 'WEATHER_API') {
    const dm = raw.disaster_metrics || {};
    const gm = raw.general_metrics || {};
    // Normalise: clamp out-of-range values, fill nulls
    const cleaned = {
      source: raw.source,
      status: raw.status,
      location: raw.location,
      disaster_metrics: {
        rain_mm: _clamp(dm.rain_mm, 0, 500),
        river_discharge_m3s: _clamp(dm.river_discharge_m3s, 0, 50000),
        wind_gust_kmh: _clamp(dm.wind_gust_kmh, 0, 400),
        wave_height_m: _clamp(dm.wave_height_m, 0, 20),
        temp_c: _clamp(dm.temp_c, -30, 60),
        pressure_hpa: _clamp(dm.pressure_hpa, 870, 1085)
      },
      general_metrics: {
        humidity: _clamp(gm.humidity, 0, 100),
        wind_kmh: _clamp(gm.wind_kmh, 0, 400),
        aqi: _clamp(gm.aqi, 0, 500),
        pm25: _clamp(gm.pm25, 0, 1000)
      },
      condition: raw.condition || '',
      alerts: Array.isArray(raw.alerts) ? raw.alerts : [],
      timestamp: raw.timestamp
    };
    return createSilverRecord(bronzeRecord, cleaned);
  }

  if (bronzeRecord._sourceType === 'SOCIAL' || bronzeRecord._sourceType === 'CITIZEN') {
    const cleaned = {
      id: raw.id,
      source: raw.source,
      author: _sanitizeText(raw.author),
      text: _sanitizeText(raw.text),
      hashtags: (raw.hashtags || []).map(h => h.toLowerCase()),
      category: raw.category || 'Unknown',
      location: raw.location || {},
      timestamp: raw.timestamp || new Date().toISOString(),
      verification: raw.verification || { status: 'PENDING', confidence: 0, reason: '' }
    };
    return createSilverRecord(bronzeRecord, cleaned);
  }

  // Passthrough for unknown types
  return createSilverRecord(bronzeRecord, raw);
}

// ── Enrich & Verify: Silver → Gold (no NLP/ML, rule-based only) ──
export function enrichAndVerify(silverWeatherRecords, silverSocialRecords) {
  // Group telemetry by city
  const byCity = {};
  silverWeatherRecords.forEach(rec => {
    const city = rec.location?.city || 'Unknown';
    if (!byCity[city]) byCity[city] = { weather: [], social: [] };
    byCity[city].weather.push(rec);
  });
  silverSocialRecords.forEach(rec => {
    const city = rec.location?.city || 'Unknown';
    if (!byCity[city]) byCity[city] = { weather: [], social: [] };
    byCity[city].social.push(rec);
  });

  const goldRecords = [];

  Object.entries(byCity).forEach(([city, { weather, social }]) => {
    const connected = weather.filter(r => r.status === 'connected');
    const dm = connected.map(r => r.disaster_metrics || {});

    // Aggregate metrics
    const vals = key => dm.map(d => d[key]).filter(v => v != null);
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const max = arr => arr.length ? Math.max(...arr) : null;

    const avgRain = avg(vals('rain_mm'));
    const maxRain = max(vals('rain_mm'));
    const maxWind = max(vals('wind_gust_kmh'));
    const maxWave = max(vals('wave_height_m'));
    const maxRiver = max(vals('river_discharge_m3s'));
    const maxTemp = max(vals('temp_c'));
    const minPress = vals('pressure_hpa').length ? Math.min(...vals('pressure_hpa')) : null;

    // Rule-based alert generation
    const alerts = [];
    if (maxRain >= 64.5) alerts.push({ code: 'EXTREMELY_HEAVY_RAIN', level: 'CRITICAL', msg: `Rain ${maxRain.toFixed(1)} mm/h — Extremely Heavy Rain` });
    else if (maxRain >= 15.6) alerts.push({ code: 'HEAVY_RAIN', level: 'HIGH', msg: `Rain ${maxRain.toFixed(1)} mm/h — Heavy Rain` });
    if (maxRiver >= 800) alerts.push({ code: 'MAJOR_RIVER_FLOOD', level: 'CRITICAL', msg: `River discharge ${maxRiver.toFixed(0)} m³/s — Major Flood Risk` });
    else if (maxRiver >= 400) alerts.push({ code: 'MODERATE_RIVER_FLOOD', level: 'HIGH', msg: `River discharge ${maxRiver.toFixed(0)} m³/s — Moderate Flood Risk` });
    if (maxWave >= 4) alerts.push({ code: 'COASTAL_SURGE_CRITICAL', level: 'CRITICAL', msg: `Wave height ${maxWave.toFixed(1)} m — Severe Coastal Surge` });
    else if (maxWave >= 2.5) alerts.push({ code: 'COASTAL_SURGE', level: 'HIGH', msg: `Wave height ${maxWave.toFixed(1)} m — Coastal Surge Alert` });
    if (maxWind >= 90) alerts.push({ code: 'CYCLONE_WIND', level: 'CRITICAL', msg: `Wind gust ${maxWind.toFixed(0)} km/h — Cyclone-force Winds` });
    else if (maxWind >= 50) alerts.push({ code: 'STRONG_WIND', level: 'HIGH', msg: `Wind gust ${maxWind.toFixed(0)} km/h — Strong Wind Alert` });
    if (maxTemp >= 45) alerts.push({ code: 'EXTREME_HEAT', level: 'CRITICAL', msg: `Temperature ${maxTemp.toFixed(1)} °C — Extreme Heatwave` });
    else if (maxTemp >= 40) alerts.push({ code: 'HEATWAVE', level: 'HIGH', msg: `Temperature ${maxTemp.toFixed(1)} °C — Heatwave Alert` });
    if (minPress !== null && minPress < 990) alerts.push({ code: 'BAROMETRIC_DEPRESSION', level: 'HIGH', msg: `Pressure ${minPress.toFixed(0)} hPa — Depression / Cyclone Risk` });

    // Cross-verify social reports against telemetry
    const verifiedSocial = social.map(rep => ({
      ...rep,
      verification: verifyReport(rep, connected)
    }));
    const verifiedCount = verifiedSocial.filter(r => r.verification.status === 'VERIFIED').length;

    // Severity score
    const critCount = alerts.filter(a => a.level === 'CRITICAL').length;
    const highCount = alerts.filter(a => a.level === 'HIGH').length;
    let severity = 'LOW';
    if (critCount >= 1) severity = 'CRITICAL';
    else if (highCount >= 2) severity = 'HIGH';
    else if (highCount >= 1 || verifiedCount > 0) severity = 'MODERATE';

    const loc = connected[0]?.location || weather[0]?.location || { city, state: '', lat: null, lon: null };

    goldRecords.push(createGoldRecord({
      city: loc.city || city,
      state: loc.state,
      lat: loc.lat,
      lon: loc.lon,
      silverRecords: [...weather, ...social],
      alerts,
      severity,
      enrichment: {
        avgRain,
        maxRain,
        maxWind,
        maxWave,
        maxRiver,
        maxTemp,
        minPress,
        apiCount: connected.length,
        verifiedReports: verifiedCount,
        totalReports: social.length
      }
    }));
  });

  return goldRecords;
}

// ── Utility helpers ──
function _clamp(val, min, max) {
  if (val == null || isNaN(val)) return null;
  return Math.min(Math.max(val, min), max);
}
function _sanitizeText(str) {
  if (!str) return '';
  return String(str).replace(/[<>]/g, '').trim().slice(0, 1000);
}

// ── Main pipeline runner ──
export const weatherBuffer = new StreamBuffer('weather-stream');
export const socialBuffer = new StreamBuffer('social-stream');

export async function runPipeline(weatherRawRecords, socialRawRecords) {
  const log = [];
  const ts = () => new Date().toISOString();

  // Stage 1: Ingest → Bronze
  log.push({ stage: 'INGEST', at: ts(), msg: `Ingesting ${weatherRawRecords.length} weather + ${socialRawRecords.length} social records` });
  const bronzeWeather = weatherRawRecords.map(r => weatherBuffer.push({ data: r, sourceType: 'WEATHER_API' }));
  const bronzeSocial = socialRawRecords.map(r => socialBuffer.push({ data: r, sourceType: 'SOCIAL' }));

  // Stage 2: Preprocess → Silver
  log.push({ stage: 'PREPROCESS', at: ts(), msg: `Preprocessing ${bronzeWeather.length + bronzeSocial.length} bronze records` });
  const silverWeather = bronzeWeather.map(preprocessBronze);
  const silverSocial = bronzeSocial.map(preprocessBronze);

  // Stage 3: Enrich & Verify → Gold
  log.push({ stage: 'ENRICH_VERIFY', at: ts(), msg: `Enriching & verifying across ${silverWeather.length} telemetry + ${silverSocial.length} social records` });
  const goldRecords = enrichAndVerify(silverWeather, silverSocial);

  log.push({ stage: 'COMPLETE', at: ts(), msg: `Pipeline complete. ${goldRecords.length} gold records produced.` });

  return {
    bronze: { weather: bronzeWeather, social: bronzeSocial },
    silver: { weather: silverWeather, social: silverSocial },
    gold: goldRecords,
    log,
    bufferStats: {
      weather: weatherBuffer.stats,
      social: socialBuffer.stats
    }
  };
}
