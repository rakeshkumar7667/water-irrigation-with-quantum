import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { Field, WaterResource, Canal, Pump, WeatherData, CropInfo, Alert } from '../src/types.js';

let dbInstance: Database | null = null;
const isVercel = process.env.VERCEL === '1';
const DB_FILE_PATH = isVercel 
  ? path.join('/tmp', 'irrigation_command.sqlite') 
  : path.join(process.cwd(), 'irrigation_command.sqlite');

export const DEFAULT_CROPS: CropInfo[] = [
  { id: 'tomato', name: 'Tomato', kc: 1.15, optimalMoistureMin: 60, optimalMoistureMax: 80, criticalStage: 'Flowering & Fruit Set', waterSensitivity: 'High' },
  { id: 'paddy', name: 'Paddy', kc: 1.25, optimalMoistureMin: 70, optimalMoistureMax: 90, criticalStage: 'Panicle Initiation', waterSensitivity: 'High' },
  { id: 'groundnut', name: 'Groundnut', kc: 0.85, optimalMoistureMin: 50, optimalMoistureMax: 70, criticalStage: 'Pegging & Pod Development', waterSensitivity: 'Medium' },
  { id: 'cotton', name: 'Cotton', kc: 0.90, optimalMoistureMin: 55, optimalMoistureMax: 75, criticalStage: 'Boll Formation', waterSensitivity: 'Medium' },
  { id: 'maize', name: 'Maize', kc: 1.05, optimalMoistureMin: 60, optimalMoistureMax: 75, criticalStage: 'Tasseling & Silking', waterSensitivity: 'Medium' },
  { id: 'chillies', name: 'Chillies', kc: 1.00, optimalMoistureMin: 55, optimalMoistureMax: 70, criticalStage: 'Fruit Development', waterSensitivity: 'High' },
];

export const DEFAULT_FIELDS: Field[] = [
  {
    id: 'F1',
    name: 'Field F1 - Tomato Plot',
    location: 'Zone A - Krishna Delta North',
    zone: 'Zone A',
    areaHectares: 2.5,
    crop: 'Tomato',
    cropGrowthStage: 'Flowering',
    cropWaterRequirementMm: 6.2,
    currentSoilMoisture: 38,
    soilType: 'Red Sandy',
    lastIrrigatedHoursAgo: 72,
    priority: 'HIGH',
    canalId: 'C1',
    pumpId: 'P1',
  },
  {
    id: 'F2',
    name: 'Field F2 - Paddy Basin',
    location: 'Zone B - Godavari Lowlands',
    zone: 'Zone B',
    areaHectares: 3.8,
    crop: 'Paddy',
    cropGrowthStage: 'Vegetative',
    cropWaterRequirementMm: 7.5,
    currentSoilMoisture: 78,
    soilType: 'Clay Loam',
    lastIrrigatedHoursAgo: 16,
    priority: 'LOW',
    canalId: 'C2',
    pumpId: 'P2',
  },
  {
    id: 'F3',
    name: 'Field F3 - Groundnut Field',
    location: 'Zone A - Rayanapadu Terraces',
    zone: 'Zone A',
    areaHectares: 2.0,
    crop: 'Groundnut',
    cropGrowthStage: 'Yield Formation',
    cropWaterRequirementMm: 4.8,
    currentSoilMoisture: 45,
    soilType: 'Red Sandy',
    lastIrrigatedHoursAgo: 60,
    priority: 'HIGH',
    canalId: 'C1',
    pumpId: 'P1',
  },
  {
    id: 'F4',
    name: 'Field F4 - Cotton Plantation',
    location: 'Zone C - Guntur Upland Reach',
    zone: 'Zone C',
    areaHectares: 3.0,
    crop: 'Cotton',
    cropGrowthStage: 'Yield Formation',
    cropWaterRequirementMm: 5.4,
    currentSoilMoisture: 52,
    soilType: 'Black Cotton',
    lastIrrigatedHoursAgo: 48,
    priority: 'MEDIUM',
    canalId: 'C3',
    pumpId: 'P2',
  },
  {
    id: 'F5',
    name: 'Field F5 - Maize Plot',
    location: 'Zone C - Tenali Command Branch',
    zone: 'Zone C',
    areaHectares: 1.8,
    crop: 'Maize',
    cropGrowthStage: 'Initial',
    cropWaterRequirementMm: 4.0,
    currentSoilMoisture: 62,
    soilType: 'Alluvial',
    lastIrrigatedHoursAgo: 36,
    priority: 'LOW',
    canalId: 'C3',
    pumpId: 'P3',
  },
  {
    id: 'F6',
    name: 'Field F6 - Chillies Reach',
    location: 'Zone B - Amaravati Agricultural Belt',
    zone: 'Zone B',
    areaHectares: 2.2,
    crop: 'Chillies',
    cropGrowthStage: 'Yield Formation',
    cropWaterRequirementMm: 5.8,
    currentSoilMoisture: 34,
    soilType: 'Clay Loam',
    lastIrrigatedHoursAgo: 80,
    priority: 'HIGH',
    canalId: 'C2',
    pumpId: 'P1',
  },
];

