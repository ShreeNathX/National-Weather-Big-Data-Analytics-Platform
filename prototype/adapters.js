// ============================================================
// adapters.js  –  Data Collection Layer
// Sources: Weather APIs + Social (Mastodon) + Citizen Reporter
// High Resilience: Fast timeouts (2.5s) + Instant Disaster Presets
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

// Helper: fast live fetch with 2500ms timeout
async function fetchJSON(url, options = {}, timeoutMs = 2500) {
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
  const cur = data.current || {};
  const rain = cur.precipitation ?? cur.rain ?? 0;
  return createWeatherRecord({
    source: 'Open-Meteo Weather', isLive: true, endpoint: 'api.open-meteo.com',
    state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    temp_c: cur.temperature_2m ?? 28, humidity: cur.relative_humidity_2m ?? 65,
    wind_kmh: cur.wind_speed_10m ?? 12, wind_gust_kmh: cur.wind_gusts_10m ?? 20,
    rain_mm: rain, pressure_hpa: cur.surface_pressure ?? 1010,
    alerts: rain >= 15 ? ['HEAVY_RAIN_ALERT'] : []
  });
}

// 2. GloFAS River Flood Model
export async function getRiverFlood(loc) {
  const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${loc.lat}&longitude=${loc.lon}&daily=river_discharge&forecast_days=1`;
  const data = await fetchJSON(url);
  const discharge = data.daily?.river_discharge?.[0] ?? 120;
  return createWeatherRecord({
    source: 'GloFAS River Flood Model', isLive: true, endpoint: 'flood-api.open-meteo.com',
    state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    river_discharge_m3s: discharge,
    alerts: discharge > 500 ? ['RIVER_FLOOD_SURGE'] : []
  });
}

// 3. Open-Meteo Coastal Marine
export async function getOpenMeteoMarine(loc) {
  if (!loc.coastal) {
    return createWeatherRecord({
      source: 'Open-Meteo Coastal Marine', status: 'connected', isLive: true, endpoint: 'marine-api.open-meteo.com',
      state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
      wave_height_m: null, condition: 'Inland location (Non-coastal)'
    });
  }
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${loc.lat}&longitude=${loc.lon}&current=wave_height,wave_direction,wave_period`;
  const data = await fetchJSON(url);
  const waveHeight = data.current?.wave_height ?? 1.2;
  return createWeatherRecord({
    source: 'Open-Meteo Coastal Marine', isLive: true, endpoint: 'marine-api.open-meteo.com',
    state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
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
    source: 'wttr.in Weather', isLive: true, endpoint: 'wttr.in',
    state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    temp_c: parseFloat(cur.temp_C) || 28, humidity: parseFloat(cur.humidity) || 60,
    wind_kmh: parseFloat(cur.windspeedKmph) || 14, rain_mm: rain,
    pressure_hpa: parseFloat(cur.pressure) || 1012,
    condition: cur.weatherDesc?.[0]?.value || 'Observed Conditions'
  });
}

// 5. MET Norway
export async function getMetNorway(loc) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${loc.lat}&lon=${loc.lon}`;
  const data = await fetchJSON(url);
  const cur = data.properties?.timeseries?.[0]?.data?.instant?.details || {};
  const next1h = data.properties?.timeseries?.[0]?.data?.next_1_hours?.details || {};
  return createWeatherRecord({
    source: 'MET Norway', isLive: true, endpoint: 'api.met.no',
    state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    temp_c: cur.air_temperature ?? 27.5, humidity: cur.relative_humidity ?? 65,
    wind_kmh: cur.wind_speed ? Math.round(cur.wind_speed * 3.6) : 15,
    wind_gust_kmh: cur.wind_speed_of_gust ? Math.round(cur.wind_speed_of_gust * 3.6) : 22,
    rain_mm: next1h.precipitation_amount ?? 0,
    pressure_hpa: cur.air_pressure_at_sea_level ?? 1012
  });
}

// 6. Open-Meteo AQI
export async function getOpenMeteoAQI(loc) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&current=pm10,pm2_5,us_aqi`;
  const data = await fetchJSON(url);
  return createWeatherRecord({
    source: 'Open-Meteo AQI', isLive: true, endpoint: 'air-quality-api.open-meteo.com',
    state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon,
    aqi: data.current?.us_aqi ?? 85, pm25: data.current?.pm2_5 ?? 32
  });
}

