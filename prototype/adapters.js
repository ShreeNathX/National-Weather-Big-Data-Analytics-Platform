// ============================================================
// adapters.js  –  Data Collection Layer
// Sources: Weather APIs + Social (Mastodon) + Citizen Reporter
// ============================================================
import { createWeatherRecord, createSocialReportRecord } from './schema.js';

// Indian Locations (state, city, lat, lon, isCoastal)
export const INDIA_STATES = [
  { state: 'Assam (Brahmaputra Basin)', city: 'Guwahati', lat: 26.1445, lon: 91.7362, coastal: false },
  { state: 'Bihar (Kosi/Ganga Basin)', city: 'Patna', lat: 25.5941, lon: 85.1376, coastal: false },
  { state: 'Odisha (Mahanadi / Cyclone)', city: 'Bhubaneswar', lat: 20.2961, lon: 85.8245, coastal: true },
  { state: 'Maharashtra (Konkan / Urban Flood)', city: 'Mumbai', lat: 19.0760, lon: 72.8777, coastal: true },
  { state: 'Delhi (Yamuna Basin / Smog)', city: 'New Delhi', lat: 28.6139, lon: 77.2090, coastal: false },
  { state: 'Kerala (Monsoon Flood)', city: 'Kochi', lat: 9.9312, lon: 76.2673, coastal: true },
  { state: 'West Bengal (Ganga Delta / Cyclone)', city: 'Kolkata', lat: 22.5726, lon: 88.3639, coastal: true },
  { state: 'Tamil Nadu (Coromandel Coast)', city: 'Chennai', lat: 13.0827, lon: 80.2707, coastal: true },
  { state: 'Gujarat (Saurashtra / Cyclone)', city: 'Ahmedabad', lat: 23.0225, lon: 72.5714, coastal: true },
  { state: 'Uttar Pradesh (Ganga Basin)', city: 'Lucknow', lat: 26.8467, lon: 80.9462, coastal: false },
  { state: 'Rajasthan (Thar Heatwave Zone)', city: 'Jaipur', lat: 26.9124, lon: 75.7873, coastal: false },
  { state: 'Uttarakhand (Flash Flood / Hills)', city: 'Dehradun', lat: 30.3165, lon: 78.0322, coastal: false }
];

// India Weather & Disaster Hashtags
export const WEATHER_TAGS = [
  'IMD', 'MumbaiRains', 'monsoon', 'flood', 'cyclone',
  'cloudburst', 'heatwave', 'DelhiWeather', 'weatherupdate',
  'ChennaiRains', 'AssamFloods', 'Thunderstorm'
];

// Helper: strict live fetch (no cache)
async function fetchJSON(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, cache: 'no-store', credentials: 'omit', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 1. Open-Meteo Weather
export async function getOpenMeteo(loc) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_gusts_10m,precipitation,rain`;
  const data = await fetchJSON(url);
  const cur = data.current;
  const rain = cur.precipitation ?? cur.rain ?? 0;
  return createWeatherRecord({
    source: 'Open-Meteo Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    temp_c: cur.temperature_2m, humidity: cur.relative_humidity_2m,
    wind_kmh: cur.wind_speed_10m, wind_gust_kmh: cur.wind_gusts_10m,
    rain_mm: rain, pressure_hpa: cur.surface_pressure,
    alerts: rain >= 15 ? ['HEAVY_RAIN_ALERT'] : []
  });
}

// 2. GloFAS River Flood Model
export async function getRiverFlood(loc) {
  const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${loc.lat}&longitude=${loc.lon}&daily=river_discharge&forecast_days=1`;
  const data = await fetchJSON(url);
  const discharge = data.daily?.river_discharge?.[0] ?? null;
  return createWeatherRecord({
    source: 'GloFAS River Flood Model', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    river_discharge_m3s: discharge,
    alerts: discharge > 500 ? ['RIVER_FLOOD_SURGE'] : []
  });
}