export const DEFAULT_WATER_RESOURCES: WaterResource[] = [
  {
    id: 'R1',
    name: 'Prakasam Barrage Primary Head',
    type: 'reservoir',
    capacityLiters: 15000,
    currentStorageLiters: 11250,
    availableIrrigationLiters: 7500,
    expectedInflowLiters: 2000,
    minRequiredStorageLiters: 3000,
    status: 'Adequate',
  },
  {
    id: 'R2',
    name: 'Sir Arthur Cotton Head Tank B',
    type: 'reservoir',
    capacityLiters: 10000,
    currentStorageLiters: 7500,
    availableIrrigationLiters: 5000,
    expectedInflowLiters: 1500,
    minRequiredStorageLiters: 2000,
    status: 'Adequate',
  },
];

export const DEFAULT_CANALS: Canal[] = [
  {
    id: 'C1',
    name: 'Krishna Main Canal 1',
    capacityLitersPerDay: 3500,
    currentFlowLitersPerDay: 2100,
    connectedFields: ['F1', 'F3'],
  },
  {
    id: 'C2',
    name: 'Godavari Eastern Canal 2',
    capacityLitersPerDay: 2500,
    currentFlowLitersPerDay: 1300,
    connectedFields: ['F2', 'F6'],
  },
  {
    id: 'C3',
    name: 'Rayanapadu Distributary 3',
    capacityLitersPerDay: 1500,
    currentFlowLitersPerDay: 900,
    connectedFields: ['F4', 'F5'],
  },
];

export const DEFAULT_PUMPS: Pump[] = [
  { id: 'P1', name: 'Solar Submersible Pump #1', capacityLitersPerHour: 850, energySource: 'Solar', operatingCostPerHour: 12, status: 'Operational' },
  { id: 'P2', name: 'High-Head Grid Pump #2', capacityLitersPerHour: 1300, energySource: 'Grid Electric', operatingCostPerHour: 32, status: 'Operational' },
  { id: 'P3', name: 'Auxiliary Diesel Pump #3', capacityLitersPerHour: 1000, energySource: 'Diesel Backup', operatingCostPerHour: 48, status: 'Standby' },
];

export const DEFAULT_WEATHER: Record<string, WeatherData> = {
  F1: { fieldId: 'F1', temperatureC: 34, humidityPercent: 55, currentRainfallMm: 0, expectedRainfallMm: 2, rainProbabilityPercent: 10, et0Mm: 5.6, windSpeedKmh: 12, forecastSummary: 'Clear sky, high thermal radiation' },
  F2: { fieldId: 'F2', temperatureC: 29, humidityPercent: 82, currentRainfallMm: 14, expectedRainfallMm: 28, rainProbabilityPercent: 65, et0Mm: 3.2, windSpeedKmh: 18, forecastSummary: 'Convective thunderstorm incoming' },
  F3: { fieldId: 'F3', temperatureC: 33, humidityPercent: 58, currentRainfallMm: 0, expectedRainfallMm: 3, rainProbabilityPercent: 15, et0Mm: 5.2, windSpeedKmh: 10, forecastSummary: 'Warm breeze, dry topsoil' },
  F4: { fieldId: 'F4', temperatureC: 31, humidityPercent: 64, currentRainfallMm: 0, expectedRainfallMm: 8, rainProbabilityPercent: 30, et0Mm: 4.8, windSpeedKmh: 14, forecastSummary: 'Partly cloudy, moderate evaporation' },
  F5: { fieldId: 'F5', temperatureC: 30, humidityPercent: 68, currentRainfallMm: 2, expectedRainfallMm: 12, rainProbabilityPercent: 45, et0Mm: 4.1, windSpeedKmh: 15, forecastSummary: 'Scattered drizzle expected' },
  F6: { fieldId: 'F6', temperatureC: 35, humidityPercent: 50, currentRainfallMm: 0, expectedRainfallMm: 1, rainProbabilityPercent: 8, et0Mm: 5.9, windSpeedKmh: 11, forecastSummary: 'Intense heat, elevated crop transpiration' },
};

export const DEFAULT_ALERTS: Alert[] = [
  {
    id: 'alt-1',
    severity: 'WARNING',
    title: 'Critically Low Soil Moisture in F1 & F6',
    message: 'Tomato (38%) and Chillies (34%) soil moisture levels have breached the 40% safety threshold during sensitive flowering stages.',
    source: 'Soil Moisture Telemetry',
    timestamp: '10 mins ago',
    acknowledged: false,
    actionRequired: 'Prioritize for immediate morning allocation in QUBO optimization.',
  },
  {
    id: 'alt-2',
    severity: 'INFO',
    title: 'Expected Rainfall Over Zone B Lowlands',
    message: 'Rain radar indicates 28mm incoming precipitation with 65% probability over Field F2 (Paddy).',
    source: 'Agro-Meteorological Radar',
    timestamp: '25 mins ago',
    acknowledged: false,
    actionRequired: 'Optimizer recommends delaying irrigation to save ~700L reservoir water.',
  },
  {
    id: 'alt-3',
    severity: 'INFO',
    title: 'Canal C3 Operating Near 60% Capacity',
    message: 'Rayanapadu Distributary current flow is 900 L/day (Max 1,500 L/day). Plenty of hydraulic headroom available.',
    source: 'Canal Flow Gauging Station',
    timestamp: '1 hour ago',
    acknowledged: true,
  },
];

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      dbInstance = new SQL.Database(fileBuffer);
      return dbInstance;
    } catch {
      console.warn('Failed to load existing SQLite file, recreating clean DB');
    }
  }

  dbInstance = new SQL.Database();
  initTables(dbInstance);
  seedInitialData(dbInstance);
  saveDb(dbInstance);

  return dbInstance;
}

