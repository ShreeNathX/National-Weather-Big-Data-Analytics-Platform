// Common schema for weather telemetry and social/citizen disaster verification
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
    status, // 'connected' | 'not_connected'
    location: { state, city, lat, lon },
    disaster_metrics: {
      rain_mm,                  // Flood indicator
      river_discharge_m3s,      // GloFAS River discharge (m3/s)
      wind_gust_kmh,            // Cyclone gust (km/h)
      wave_height_m,            // Coastal flood & storm surge wave height (m)
      temp_c,                   // Heatwave (C)
      pressure_hpa              // Barometric depression (hPa)
    },
    general_metrics: { humidity, wind_kmh, aqi, pm25 },
    condition,
    alerts,
    error,
    timestamp: new Date().toISOString()
  };
}

// Social media (#IMD, #Flood) and citizen report schema
export function createSocialReportRecord({
  id,
  source = 'Social Media (#IMD)',
  author = 'Anonymous',
  text = '',
  hashtags = [],
  category = 'Flooding',
  location = { state: '', city: '', lat: null, lon: null },
  timestamp = new Date().toISOString(),
  verification = {
    status: 'PENDING',
    confidence: 0,
    matchedTelemetry: null,
    reason: ''
  }
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
