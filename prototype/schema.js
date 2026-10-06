// ============================================================
// schema.js  –  Unified data contracts for the pipeline
// Layers: Bronze (raw) → Silver (clean) → Gold (aggregated)
// ============================================================

/** Raw telemetry record produced by any weather adapter */
export function createWeatherRecord({
  source,
  status = 'connected',
  state = '',
  city = '',
  lat = null,
  lon = null,
  temp_c = null,
  humidity = null,
  wind_kmh = null,
  wind_gust_kmh = null,
  pressure_hpa = null,
  rain_mm = null,
  river_discharge_m3s = null,
  wave_height_m = null,
  aqi = null,
  pm25 = null,
  condition = '',
  alerts = [],
  error = null
}) {
  return {
    source,
    status,          // 'connected' | 'not_connected'
    location: { state, city, lat, lon },
    disaster_metrics: {
      rain_mm,
      river_discharge_m3s,
      wind_gust_kmh,
      wave_height_m,
      temp_c,
      pressure_hpa
    },
    general_metrics: { humidity, wind_kmh, aqi, pm25 },
    condition,
    alerts,
    error,
    timestamp: new Date().toISOString()
  };
}

/** Social / citizen report record */
export function createSocialReportRecord({
  id,
  source = 'Social Media (#IMD)',
  author = 'Anonymous',
  text = '',
  hashtags = [],
  category = 'Flooding',
  location = { state: '', city: '', lat: null, lon: null },
  timestamp = new Date().toISOString(),
  verification = { status: 'PENDING', confidence: 0, matchedTelemetry: null, reason: '' }
}) {
  return {
    id: id || `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source,
    author,
    text,
    hashtags,
    category,
    location,
    timestamp,
    verification
  };
}

/** Bronze record — raw ingested event with pipeline metadata */
export function createBronzeRecord(raw, sourceType) {
  return {
    _layer: 'BRONZE',
    _ingestedAt: new Date().toISOString(),
    _sourceType: sourceType, // 'WEATHER_API' | 'SOCIAL' | 'CITIZEN'
    _id: `bronze_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    raw
  };
}

/** Silver record — cleaned & normalised */
export function createSilverRecord(bronze, cleaned) {
  return {
    _layer: 'SILVER',
    _bronzeId: bronze._id,
    _processedAt: new Date().toISOString(),
    _sourceType: bronze._sourceType,
    ...cleaned
  };
}

/** Gold aggregate record — enriched, cross-verified, severity-scored */
export function createGoldRecord({ city, state, lat, lon, silverRecords, alerts, severity, enrichment }) {
  return {
    _layer: 'GOLD',
    _aggregatedAt: new Date().toISOString(),
    location: { city, state, lat, lon },
    silverRecordCount: silverRecords.length,
    alerts,
    severity,   // 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
    enrichment  // { avgRain, maxWind, maxWave, maxRiver, maxTemp, verifiedReports }
  };
}