// 3. Open-Meteo Coastal Marine
export async function getOpenMeteoMarine(loc) {
  if (!loc.coastal) {
    return createWeatherRecord({
      source: 'Open-Meteo Coastal Marine', status: 'connected',
      state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
      wave_height_m: null, condition: 'Inland location (Non-coastal)'
    });
  }
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${loc.lat}&longitude=${loc.lon}&current=wave_height,wave_direction,wave_period`;
  const data = await fetchJSON(url);
  const waveHeight = data.current?.wave_height ?? null;
  return createWeatherRecord({
    source: 'Open-Meteo Coastal Marine', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    wave_height_m: waveHeight,
    alerts: waveHeight >= 2.5 ? ['HIGH_SURF_COASTAL_SURGE'] : []
  });
}

// 4. wttr.in Weather
export async function getWttrIn(loc) {
  const url = `https://wttr.in/${encodeURIComponent(loc.city)}?format=j1`;
  const data = await fetchJSON(url);
  const cur = data.current_condition?.[0] || {};
  const rain = parseFloat(cur.precipMM) || 0;
  return createWeatherRecord({
    source: 'wttr.in Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    temp_c: parseFloat(cur.temp_C) || null, humidity: parseFloat(cur.humidity) || null,
    wind_kmh: parseFloat(cur.windspeedKmph) || null, rain_mm: rain,
    pressure_hpa: parseFloat(cur.pressure) || null,
    condition: cur.weatherDesc?.[0]?.value || ''
  });
}

// 5. MET Norway
export async function getMetNorway(loc) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${loc.lat}&lon=${loc.lon}`;
  const data = await fetchJSON(url);
  const cur = data.properties?.timeseries?.[0]?.data?.instant?.details || {};
  const next1h = data.properties?.timeseries?.[0]?.data?.next_1_hours?.details || {};
  return createWeatherRecord({
    source: 'MET Norway', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    temp_c: cur.air_temperature ?? null, humidity: cur.relative_humidity ?? null,
    wind_kmh: cur.wind_speed ? Math.round(cur.wind_speed * 3.6) : null,
    wind_gust_kmh: cur.wind_speed_of_gust ? Math.round(cur.wind_speed_of_gust * 3.6) : null,
    rain_mm: next1h.precipitation_amount ?? 0,
    pressure_hpa: cur.air_pressure_at_sea_level ?? null
  });
}

// 6. Open-Meteo AQI
export async function getOpenMeteoAQI(loc) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&current=pm10,pm2_5,us_aqi`;
  const data = await fetchJSON(url);
  return createWeatherRecord({
    source: 'Open-Meteo AQI', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    aqi: data.current?.us_aqi ?? null, pm25: data.current?.pm2_5 ?? null
  });
}

// Fetch all 6 APIs with fault isolation
export async function fetchAllWeather(loc) {
  const adapters = [
    { name: 'Open-Meteo Weather', fn: () => getOpenMeteo(loc) },
    { name: 'GloFAS River Flood Model', fn: () => getRiverFlood(loc) },
    { name: 'Open-Meteo Coastal Marine', fn: () => getOpenMeteoMarine(loc) },
    { name: 'wttr.in Weather', fn: () => getWttrIn(loc) },
    { name: 'MET Norway', fn: () => getMetNorway(loc) },
    { name: 'Open-Meteo AQI', fn: () => getOpenMeteoAQI(loc) }
  ];
  const results = await Promise.allSettled(adapters.map(a => a.fn()));
  return results.map((res, i) => {
    if (res.status === 'fulfilled') return res.value;
    return createWeatherRecord({
      source: adapters[i].name, status: 'not_connected',
      state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
      error: res.reason?.message || 'Connection failed'
    });
  });
}

// Multi-Source Social Ingestion (Mastodon public API)
export async function fetchMultiSourceSocialPosts(tag = 'IMD') {
  const cleanTag = tag.replace(/^#/, '');
  const sources = [
    { name: 'Mastodon Social', url: `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(cleanTag)}?limit=6` },
    { name: 'Mstdn Network', url: `https://mstdn.social/api/v1/timelines/tag/${encodeURIComponent(cleanTag)}?limit=6` }
  ];
  const results = await Promise.allSettled(sources.map(s => fetchJSON(s.url)));
  const posts = [];
  results.forEach((res, i) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      res.value.forEach(post => {
        const cleanText = (post.content || '').replace(/<[^>]+>/g, '').trim();
        const lower = cleanText.toLowerCase();
        let category = 'Rainfall';
        if (lower.includes('flood') || lower.includes('waterlog')) category = 'Flooding';
        else if (lower.includes('cyclone') || lower.includes('storm')) category = 'Cyclone';
        else if (lower.includes('heat') || lower.includes('garmi')) category = 'Heatwave';
        posts.push(createSocialReportRecord({
          id: post.id, source: `${sources[i].name} (#${cleanTag})`,
          author: post.account?.acct || 'citizen',
          text: cleanText, hashtags: (post.tags || []).map(t => `#${t.name}`),
          category, timestamp: post.created_at
        }));
      });
    }
  });
  return posts;
}

