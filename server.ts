import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getDb,
  saveDb,
  resetToDefaults,
  DEFAULT_FIELDS,
  DEFAULT_WATER_RESOURCES,
  DEFAULT_CANALS,
  DEFAULT_PUMPS,
  DEFAULT_WEATHER,
  DEFAULT_ALERTS,
} from './server/db.js';
import { runQuantumOptimization, OptimizationOptions } from './server/quantumOptimizer.js';
import { estimateWaterDemand } from './server/demandEstimator.js';
import { Field, WaterResource, Canal, Pump, WeatherData, Alert, OptimizationResult } from './src/types.js';

let latestOptimizationResult: OptimizationResult | null = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize SQLite database
  const db = await getDb();

  // Precompute initial optimization run so dashboard is instantly hydrated
  try {
    const fieldsRes = fetchFieldsFromDb();
    const resourcesRes = fetchWaterResourcesFromDb();
    const canalsRes = fetchCanalsFromDb();
    const pumpsRes = fetchPumpsFromDb();
    const weatherRes = fetchWeatherFromDb();
    latestOptimizationResult = runQuantumOptimization(
      fieldsRes,
      resourcesRes,
      canalsRes,
      pumpsRes,
      weatherRes
    );
  } catch (err) {
    console.error('Initial optimization run error:', err);
  }

  // Helper functions to query SQLite
  function fetchFieldsFromDb(): Field[] {
    try {
      const stmt = db.prepare('SELECT * FROM fields');
      const results: Field[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: row.id as string,
          name: row.name as string,
          location: row.location as string,
          zone: row.zone as string,
          areaHectares: Number(row.areaHectares),
          crop: row.crop as string,
          cropGrowthStage: row.cropGrowthStage as any,
          cropWaterRequirementMm: Number(row.cropWaterRequirementMm),
          currentSoilMoisture: Number(row.currentSoilMoisture),
          soilType: row.soilType as any,
          lastIrrigatedHoursAgo: Number(row.lastIrrigatedHoursAgo),
          priority: row.priority as any,
          canalId: row.canalId as string,
          pumpId: row.pumpId as string,
        });
      }
      stmt.free();
      return results.length > 0 ? results : DEFAULT_FIELDS;
    } catch {
      return DEFAULT_FIELDS;
    }
  }

  function fetchWaterResourcesFromDb(): WaterResource[] {
    try {
      const stmt = db.prepare('SELECT * FROM water_resources');
      const results: WaterResource[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: row.id as string,
          name: row.name as string,
          type: row.type as any,
          capacityLiters: Number(row.capacityLiters),
          currentStorageLiters: Number(row.currentStorageLiters),
          availableIrrigationLiters: Number(row.availableIrrigationLiters),
          expectedInflowLiters: Number(row.expectedInflowLiters),
          minRequiredStorageLiters: Number(row.minRequiredStorageLiters),
          status: row.status as any,
        });
      }
      stmt.free();
      return results.length > 0 ? results : DEFAULT_WATER_RESOURCES;
    } catch {
      return DEFAULT_WATER_RESOURCES;
    }
  }

  function fetchCanalsFromDb(): Canal[] {
    try {
      const stmt = db.prepare('SELECT * FROM canals');
      const results: Canal[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        let connected: string[] = [];
        try {
          connected = JSON.parse(row.connectedFields as string);
        } catch {
          connected = [];
        }
        results.push({
          id: row.id as string,
          name: row.name as string,
          capacityLitersPerDay: Number(row.capacityLitersPerDay),
          currentFlowLitersPerDay: Number(row.currentFlowLitersPerDay),
          connectedFields: connected,
        });
      }
      stmt.free();
      return results.length > 0 ? results : DEFAULT_CANALS;
    } catch {
      return DEFAULT_CANALS;
    }
  }

  function fetchPumpsFromDb(): Pump[] {
    try {
      const stmt = db.prepare('SELECT * FROM pumps');
      const results: Pump[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: row.id as string,
          name: row.name as string,
          capacityLitersPerHour: Number(row.capacityLitersPerHour),
          energySource: row.energySource as any,
          operatingCostPerHour: Number(row.operatingCostPerHour),
          status: row.status as any,
        });
      }
      stmt.free();
      return results.length > 0 ? results : DEFAULT_PUMPS;
    } catch {
      return DEFAULT_PUMPS;
    }
  }

  function fetchWeatherFromDb(): Record<string, WeatherData> {
    try {
      const stmt = db.prepare('SELECT * FROM weather_data');
      const map: Record<string, WeatherData> = {};
      while (stmt.step()) {
        const row = stmt.getAsObject();
        map[row.fieldId as string] = {
          fieldId: row.fieldId as string,
          temperatureC: Number(row.temperatureC),
          humidityPercent: Number(row.humidityPercent),
          currentRainfallMm: Number(row.currentRainfallMm),
          expectedRainfallMm: Number(row.expectedRainfallMm),
          rainProbabilityPercent: Number(row.rainProbabilityPercent),
          et0Mm: Number(row.et0Mm),
          windSpeedKmh: Number(row.windSpeedKmh),
          forecastSummary: row.forecastSummary as string,
        };
      }
      stmt.free();
      return Object.keys(map).length > 0 ? map : DEFAULT_WEATHER;
    } catch {
      return DEFAULT_WEATHER;
    }
  }

  function fetchAlertsFromDb(): Alert[] {
    try {
      const stmt = db.prepare('SELECT * FROM alerts ORDER BY rowid DESC');
      const results: Alert[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: row.id as string,
          severity: row.severity as any,
          title: row.title as string,
          message: row.message as string,
          source: row.source as string,
          timestamp: row.timestamp as string,
          acknowledged: Boolean(row.acknowledged),
          actionRequired: (row.actionRequired as string) || undefined,
        });
      }
      stmt.free();
      return results.length > 0 ? results : DEFAULT_ALERTS;
    } catch {
      return DEFAULT_ALERTS;
    }
  }

  // ===================== REST API ROUTES =====================

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Quantum-Inspired Irrigation & Water Allocation Optimization System',
      version: '1.0.0-hackathon',
      sqliteStatus: 'Connected',
    });
  });

  // Fields
  app.get('/api/fields', (req, res) => {
    const fields = fetchFieldsFromDb();
    res.json(fields);
  });

  app.post('/api/fields', (req, res) => {
    try {
      const f: Field = req.body;
      if (!f.id || !f.name || !f.crop) {
        return res.status(400).json({ error: 'Missing required field parameters' });
      }
      db.run(
        `INSERT OR REPLACE INTO fields VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.id,
          f.name,
          f.location || 'Krishna-Godavari Command Area',
          f.zone || 'Zone A',
          Number(f.areaHectares) || 2.0,
          f.crop,
          f.cropGrowthStage || 'Vegetative',
          Number(f.cropWaterRequirementMm) || 5.0,
          Number(f.currentSoilMoisture) || 50,
          f.soilType || 'Alluvial',
          Number(f.lastIrrigatedHoursAgo) || 24,
          f.priority || 'MEDIUM',
          f.canalId || 'C1',
          f.pumpId || 'P1',
        ]
      );

      // Create default weather entry if not existing
      db.run(
        `INSERT OR IGNORE INTO weather_data VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [f.id, 32, 60, 0, 4, 20, 5.0, 12, 'Partly cloudy, standard humidity']
      );

      saveDb(db);
      res.status(201).json({ message: 'Field created/updated successfully', field: f });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/fields/:id', (req, res) => {
    try {
      const id = req.params.id;
      const f: Field = req.body;
      db.run(
        `UPDATE fields SET name=?, location=?, zone=?, areaHectares=?, crop=?, cropGrowthStage=?, cropWaterRequirementMm=?, currentSoilMoisture=?, soilType=?, lastIrrigatedHoursAgo=?, priority=?, canalId=?, pumpId=? WHERE id=?`,
        [
          f.name,
          f.location,
          f.zone,
          Number(f.areaHectares),
          f.crop,
          f.cropGrowthStage,
          Number(f.cropWaterRequirementMm),
          Number(f.currentSoilMoisture),
          f.soilType,
          Number(f.lastIrrigatedHoursAgo),
          f.priority,
          f.canalId,
          f.pumpId,
          id,
        ]
      );
      saveDb(db);
      res.json({ message: 'Field updated successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/fields/:id', (req, res) => {
    try {
      const id = req.params.id;
      db.run(`DELETE FROM fields WHERE id=?`, [id]);
      saveDb(db);
      res.json({ message: `Field ${id} deleted` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Water Resources
  app.get('/api/water-resources', (req, res) => {
    const resources = fetchWaterResourcesFromDb();
    res.json(resources);
  });

  app.put('/api/water-resources/:id', (req, res) => {
    try {
      const id = req.params.id;
      const r: Partial<WaterResource> = req.body;
      db.run(
        `UPDATE water_resources SET currentStorageLiters=?, availableIrrigationLiters=?, expectedInflowLiters=?, status=? WHERE id=?`,
        [r.currentStorageLiters, r.availableIrrigationLiters, r.expectedInflowLiters, r.status, id]
      );
      saveDb(db);
      res.json({ message: 'Water resource updated' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Canals & Pumps
  app.get('/api/canals', (req, res) => {
    res.json(fetchCanalsFromDb());
  });

  app.get('/api/pumps', (req, res) => {
    res.json(fetchPumpsFromDb());
  });

  // Weather & Soil
  app.get('/api/weather', (req, res) => {
    const weather = fetchWeatherFromDb();
    res.json(weather);
  });

  app.get('/api/soil-data', (req, res) => {
    const fields = fetchFieldsFromDb();
    const weather = fetchWeatherFromDb();
    const soilData = fields.map((f) => ({
      fieldId: f.id,
      fieldName: f.name,
      crop: f.crop,
      soilMoisturePercent: f.currentSoilMoisture,
      soilType: f.soilType,
      temperatureC: weather[f.id]?.temperatureC ?? 32,
      humidityPercent: weather[f.id]?.humidityPercent ?? 60,
      currentRainMm: weather[f.id]?.currentRainfallMm ?? 0,
      expectedRainMm: weather[f.id]?.expectedRainfallMm ?? 0,
      rainProbabilityPercent: weather[f.id]?.rainProbabilityPercent ?? 15,
      evapotranspirationEt0: weather[f.id]?.et0Mm ?? 5.0,
      deficitStatus:
        f.currentSoilMoisture < 40 ? 'Severe Deficit' : f.currentSoilMoisture < 60 ? 'Moderate' : 'Optimal/Saturated',
    }));
    res.json(soilData);
  });

  // Demand Estimation
  app.get('/api/demand-estimation', (req, res) => {
    const fields = fetchFieldsFromDb();
    const weather = fetchWeatherFromDb();
    const estimations = fields.map((f) => {
      const w = weather[f.id] || {
        fieldId: f.id,
        temperatureC: 32,
        humidityPercent: 60,
        currentRainfallMm: 0,
        expectedRainfallMm: 0,
        rainProbabilityPercent: 10,
        et0Mm: 5.0,
        windSpeedKmh: 12,
        forecastSummary: 'Normal',
      };
      return estimateWaterDemand(f, w);
    });
    res.json(estimations);
  });

  // Optimization Execution
  app.post('/api/optimize', (req, res) => {
    try {
      const options: OptimizationOptions = req.body || {};
      const fields = fetchFieldsFromDb();
      const resources = fetchWaterResourcesFromDb();
      const canals = fetchCanalsFromDb();
      const pumps = fetchPumpsFromDb();
      const weather = fetchWeatherFromDb();

      const result = runQuantumOptimization(fields, resources, canals, pumps, weather, options);
      latestOptimizationResult = result;

      // Store in SQLite run logs
      db.run(
        `INSERT OR REPLACE INTO optimization_runs VALUES (?, ?, ?)`,
        [result.id, result.timestamp, JSON.stringify(result)]
      );
      saveDb(db);

      res.json(result);
    } catch (err: any) {
      console.error('Optimization error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Irrigation Schedule
  app.get('/api/schedule', (req, res) => {
    if (!latestOptimizationResult) {
      const fields = fetchFieldsFromDb();
      const resources = fetchWaterResourcesFromDb();
      const canals = fetchCanalsFromDb();
      const pumps = fetchPumpsFromDb();
      const weather = fetchWeatherFromDb();
      latestOptimizationResult = runQuantumOptimization(fields, resources, canals, pumps, weather);
    }
    res.json({
      schedule: latestOptimizationResult.schedule,
      baselineSchedule: latestOptimizationResult.baselineSchedule,
      metrics: latestOptimizationResult.metrics,
      timestamp: latestOptimizationResult.timestamp,
    });
  });

  // What-If Simulation
  app.post('/api/simulate', (req, res) => {
    try {
      const {
        scenarioName,
        availableWater,
        rainfallMultiplier,
        cropDemandMultiplier,
        canalCapacityMultiplier,
      } = req.body;

      const fields = fetchFieldsFromDb();
      const resources = fetchWaterResourcesFromDb();
      const canals = fetchCanalsFromDb();
      const pumps = fetchPumpsFromDb();
      const weather = fetchWeatherFromDb();

      // Run baseline normal condition
      const normalResult = runQuantumOptimization(fields, resources, canals, pumps, weather, {});

      // Run simulated condition
      const simulatedResult = runQuantumOptimization(fields, resources, canals, pumps, weather, {
        availableWaterOverride: availableWater,
        rainfallMultiplier: Number(rainfallMultiplier) || 1.0,
        cropDemandMultiplier: Number(cropDemandMultiplier) || 1.0,
        canalCapacityMultiplier: Number(canalCapacityMultiplier) || 1.0,
      });

      // Generate dynamic alert if severe shortage
      if (simulatedResult.metrics.waterShortage > 500) {
        db.run(
          `INSERT OR REPLACE INTO alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `sim-${Date.now()}`,
            'CRITICAL',
            `Simulation Alert: Severe Water Shortage under "${scenarioName || 'Custom'}"`,
            `Water deficit of ${simulatedResult.metrics.waterShortage}L detected. ${simulatedResult.metrics.fieldsRecommendedForDelay} fields forced to delay irrigation.`,
            'What-If Scenario Engine',
            'Just now',
            0,
            'Implement rotational canal rationing across Krishna-Godavari branches.',
          ]
        );
        saveDb(db);
      }

      res.json({
        scenarioName: scenarioName || 'Custom Simulation',
        before: normalResult,
        after: simulatedResult,
        comparison: {
          waterAvailableDelta: simulatedResult.metrics.totalAvailableWater - normalResult.metrics.totalAvailableWater,
          waterAllocatedDelta: simulatedResult.metrics.waterAllocated - normalResult.metrics.waterAllocated,
          waterSavedDelta: simulatedResult.metrics.estimatedWaterSaved - normalResult.metrics.estimatedWaterSaved,
          fieldsIrrigatedDelta: simulatedResult.metrics.fieldsRecommendedForIrrigation - normalResult.metrics.fieldsRecommendedForIrrigation,
          operatingCostDelta: simulatedResult.metrics.estimatedOperatingCost - normalResult.metrics.estimatedOperatingCost,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Analytics
  app.get('/api/analytics', (req, res) => {
    if (!latestOptimizationResult) {
      const fields = fetchFieldsFromDb();
      const resources = fetchWaterResourcesFromDb();
      const canals = fetchCanalsFromDb();
      const pumps = fetchPumpsFromDb();
      const weather = fetchWeatherFromDb();
      latestOptimizationResult = runQuantumOptimization(fields, resources, canals, pumps, weather);
    }

    const fields = fetchFieldsFromDb();
    const sched = latestOptimizationResult.schedule;

    // Crop-wise allocation
    const cropAllocationMap: Record<string, { crop: string; allocatedLiters: number; count: number }> = {};
    for (const item of sched) {
      if (!cropAllocationMap[item.crop]) {
        cropAllocationMap[item.crop] = { crop: item.crop, allocatedLiters: 0, count: 0 };
      }
      cropAllocationMap[item.crop].allocatedLiters += item.waterLiters;
      cropAllocationMap[item.crop].count++;
    }

    // Field-wise allocation vs baseline
    const fieldAllocationComparison = sched.map((s) => {
      const base = latestOptimizationResult?.baselineSchedule.find((b) => b.fieldId === s.fieldId);
      return {
        fieldId: s.fieldId,
        crop: s.crop,
        optimizedWater: s.waterLiters,
        baselineWater: base?.waterLiters || 0,
        savedWater: Math.max(0, (base?.waterLiters || 0) - s.waterLiters),
        decision: s.decision,
      };
    });

    // 7-day usage trend (synthetic based on command area records)
    const sevenDayTrend = [
      { day: 'Mon', availableWater: 7200, demand: 6800, allocated: 6500, saved: 700 },
      { day: 'Tue', availableWater: 7000, demand: 6400, allocated: 6200, saved: 800 },
      { day: 'Wed', availableWater: 6800, demand: 7100, allocated: 6800, saved: 950 },
      { day: 'Thu', availableWater: 6500, demand: 6900, allocated: 6500, saved: 820 },
      { day: 'Fri', availableWater: 7200, demand: 6300, allocated: 5900, saved: 880 },
      { day: 'Sat', availableWater: 7500, demand: 6100, allocated: 5800, saved: 910 },
      { day: 'Sun (Today)', availableWater: latestOptimizationResult.metrics.totalAvailableWater, demand: latestOptimizationResult.metrics.totalWaterDemand, allocated: latestOptimizationResult.metrics.waterAllocated, saved: latestOptimizationResult.metrics.estimatedWaterSaved },
    ];

    res.json({
      metrics: latestOptimizationResult.metrics,
      cropAllocation: Object.values(cropAllocationMap),
      fieldAllocationComparison,
      sevenDayTrend,
      quboConvergence: latestOptimizationResult.convergenceHistory,
      quboMatrixSummary: latestOptimizationResult.quboMatrixSummary,
    });
  });

  // Alerts
  app.get('/api/alerts', (req, res) => {
    res.json(fetchAlertsFromDb());
  });

  app.post('/api/alerts/acknowledge', (req, res) => {
    try {
      const { id } = req.body;
      if (id) {
        db.run(`UPDATE alerts SET acknowledged=1 WHERE id=?`, [id]);
      } else {
        db.run(`UPDATE alerts SET acknowledged=1`);
      }
      saveDb(db);
      res.json({ message: 'Alerts updated' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset to demo initial state
  app.post('/api/reset', (req, res) => {
    try {
      resetToDefaults(db);
      const fields = fetchFieldsFromDb();
      const resources = fetchWaterResourcesFromDb();
      const canals = fetchCanalsFromDb();
      const pumps = fetchPumpsFromDb();
      const weather = fetchWeatherFromDb();
      latestOptimizationResult = runQuantumOptimization(fields, resources, canals, pumps, weather);
      res.json({ message: 'Database reset to initial Krishna-Godavari demo dataset', result: latestOptimizationResult });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================== VITE & STATIC SERVING =====================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Quantum-Irrigation] Server running on http://0.0.0.0:${PORT}`);
    });
  }
  return app;
}

export default startServer();