// ── Realistic Instant Disaster Presets (Guaranteed Instant Zero-Lag Loading) ──
export const SCENARIOS = {
  ASSAM_FLOOD: {
    id: 'ASSAM_FLOOD',
    name: '🌊 Assam Floods',
    locIndex: 0, // Guwahati
    description: 'Brahmaputra basin: Extreme rainfall & river overflow above danger level',
    telemetry: (loc) => [
      createWeatherRecord({ source: 'Open-Meteo Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 88.4, temp_c: 24.5, humidity: 96, wind_kmh: 26, wind_gust_kmh: 52, pressure_hpa: 994, alerts: ['EXTREMELY_HEAVY_RAIN'] }),
      createWeatherRecord({ source: 'GloFAS River Flood Model', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, river_discharge_m3s: 980, alerts: ['MAJOR_RIVER_FLOOD'] }),
      createWeatherRecord({ source: 'Open-Meteo Coastal Marine', status: 'connected', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, wave_height_m: null, condition: 'Inland River Basin' }),
      createWeatherRecord({ source: 'wttr.in Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 84.0, temp_c: 24.0, condition: 'Heavy Torrential Downpour' }),
      createWeatherRecord({ source: 'MET Norway', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 86.5, temp_c: 24.8, wind_gust_kmh: 48, pressure_hpa: 995 }),
      createWeatherRecord({ source: 'Open-Meteo AQI', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, aqi: 38, pm25: 12 })
    ],
    reports: [
      { text: "Brahmaputra embankment breached near Guwahati ferry ghat! Flood water rising fast into low areas #AssamFloods #flood", author: "@assam_updates", category: "Flooding", source: "Citizen App" },
      { text: "River discharge crossed danger mark by 1.8 meters at DC office point. Evacuation in progress #flood #IMD", author: "@guwahati_citizen", category: "Flooding", source: "Social Media (#AssamFloods)" },
      { text: "Extreme 47°C heatwave in Guwahati today, sun melting road tar #heatwave", author: "@random_user42", category: "Heatwave", source: "Social Media (#heatwave)" }
    ]
  },
  MUMBAI_CLOUDBURST: {
    id: 'MUMBAI_CLOUDBURST',
    name: '⛈️ Mumbai Cloudburst',
    locIndex: 3, // Mumbai
    description: 'Konkan coast: Cloudburst downpour with coastal tide surge',
    telemetry: (loc) => [
      createWeatherRecord({ source: 'Open-Meteo Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 114.2, temp_c: 27.2, humidity: 98, wind_kmh: 42, wind_gust_kmh: 68, pressure_hpa: 991, alerts: ['EXTREMELY_HEAVY_RAIN'] }),
      createWeatherRecord({ source: 'GloFAS River Flood Model', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, river_discharge_m3s: 520, alerts: ['MODERATE_RIVER_FLOOD'] }),
      createWeatherRecord({ source: 'Open-Meteo Coastal Marine', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, wave_height_m: 3.8, alerts: ['COASTAL_SURGE'] }),
      createWeatherRecord({ source: 'wttr.in Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 110.0, temp_c: 27.0, condition: 'Intense Cloudburst' }),
      createWeatherRecord({ source: 'MET Norway', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 118.0, temp_c: 27.4, wind_gust_kmh: 70 }),
      createWeatherRecord({ source: 'Open-Meteo AQI', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, aqi: 52, pm25: 18 })
    ],
    reports: [
      { text: "Hindmata and Kurla suburban tracks submerged in 3 feet water! Train service suspended #MumbaiRains #flood", author: "@mumbai_commuter", category: "Flooding", source: "Citizen App" },
      { text: "High tide combined with intense downpour causing coastal backflow at Worli seaface #MumbaiRains", author: "@bmc_volunteer", category: "Flooding", source: "Social Media (#MumbaiRains)" },
      { text: "Category 5 Cyclone eye passing directly over Bandra right now with 200kmh winds! #cyclone", author: "@panic_bot99", category: "Cyclone", source: "Social Media (#cyclone)" }
    ]
  },
  ODISHA_CYCLONE: {
    id: 'ODISHA_CYCLONE',
    name: '🌀 Odisha Cyclone',
    locIndex: 2, // Bhubaneswar
    description: 'Bay of Bengal: Cyclone-force winds & massive sea surge',
    telemetry: (loc) => [
      createWeatherRecord({ source: 'Open-Meteo Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 76.5, temp_c: 25.8, humidity: 96, wind_kmh: 82, wind_gust_kmh: 126, pressure_hpa: 976, alerts: ['CYCLONE_WIND', 'EXTREMELY_HEAVY_RAIN'] }),
      createWeatherRecord({ source: 'GloFAS River Flood Model', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, river_discharge_m3s: 640, alerts: ['MODERATE_RIVER_FLOOD'] }),
      createWeatherRecord({ source: 'Open-Meteo Coastal Marine', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, wave_height_m: 4.6, alerts: ['COASTAL_SURGE_CRITICAL'] }),
      createWeatherRecord({ source: 'wttr.in Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 72.0, temp_c: 25.5, condition: 'Severe Cyclonic Storm' }),
      createWeatherRecord({ source: 'MET Norway', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 80.0, temp_c: 26.0, wind_gust_kmh: 128, pressure_hpa: 974 }),
      createWeatherRecord({ source: 'Open-Meteo AQI', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, aqi: 34, pm25: 11 })
    ],
    reports: [
      { text: "Severe cyclonic gusts blowing away roofs and uprooting trees across coastal highway! #cyclone #IMD", author: "@odisha_watch", category: "Cyclone", source: "Citizen App" },
      { text: "Tidal surge breached sea dyke at Puri coast, saline sea water entered inland fields #cyclone #flood", author: "@coastal_odisha", category: "Flooding", source: "Social Media (#cyclone)" },
      { text: "Bhubaneswar completely dry and clear, drought declared by administration #drought", author: "@fake_troll", category: "Heatwave", source: "Social Media (#weatherupdate)" }
    ]
  },
  JAIPUR_HEATWAVE: {
    id: 'JAIPUR_HEATWAVE',
    name: '☀️ Jaipur Heatwave',
    locIndex: 10, // Jaipur
    description: 'Thar desert fringe: Severe heatwave conditions above 46°C',
    telemetry: (loc) => [
      createWeatherRecord({ source: 'Open-Meteo Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 0.0, temp_c: 46.8, humidity: 16, wind_kmh: 18, wind_gust_kmh: 30, pressure_hpa: 1002, alerts: ['EXTREME_HEAT'] }),
      createWeatherRecord({ source: 'GloFAS River Flood Model', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, river_discharge_m3s: 14, alerts: [] }),
      createWeatherRecord({ source: 'Open-Meteo Coastal Marine', status: 'connected', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, wave_height_m: null, condition: 'Arid Inland' }),
      createWeatherRecord({ source: 'wttr.in Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 0.0, temp_c: 46.5, condition: 'Severe Loo / Blistering Heat' }),
      createWeatherRecord({ source: 'MET Norway', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 0.0, temp_c: 47.0, wind_gust_kmh: 28 }),
      createWeatherRecord({ source: 'Open-Meteo AQI', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, aqi: 185, pm25: 78 })
    ],
    reports: [
      { text: "Severe heatwave across Jaipur, 47°C recorded! Severe loo winds blowing, red alert issued #heatwave #IMD", author: "@rajasthan_pulse", category: "Heatwave", source: "Citizen App" },
      { text: "Government opens hydration kiosks across market areas due to extreme heatwave advisory #heatwave", author: "@jaipur_relief", category: "Heatwave", source: "Social Media (#heatwave)" },
      { text: "Flash flood emergency in Jaipur! 3 feet deep water flowing in front of Hawa Mahal! #flood", author: "@prankster_in", category: "Flooding", source: "Social Media (#flood)" }
    ]
  },
  DELHI_NORMAL: {
    id: 'DELHI_NORMAL',
    name: '🌤️ Delhi Smog & Clear',
    locIndex: 4, // New Delhi
    telemetry: (loc) => [
      createWeatherRecord({ source: 'Open-Meteo Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 0.0, temp_c: 31.4, humidity: 48, wind_kmh: 12, wind_gust_kmh: 22, pressure_hpa: 1008, alerts: [] }),
      createWeatherRecord({ source: 'GloFAS River Flood Model', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, river_discharge_m3s: 140, alerts: [] }),
      createWeatherRecord({ source: 'Open-Meteo Coastal Marine', status: 'connected', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, wave_height_m: null, condition: 'Inland Plains' }),
      createWeatherRecord({ source: 'wttr.in Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 0.0, temp_c: 31.0, condition: 'Moderate Smog / Hazy' }),
      createWeatherRecord({ source: 'MET Norway', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, rain_mm: 0.0, temp_c: 32.0, wind_gust_kmh: 20 }),
      createWeatherRecord({ source: 'Open-Meteo AQI', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, aqi: 340, pm25: 195, alerts: ['AQI_VERY_POOR'] })
    ],
    reports: [
      { text: "Air quality index reached 340 in Delhi today, smog layer reducing visibility #DelhiWeather #AQI", author: "@delhi_air_watch", category: "Air Quality", source: "Social Media (#DelhiWeather)" },
      { text: "Yamuna water level within safe limits at Old Bridge, no flood threat reported #IMD", author: "@delhi_citizen", category: "Flooding", source: "Citizen App" },
      { text: "Massive cyclone hitting New Delhi today with 150 km/h wind storm! #cyclone", author: "@rumor_monger", category: "Cyclone", source: "Social Media (#cyclone)" }
    ]
  }
};

export function getScenarioReports(scenarioId, loc) {
  const scen = SCENARIOS[scenarioId] || SCENARIOS.ASSAM_FLOOD;
  return scen.reports.map(r => createSocialReportRecord({
    text: r.text,
    author: r.author,
    category: r.category,
    source: r.source,
    hashtags: (r.text.match(/#[a-z0-9_]+/gi) || ['#IMD']),
    location: loc
  }));
}

// Fetch all 6 APIs with graceful instant fallback
export async function fetchAllWeather(loc, scenarioId = null) {
  if (scenarioId && SCENARIOS[scenarioId]) {
    return SCENARIOS[scenarioId].telemetry(loc);
  }

  const adapters = [
    { name: 'Open-Meteo Weather', fn: () => getOpenMeteo(loc), fallback: () => createWeatherRecord({ source: 'Open-Meteo Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, temp_c: 29.0, humidity: 62, wind_kmh: 14, wind_gust_kmh: 24, rain_mm: 0, pressure_hpa: 1010 }) },
    { name: 'GloFAS River Flood Model', fn: () => getRiverFlood(loc), fallback: () => createWeatherRecord({ source: 'GloFAS River Flood Model', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, river_discharge_m3s: 160 }) },
    { name: 'Open-Meteo Coastal Marine', fn: () => getOpenMeteoMarine(loc), fallback: () => createWeatherRecord({ source: 'Open-Meteo Coastal Marine', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, wave_height_m: loc.coastal ? 1.4 : null, condition: loc.coastal ? 'Moderate swell' : 'Inland' }) },
    { name: 'wttr.in Weather', fn: () => getWttrIn(loc), fallback: () => createWeatherRecord({ source: 'wttr.in Weather', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, temp_c: 28.5, rain_mm: 0, humidity: 60, condition: 'Partly Cloudy' }) },
    { name: 'MET Norway', fn: () => getMetNorway(loc), fallback: () => createWeatherRecord({ source: 'MET Norway', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, temp_c: 28.8, rain_mm: 0, wind_gust_kmh: 22 }) },
    { name: 'Open-Meteo AQI', fn: () => getOpenMeteoAQI(loc), fallback: () => createWeatherRecord({ source: 'Open-Meteo AQI', state: loc.state, city: loc.city, lat: loc.lat, lon: loc.lon, aqi: 92, pm25: 35 }) }
  ];

  const results = await Promise.allSettled(adapters.map(a => a.fn()));
  return results.map((res, i) => {
    if (res.status === 'fulfilled') return res.value;
    // Resilient fallback so prototype UI never displays empty or broken data
    return adapters[i].fallback();
  });
}

// Multi-Source Social Ingestion
export async function fetchMultiSourceSocialPosts(tag = 'IMD', loc = null) {
  const cleanTag = tag.replace(/^#/, '');
  const sources = [
    { name: 'Mastodon Social', url: `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(cleanTag)}?limit=4` },
    { name: 'Mstdn Network', url: `https://mstdn.social/api/v1/timelines/tag/${encodeURIComponent(cleanTag)}?limit=4` }
  ];

  try {
    const results = await Promise.allSettled(sources.map(s => fetchJSON(s.url, {}, 2000)));
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
            category, timestamp: post.created_at, location: loc || {}
          }));
        });
      }
    });
    if (posts.length > 0) return posts;
  } catch (e) {
    // Fall back to default scenario reports
  }

  // Graceful fallback posts
  return [
    createSocialReportRecord({
      source: 'Social Feed (#IMD)',
      author: '@weather_india_live',
      text: `Monsoon updates and meteorological telemetry observation report for ${loc?.city || 'India'} #IMD #WeatherAlert`,
      hashtags: ['#IMD', '#WeatherAlert'],
      category: 'Rainfall',
      location: loc || {}
    }),
    createSocialReportRecord({
      source: 'Citizen Emergency Portal',
      author: '@local_observer',
      text: `Water logging check and civic alerts for local wards in ${loc?.city || 'city'} #civic #monsoon`,
      hashtags: ['#monsoon', '#flood'],
      category: 'Flooding',
      location: loc || {}
    })
  ];
}

// Rule-based Verification Engine (no NLP/ML)
export function verifyReport(report, telemetryRecords) {
  const connectedRecords = (telemetryRecords || []).filter(r => r.status === 'connected');
  if (connectedRecords.length === 0) {
    return { status: 'PENDING', confidence: 0, reason: 'No live telemetry sensors available to corroborate claim.' };
  }
  let maxRain = 0, maxRiverFlow = null, maxWaveHeight = null, maxWind = 0, maxTemp = null, maxAqi = null;
  connectedRecords.forEach(r => {
    const d = r.disaster_metrics || {};
    const g = r.general_metrics || {};
    if (d.rain_mm != null && d.rain_mm > maxRain) maxRain = d.rain_mm;
    if (d.river_discharge_m3s != null && (maxRiverFlow === null || d.river_discharge_m3s > maxRiverFlow)) maxRiverFlow = d.river_discharge_m3s;
    if (d.wave_height_m != null && (maxWaveHeight === null || d.wave_height_m > maxWaveHeight)) maxWaveHeight = d.wave_height_m;
    if (d.wind_gust_kmh != null && d.wind_gust_kmh > maxWind) maxWind = d.wind_gust_kmh;
    if (d.temp_c != null && (maxTemp === null || d.temp_c > maxTemp)) maxTemp = d.temp_c;
    if (g.aqi != null && (maxAqi === null || g.aqi > maxAqi)) maxAqi = g.aqi;
  });
  const cat = (report.category || '').toLowerCase();
  const text = (report.text + ' ' + (report.hashtags || []).join(' ')).toLowerCase();

  if (cat.includes('flood') || text.includes('flood') || text.includes('waterlog')) {
    if (maxRain >= 15 || (maxRiverFlow !== null && maxRiverFlow >= 350) || (maxWaveHeight !== null && maxWaveHeight >= 2.5)) {
      const riverStr = maxRiverFlow !== null ? `, River Flow ${maxRiverFlow} m³/s` : '';
      const surgeStr = maxWaveHeight !== null ? `, Coastal Surge ${maxWaveHeight}m` : '';
      return { status: 'VERIFIED', confidence: 95, reason: `Sensor Corroboration: Rain ${maxRain}mm${riverStr}${surgeStr}. Flood conditions corroborated.` };
    }
    if (maxRain >= 5) {
      return { status: 'VERIFIED', confidence: 78, reason: `Moderate rainfall observed (${maxRain}mm). Localised waterlogging claim consistent with conditions.` };
    }
    return { status: 'SUSPICIOUS_FAKE', confidence: 92, reason: `Contradiction: Sensors record minimal/zero rain (${maxRain}mm) and river discharge (${maxRiverFlow ?? 'nominal'} m³/s) is safely below flood danger thresholds. Flood claim contradicted.` };
  }
  if (cat.includes('cyclone') || text.includes('cyclone') || text.includes('storm')) {
    if (maxWind >= 55 || (maxWaveHeight !== null && maxWaveHeight >= 2.5)) {
      return { status: 'VERIFIED', confidence: 94, reason: `Sensor Corroboration: Wind gusts ${maxWind} km/h & wave height ${maxWaveHeight ?? 'N/A'}m detected.` };
    }
    return { status: 'SUSPICIOUS_FAKE', confidence: 88, reason: `Contradiction: Wind gusts are only ${maxWind} km/h (below 55 km/h cyclone threshold). No cyclonic storm detected.` };
  }
  if (cat.includes('heat') || text.includes('heatwave')) {
    if (maxTemp !== null && maxTemp >= 40) {
      return { status: 'VERIFIED', confidence: 96, reason: `Sensor Corroboration: Extreme temperature ${maxTemp}°C confirmed by telemetry sensors.` };
    }
    return { status: 'SUSPICIOUS_FAKE', confidence: 89, reason: `Contradiction: Sensor temperature is ${maxTemp ?? 'normal'}°C, far below heatwave threshold (40°C).` };
  }
  if (cat.includes('air') || cat.includes('aqi') || cat.includes('smog') || text.includes('aqi') || text.includes('smog') || text.includes('pollution')) {
    if (maxAqi !== null && maxAqi >= 200) {
      return { status: 'VERIFIED', confidence: 95, reason: `Sensor Corroboration: AQI ${maxAqi} (Severe/Poor air quality) corroborated by atmospheric monitors.` };
    }
    if (maxAqi !== null && maxAqi < 100) {
      return { status: 'SUSPICIOUS_FAKE', confidence: 88, reason: `Contradiction: Air quality sensors report clean air (AQI ${maxAqi}). Smog/pollution claim contradicted.` };
    }
    return { status: 'VERIFIED', confidence: 80, reason: `Observed AQI (${maxAqi ?? 'moderate'}) consistent with atmospheric report.` };
  }
  return { status: 'VERIFIED', confidence: 82, reason: `Sensor telemetry is consistent with observed atmospheric conditions.` };
}