// Rule-based Verification Engine (no NLP/ML)
export function verifyReport(report, telemetryRecords) {
  const connectedRecords = telemetryRecords.filter(r => r.status === 'connected');
  if (connectedRecords.length === 0) {
    return { status: 'PENDING', confidence: 0, reason: 'No live telemetry APIs connected to verify claim.' };
  }
  let maxRain = 0, maxRiverFlow = null, maxWaveHeight = null, maxWind = 0, maxTemp = null;
  connectedRecords.forEach(r => {
    const d = r.disaster_metrics || {};
    if (d.rain_mm != null && d.rain_mm > maxRain) maxRain = d.rain_mm;
    if (d.river_discharge_m3s != null && (maxRiverFlow === null || d.river_discharge_m3s > maxRiverFlow)) maxRiverFlow = d.river_discharge_m3s;
    if (d.wave_height_m != null && (maxWaveHeight === null || d.wave_height_m > maxWaveHeight)) maxWaveHeight = d.wave_height_m;
    if (d.wind_gust_kmh != null && d.wind_gust_kmh > maxWind) maxWind = d.wind_gust_kmh;
    if (d.temp_c != null && (maxTemp === null || d.temp_c > maxTemp)) maxTemp = d.temp_c;
  });
  const cat = (report.category || '').toLowerCase();
  const text = (report.text + ' ' + (report.hashtags || []).join(' ')).toLowerCase();

  if (cat.includes('flood') || text.includes('flood') || text.includes('waterlog')) {
    if (maxRain >= 10 || (maxRiverFlow !== null && maxRiverFlow >= 200) || (maxWaveHeight !== null && maxWaveHeight >= 2.5)) {
      return { status: 'VERIFIED', confidence: 94, reason: `Corroborated: Rain ${maxRain} mm, River ${maxRiverFlow ?? 'N/A'} m³/s, Wave ${maxWaveHeight ?? 'N/A'} m.` };
    }
    if (maxRain === 0 && (maxRiverFlow === null || maxRiverFlow < 30)) {
      return { status: 'SUSPICIOUS_FAKE', confidence: 91, reason: `Contradiction: Live APIs report 0.0 mm rain & normal discharge at ${report.location?.city || 'location'}.` };
    }
    return { status: 'VERIFIED', confidence: 76, reason: `Moderate rain detected (${maxRain} mm). Conditions plausible.` };
  }
  if (cat.includes('cyclone') || text.includes('cyclone') || text.includes('storm')) {
    if (maxWind >= 50 || (maxWaveHeight !== null && maxWaveHeight >= 2.5)) {
      return { status: 'VERIFIED', confidence: 92, reason: `Wind gusts ${maxWind} km/h and wave surge ${maxWaveHeight ?? 'N/A'} m recorded.` };
    }
    return { status: 'SUSPICIOUS_FAKE', confidence: 85, reason: `Wind gust only ${maxWind} km/h. No cyclonic conditions detected.` };
  }
  if (cat.includes('heat') || text.includes('heatwave')) {
    if (maxTemp !== null && maxTemp >= 40) {
      return { status: 'VERIFIED', confidence: 95, reason: `Extreme heat telemetry confirmed: ${maxTemp} °C.` };
    }
    return { status: 'SUSPICIOUS_FAKE', confidence: 88, reason: `Temperature is ${maxTemp ?? 'normal'} °C, below heatwave threshold.` };
  }
  return { status: 'VERIFIED', confidence: 80, reason: `Telemetry consistent with observed conditions.` };
}
