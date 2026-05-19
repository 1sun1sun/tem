const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_PATH = path.join(__dirname, 'vaccine_db.json');

async function migrate() {
    console.log('>>> 开始数据迁移 (JSON -> MySQL)...');

    if (!fs.existsSync(DB_PATH)) {
        console.error('✗ 错误: 找不到数据文件 vaccine_db.json');
        return;
    }

    const rawData = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(rawData);

    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'iot_vaccine_db'
    });

    // 日期格式化助手：将 ISO 字符串转换为 MySQL 格式 (YYYY-MM-DD HH:mm:ss)
    const formatDate = (isoString) => {
        if (!isoString) return null;
        try {
            return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
        } catch (e) {
            return null;
        }
    };

    try {
        // 1. 迁移疫苗信息
        console.log('>>> 正在迁移疫苗信息...');
        const vaccineInfos = Object.values(db.vaccine_info || {});
        for (const info of vaccineInfos) {
            await connection.execute(
                `INSERT INTO vaccine_info (sensor_id, name, batch_no, expiry_date, location, notes, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE name=VALUES(name), batch_no=VALUES(batch_no), expiry_date=VALUES(expiry_date), location=VALUES(location), notes=VALUES(notes), updated_at=VALUES(updated_at)`,
                [
                    info.sensor_id, 
                    info.name, 
                    info.batch_no, 
                    info.expiry_date || null, 
                    info.location, 
                    info.notes, 
                    formatDate(info.updated_at)
                ]
            );
        }
        console.log(`✓ 成功迁移 ${vaccineInfos.length} 条疫苗信息`);

        // 2. 迁移温度数据
        console.log('>>> 正在迁移温度数据 (可能需要一点时间)...');
        const tempData = db.temperature_data || [];
        let count = 0;
        
        // 分批插入以提高性能
        const batchSize = 100;
        for (let i = 0; i < tempData.length; i += batchSize) {
            const batch = tempData.slice(i, i + batchSize);
            const values = [];
            const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(',');
            
            batch.forEach(item => {
                values.push(
                    item.device_id, 
                    item.sensor_id, 
                    item.temperature, 
                    formatDate(item.timestamp), 
                    JSON.stringify(item.raw_data)
                );
            });

            await connection.execute(
                `INSERT INTO temperature_data (device_id, sensor_id, temperature, timestamp, raw_data) VALUES ${placeholders}`,
                values
            );
            count += batch.length;
            if (count % 500 === 0 || count === tempData.length) {
                console.log(`  已完成: ${count}/${tempData.length}`);
            }
        }
        console.log(`✓ 成功迁移 ${tempData.length} 条温度数据`);

        // 3. 迁移报警记录
        console.log('>>> 正在迁移报警记录...');
        const alerts = db.alert_records || [];
        for (const alert of alerts) {
            await connection.execute(
                `INSERT INTO alert_records (device_id, sensor_id, temperature, type, message, confirmed, confirmed_at, confirm_note, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    alert.device_id, 
                    alert.sensor_id, 
                    alert.temperature, 
                    alert.type, 
                    alert.message, 
                    alert.confirmed || 0, 
                    formatDate(alert.confirmed_at), 
                    alert.confirm_note || null, 
                    formatDate(alert.created_at || alert.timestamp)
                ]
            );
        }
        console.log(`✓ 成功迁移 ${alerts.length} 条报警记录`);

        console.log('\n=====================================');
        console.log('🎉 所有数据迁移完成！');
        console.log('=====================================');

    } catch (error) {
        console.error('✗ 迁移过程中出错:', error);
    } finally {
        await connection.end();
    }
}

migrate();