export function saveDb(db: Database) {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error('Failed to save SQLite to disk:', err);
  }
}

function initTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS fields (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      zone TEXT NOT NULL,
      areaHectares REAL NOT NULL,
      crop TEXT NOT NULL,
      cropGrowthStage TEXT NOT NULL,
      cropWaterRequirementMm REAL NOT NULL,
      currentSoilMoisture REAL NOT NULL,
      soilType TEXT NOT NULL,
      lastIrrigatedHoursAgo INTEGER NOT NULL,
      priority TEXT NOT NULL,
      canalId TEXT NOT NULL,
      pumpId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS water_resources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      capacityLiters REAL NOT NULL,
      currentStorageLiters REAL NOT NULL,
      availableIrrigationLiters REAL NOT NULL,
      expectedInflowLiters REAL NOT NULL,
      minRequiredStorageLiters REAL NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS canals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacityLitersPerDay REAL NOT NULL,
      currentFlowLitersPerDay REAL NOT NULL,
      connectedFields TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pumps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacityLitersPerHour REAL NOT NULL,
      energySource TEXT NOT NULL,
      operatingCostPerHour REAL NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weather_data (
      fieldId TEXT PRIMARY KEY,
      temperatureC REAL NOT NULL,
      humidityPercent REAL NOT NULL,
      currentRainfallMm REAL NOT NULL,
      expectedRainfallMm REAL NOT NULL,
      rainProbabilityPercent REAL NOT NULL,
      et0Mm REAL NOT NULL,
      windSpeedKmh REAL NOT NULL,
      forecastSummary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      acknowledged INTEGER NOT NULL,
      actionRequired TEXT
    );

    CREATE TABLE IF NOT EXISTS optimization_runs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      resultJson TEXT NOT NULL
    );
  `);
}

function seedInitialData(db: Database) {
  // Insert fields
  for (const f of DEFAULT_FIELDS) {
    db.run(
      `INSERT OR REPLACE INTO fields VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [f.id, f.name, f.location, f.zone, f.areaHectares, f.crop, f.cropGrowthStage, f.cropWaterRequirementMm, f.currentSoilMoisture, f.soilType, f.lastIrrigatedHoursAgo, f.priority, f.canalId, f.pumpId]
    );
  }

  // Insert water resources
  for (const r of DEFAULT_WATER_RESOURCES) {
    db.run(
      `INSERT OR REPLACE INTO water_resources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.name, r.type, r.capacityLiters, r.currentStorageLiters, r.availableIrrigationLiters, r.expectedInflowLiters, r.minRequiredStorageLiters, r.status]
    );
  }

  // Insert canals
  for (const c of DEFAULT_CANALS) {
    db.run(
      `INSERT OR REPLACE INTO canals VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.name, c.capacityLitersPerDay, c.currentFlowLitersPerDay, JSON.stringify(c.connectedFields)]
    );
  }

  // Insert pumps
  for (const p of DEFAULT_PUMPS) {
    db.run(
      `INSERT OR REPLACE INTO pumps VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.capacityLitersPerHour, p.energySource, p.operatingCostPerHour, p.status]
    );
  }

  // Insert weather
  for (const fieldId of Object.keys(DEFAULT_WEATHER)) {
    const w = DEFAULT_WEATHER[fieldId];
    db.run(
      `INSERT OR REPLACE INTO weather_data VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [w.fieldId, w.temperatureC, w.humidityPercent, w.currentRainfallMm, w.expectedRainfallMm, w.rainProbabilityPercent, w.et0Mm, w.windSpeedKmh, w.forecastSummary]
    );
  }

  // Insert alerts
  for (const a of DEFAULT_ALERTS) {
    db.run(
      `INSERT OR REPLACE INTO alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.severity, a.title, a.message, a.source, a.timestamp, a.acknowledged ? 1 : 0, a.actionRequired || '']
    );
  }
}

export function resetToDefaults(db: Database) {
  db.run(`DELETE FROM fields`);
  db.run(`DELETE FROM water_resources`);
  db.run(`DELETE FROM canals`);
  db.run(`DELETE FROM pumps`);
  db.run(`DELETE FROM weather_data`);
  db.run(`DELETE FROM alerts`);
  seedInitialData(db);
  saveDb(db);
}
