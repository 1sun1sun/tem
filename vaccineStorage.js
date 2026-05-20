const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'vaccine_db.json');

function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      temperature_data: [],
      vaccine_info: {},
      alert_records: [],
      alert_confirmations: [],
      statistics: {
        daily: {},
        weekly: {},
        monthly: {}
      }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readDB() {
  initDB();
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function insertTemperatureData(deviceId, sensorId, temperature, rawData) {
  const db = readDB();
  
  const record = {
    id: Date.now(),
    device_id: deviceId,
    sensor_id: sensorId,
    temperature: temperature,
    timestamp: new Date().toISOString(),
    raw_data: rawData
  };
  
  db.temperature_data.push(record);
  
  if (db.temperature_data.length > 10000) {
    db.temperature_data = db.temperature_data.slice(-10000);
  }
  
  writeDB(db);
  return record.id;
}

function getLatestData(deviceId, limit = 20) {
  const db = readDB();
  let data = db.temperature_data;
  
  if (deviceId) {
    data = data.filter(item => item.device_id === deviceId);
  }
  
  return data
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

function getHistoricalData(deviceId, startTime, endTime, limit = 1000) {
  const db = readDB();
  let data = db.temperature_data;
  
  if (deviceId) {
    data = data.filter(item => item.device_id === deviceId);
  }
  
  if (startTime) {
    const start = new Date(startTime);
    data = data.filter(item => new Date(item.timestamp) >= start);
  }
  
  if (endTime) {
    const end = new Date(endTime);
    data = data.filter(item => new Date(item.timestamp) <= end);
  }
  
  return data
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

function getDataStats(deviceId, startTime, endTime) {
  const data = getHistoricalData(deviceId, startTime, endTime);
  
  if (data.length === 0) {
    return { count: 0, max_temp: null, min_temp: null, avg_temp: null };
  }
  
  const temperatures = data.map(item => item.temperature);
  
  return {
    count: data.length,
    max_temp: Math.max(...temperatures),
    min_temp: Math.min(...temperatures),
    avg_temp: temperatures.reduce((a, b) => a + b, 0) / temperatures.length
  };
}

function getDataCount(deviceId) {
  const db = readDB();
  if (deviceId) {
    return db.temperature_data.filter(item => item.device_id === deviceId).length;
  }
  return db.temperature_data.length;
}

function setVaccineInfo(sensorId, info) {
  const db = readDB();
  db.vaccine_info[sensorId] = {
    ...info,
    sensor_id: sensorId,
    updated_at: new Date().toISOString()
  };
  writeDB(db);
}

function getVaccineInfo(sensorId) {
  const db = readDB();
  return db.vaccine_info[sensorId] || null;
}

function getAllVaccineInfo() {
  const db = readDB();
  return db.vaccine_info;
}

function addAlertRecord(alert) {
  const db = readDB();
  const record = {
    id: Date.now(),
    ...alert,
    created_at: new Date().toISOString(),
    confirmed: false,
    confirmed_at: null
  };
  db.alert_records.push(record);
  writeDB(db);
  return record.id;
}

function getAlertRecords(startTime, endTime, confirmed) {
  const db = readDB();
  let data = db.alert_records;
  
  if (startTime) {
    const start = new Date(startTime);
    data = data.filter(item => new Date(item.created_at) >= start);
  }
  
  if (endTime) {
    const end = new Date(endTime);
    data = data.filter(item => new Date(item.created_at) <= end);
  }
  
  if (confirmed !== undefined) {
    data = data.filter(item => item.confirmed === confirmed);
  }
  
  return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function confirmAlert(alertId, note = '') {
  const db = readDB();
  const alert = db.alert_records.find(item => item.id === alertId);
  if (alert) {
    alert.confirmed = true;
    alert.confirmed_at = new Date().toISOString();
    alert.confirm_note = note;
    writeDB(db);
    return true;
  }
  return false;
}

function calculateStatistics() {
  const db = readDB();
  const now = new Date();
  
  const today = now.toISOString().split('T')[0];
  const dailyData = db.temperature_data.filter(item => 
    item.timestamp.startsWith(today)
  );
  
  if (dailyData.length > 0) {
    const temps = dailyData.map(item => item.temperature);
    db.statistics.daily[today] = {
      count: dailyData.length,
      max_temp: Math.max(...temps),
      min_temp: Math.min(...temps),
      avg_temp: temps.reduce((a, b) => a + b, 0) / temps.length
    };
  }
  
  writeDB(db);
  return db.statistics;
}

function getStatistics(type = 'daily', limit = 30) {
  const db = readDB();
  const stats = db.statistics[type] || {};
  const keys = Object.keys(stats).sort().reverse().slice(0, limit);
  return keys.map(key => ({ date: key, ...stats[key] }));
}

module.exports = {
  initDB,
  insertTemperatureData,
  getLatestData,
  getHistoricalData,
  getDataStats,
  getDataCount,
  setVaccineInfo,
  getVaccineInfo,
  getAllVaccineInfo,
  addAlertRecord,
  getAlertRecords,
  confirmAlert,
  calculateStatistics,
  getStatistics
};
