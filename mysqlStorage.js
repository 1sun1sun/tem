const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'iot_vaccine_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function insertTemperatureData(deviceId, sensorId, temperature, rawData) {
    try {
        const [result] = await pool.execute(
            'INSERT INTO temperature_data (device_id, sensor_id, temperature, raw_data) VALUES (?, ?, ?, ?)',
            [deviceId, sensorId, temperature, JSON.stringify(rawData)]
        );
        return result.insertId;
    } catch (error) {
        console.error('MySQL Insert Error:', error);
        throw error;
    }
}

async function getLatestData(deviceId, limit = 20) {
    try {
        let sql = 'SELECT * FROM temperature_data';
        const params = [];
        if (deviceId) {
            sql += ' WHERE device_id = ?';
            params.push(deviceId);
        }
        sql += ' ORDER BY timestamp DESC LIMIT ' + parseInt(limit);
        
        const [rows] = await pool.query(sql, params);
        return rows.map(row => ({
            ...row,
            temperature: parseFloat(row.temperature)
        }));
    } catch (error) {
        console.error('MySQL Select Error:', error);
        return [];
    }
}

async function getHistoricalData(deviceId, startTime, endTime, limit = 1000) {
    try {
        let sql = 'SELECT timestamp, temperature, sensor_id FROM temperature_data WHERE 1=1';
        const params = [];
        if (deviceId) {
            sql += ' AND device_id = ?';
            params.push(deviceId);
        }
        if (startTime) {
            sql += ' AND timestamp >= ?';
            params.push(startTime);
        }
        if (endTime) {
            sql += ' AND timestamp <= ?';
            params.push(endTime);
        }
        sql += ' ORDER BY timestamp ASC LIMIT ' + parseInt(limit);
        
        const [rows] = await pool.query(sql, params);
        return rows.map(row => ({
            ...row,
            temperature: parseFloat(row.temperature)
        }));
    } catch (error) {
        console.error('MySQL History Error:', error);
        return [];
    }
}

async function getDataStats(deviceId, startTime, endTime) {
    try {
        const sql = `
            SELECT 
                COUNT(*) as count, 
                MAX(temperature) as max_temp, 
                MIN(temperature) as min_temp, 
                AVG(temperature) as avg_temp 
            FROM temperature_data 
            WHERE device_id = ? AND timestamp BETWEEN ? AND ?`;
        const [rows] = await pool.query(sql, [deviceId, startTime, endTime]);
        const stats = rows[0];
        return {
            count: stats.count,
            max_temp: stats.max_temp !== null ? parseFloat(stats.max_temp) : null,
            min_temp: stats.min_temp !== null ? parseFloat(stats.min_temp) : null,
            avg_temp: stats.avg_temp !== null ? parseFloat(stats.avg_temp) : null
        };
    } catch (error) {
        console.error('MySQL Stats Error:', error);
        return { count: 0, max_temp: null, min_temp: null, avg_temp: null };
    }
}

async function getDataCount(deviceId) {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as total FROM temperature_data WHERE device_id = ?', [deviceId]);
        return rows[0].total;
    } catch (error) {
        return 0;
    }
}

async function setVaccineInfo(sensorId, info) {
    try {
        const sql = `
            INSERT INTO vaccine_info (sensor_id, name, batch_no, expiry_date, location, notes)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                name = VALUES(name),
                batch_no = VALUES(batch_no),
                expiry_date = VALUES(expiry_date),
                location = VALUES(location),
                notes = VALUES(notes)`;
        await pool.execute(sql, [
            sensorId, 
            info.name, 
            info.batch_no, 
            info.expiry_date || null, 
            info.location, 
            info.notes
        ]);
    } catch (error) {
        console.error('MySQL Vaccine Info Error:', error);
    }
}

async function getVaccineInfo(sensorId) {
    try {
        const [rows] = await pool.execute('SELECT * FROM vaccine_info WHERE sensor_id = ?', [sensorId]);
        return rows[0] || null;
    } catch (error) {
        return null;
    }
}

async function getAllVaccineInfo() {
    try {
        const [rows] = await pool.query('SELECT * FROM vaccine_info');
        const infoMap = {};
        rows.forEach(row => {
            infoMap[row.sensor_id] = {
                ...row,
                expiry_date: row.expiry_date ? row.expiry_date.toISOString().split('T')[0] : null
            };
        });
        return infoMap;
    } catch (error) {
        console.error('MySQL Vaccine Info Error:', error);
        return {};
    }
}

async function addAlertRecord(alert) {
    try {
        const [result] = await pool.execute(
            'INSERT INTO alert_records (device_id, sensor_id, temperature, type, message) VALUES (?, ?, ?, ?, ?)',
            [alert.device_id, alert.sensor_id, alert.temperature, alert.type, alert.message]
        );
        return result.insertId;
    } catch (error) {
        console.error('MySQL Alert Error:', error);
        return null;
    }
}

async function getAlertRecords(startTime, endTime, confirmed) {
    try {
        let sql = 'SELECT * FROM alert_records WHERE 1=1';
        const params = [];
        if (startTime) {
            sql += ' AND created_at >= ?';
            params.push(startTime);
        }
        if (endTime) {
            sql += ' AND created_at <= ?';
            params.push(endTime);
        }
        if (confirmed !== undefined) {
            sql += ' AND confirmed = ?';
            params.push(confirmed);
        }
        sql += ' ORDER BY created_at DESC';
        const [rows] = await pool.query(sql, params);
        return rows.map(row => ({
            ...row,
            temperature: row.temperature !== null ? parseFloat(row.temperature) : null
        }));
    } catch (error) {
        return [];
    }
}

async function confirmAlert(alertId, note = '') {
    try {
        const [result] = await pool.execute(
            'UPDATE alert_records SET confirmed = TRUE, confirmed_at = NOW(), confirm_note = ? WHERE id = ?',
            [note, alertId]
        );
        return result.affectedRows > 0;
    } catch (error) {
        return false;
    }
}

async function getStatistics(type = 'daily', limit = 30) {
    // 实时从数据库聚合统计，比 JSON 方案更准确
    try {
        let dateFormat = '%Y-%m-%d';
        if (type === 'weekly') dateFormat = '%Y-%u';
        if (type === 'monthly') dateFormat = '%Y-%m';

        const sql = `
            SELECT 
                DATE_FORMAT(timestamp, ?) as date,
                MAX(temperature) as max_temp,
                MIN(temperature) as min_temp,
                AVG(temperature) as avg_temp,
                COUNT(*) as count
            FROM temperature_data
            GROUP BY date
            ORDER BY date DESC
            LIMIT ${parseInt(limit)}`;
        const [rows] = await pool.query(sql, [dateFormat]);
        return rows.map(row => ({
            ...row,
            max_temp: parseFloat(row.max_temp),
            min_temp: parseFloat(row.min_temp),
            avg_temp: parseFloat(row.avg_temp)
        }));
    } catch (error) {
        console.error('MySQL Statistics Error:', error);
        return [];
    }
}

module.exports = {
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
    getStatistics
};
