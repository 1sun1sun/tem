const express = require('express');
const cors = require('cors');
const axios = require('axios');
const config = require('./config');
const storage = require('./storage');
const iotdaClient = require('./iotdaClient');

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

const TEMP_MIN = 24;
const TEMP_MAX = 28;

app.post('/api/iot/push', async (req, res) => {
  try {
    console.log('\n========== 收到华为云数据推送 ==========');
    console.log('时间:', new Date().toLocaleString('zh-CN'));
    
    const body = req.body;
    let deviceId = null;
    let sensorId = null;
    let temperature = null;
    
    if (body.notify_data && body.notify_data.body) {
      deviceId = body.notify_data.header.device_id;
      const services = body.notify_data.body.services;
      if (services && Array.isArray(services)) {
        services.forEach(service => {
          if (service.properties) {
            sensorId = service.properties.sensor_id || sensorId;
            temperature = service.properties.temperature || temperature;
          }
        });
      }
    } else if (body.services && Array.isArray(body.services)) {
      body.services.forEach(service => {
        if (service.properties) {
          sensorId = service.properties.sensor_id || sensorId;
          temperature = service.properties.temperature || temperature;
        }
      });
    }
    
    deviceId = deviceId || config.iotda.deviceId;
    
    if (sensorId && temperature !== null && temperature !== undefined) {
      console.log('✓ 设备ID:', deviceId);
      console.log('✓ 传感器ID:', sensorId);
      console.log('✓ 温度值:', temperature, '°C');
      
      const recordId = await storage.insertTemperatureData(deviceId, sensorId, temperature, body);
      
      if (temperature < TEMP_MIN || temperature > TEMP_MAX) {
        await storage.addAlertRecord({
          sensor_id: sensorId,
          device_id: deviceId,
          temperature: temperature,
          type: temperature < TEMP_MIN ? 'low' : 'high',
          message: `温度${temperature < TEMP_MIN ? '过低' : '过高'}: ${temperature}°C`
        });
        console.log('⚠ 温度异常，已记录报警');
      }
      
      console.log('✓ 数据已保存, ID:', recordId);
      console.log('==========================================\n');
      
      res.json({ success: true, message: '数据接收成功', recordId });
    } else {
      console.log('⚠ 无法解析温度数据');
      console.log('==========================================\n');
      res.json({ success: true, message: '数据已接收但无法解析' });
    }
  } catch (error) {
    console.error('✗ 处理推送数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/temperature/latest', async (req, res) => {
  try {
    const deviceId = req.query.deviceId || config.iotda.deviceId;
    const limit = parseInt(req.query.limit) || 20;
    const data = await storage.getLatestData(deviceId, limit);
    res.json({ success: true, data, count: data.length, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/temperature/history', async (req, res) => {
  try {
    const deviceId = req.query.deviceId || config.iotda.deviceId;
    const { startTime, endTime } = req.query;
    const limit = parseInt(req.query.limit) || 1000;
    const data = await storage.getHistoricalData(deviceId, startTime, endTime, limit);
    const chartData = data.map(item => ({
      time: item.timestamp,
      temperature: item.temperature,
      sensorId: item.sensor_id
    })).reverse();
    res.json({ success: true, data: chartData, count: chartData.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/temperature/stats', async (req, res) => {
  try {
    const deviceId = req.query.deviceId || config.iotda.deviceId;
    const startTime = req.query.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endTime = req.query.endTime || new Date().toISOString();
    const stats = await storage.getDataStats(deviceId, startTime, endTime);
    const totalCount = await storage.getDataCount(deviceId);
    res.json({ success: true, stats: { ...stats, totalCount } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/vaccine/info/:sensorId', async (req, res) => {
  try {
    const info = await storage.getVaccineInfo(req.params.sensorId);
    res.json({ success: true, data: info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/vaccine/info', async (req, res) => {
  try {
    const info = await storage.getAllVaccineInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/vaccine/info', async (req, res) => {
  try {
    const { sensor_id, name, batch_no, expiry_date, location, notes } = req.body;
    if (!sensor_id) return res.status(400).json({ success: false, error: '缺少sensor_id' });
    await storage.setVaccineInfo(sensor_id, { name, batch_no, expiry_date, location, notes });
    res.json({ success: true, message: '疫苗信息已保存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    const confirmed = req.query.confirmed === 'true' ? true : req.query.confirmed === 'false' ? false : undefined;
    const alerts = await storage.getAlertRecords(startTime, endTime, confirmed);
    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/alerts/:id/confirm', async (req, res) => {
  try {
    const result = await storage.confirmAlert(parseInt(req.params.id), req.body.note || '');
    if (result) {
      res.json({ success: true, message: '报警已确认' });
    } else {
      res.status(404).json({ success: false, error: '报警记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/statistics', async (req, res) => {
  try {
    const type = req.query.type || 'daily';
    const limit = parseInt(req.query.limit) || 30;
    const stats = await storage.getStatistics(type, limit);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/status', async (req, res) => {
  const totalCount = await storage.getDataCount(config.iotda.deviceId);
  res.json({
    success: true,
    status: 'running',
    deviceId: config.iotda.deviceId,
    totalRecords: totalCount,
    serverTime: new Date().toISOString()
  });
});

app.get('/api/temperature/realtime', async (req, res) => {
  try {
    const shadowData = await iotdaClient.getDeviceShadow();
    const tempData = iotdaClient.parseTemperature(shadowData);
    if (tempData) {
      await storage.insertTemperatureData(tempData.deviceId, tempData.sensorId, tempData.temperature, shadowData);
    }
    res.json({ success: true, data: tempData, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/device/command', async (req, res) => {
  try {
    const { device_id, command_name, paras } = req.body;
    const deviceId = device_id || config.iotda.deviceId;
    
    const token = await iotdaClient.getIAMToken();
    const url = `https://${iotdaClient.config.endpoint}/v5/iot/${config.iotda.projectId}/devices/${deviceId}/commands`;
    
    const response = await axios.post(url, {
      command_name: command_name || 'customCommand',
      paras: paras || {}
    }, {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, details: error.response?.data });
  }
});

app.post('/api/device/property', async (req, res) => {
  try {
    const { device_id, services } = req.body;
    const deviceId = device_id || config.iotda.deviceId;
    
    const token = await iotdaClient.getIAMToken();
    const url = `https://${iotdaClient.config.endpoint}/v5/iot/${config.iotda.projectId}/devices/${deviceId}/shadow`;
    
    const response = await axios.put(url, {
      shadow: [{
        service_id: services[0].service_id || 'DHDHGHETEG',
        desired: {
          properties: services[0].properties || {}
        }
      }]
    }, {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, details: error.response?.data });
  }
});

app.post('/api/device/message', async (req, res) => {
  try {
    const { device_id, message } = req.body;
    const deviceId = device_id || config.iotda.deviceId;
    
    const token = await iotdaClient.getIAMToken();
    const url = `https://${iotdaClient.config.endpoint}/v5/iot/${config.iotda.projectId}/devices/${deviceId}/messages`;
    
    const response = await axios.post(url, {
      message: message || ''
    }, {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, details: error.response?.data });
  }
});

app.use(express.static('../frontend'));

const PORT = config.server.port;
app.listen(PORT, () => {
  console.log('========================================');
  console.log('  疫苗温度监控系统');
  console.log('========================================');
  console.log(`✓ Web服务器已启动: http://localhost:${PORT}`);
  console.log(`✓ API端点: http://localhost:${PORT}/api`);
  console.log('========================================\n');
  console.log('等待IoTDA数据转发推送...\n');
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});
