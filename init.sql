-- 创建数据库
CREATE DATABASE IF NOT EXISTS iot_vaccine_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE iot_vaccine_db;

-- 1. 温度数据表
CREATE TABLE IF NOT EXISTS temperature_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    sensor_id VARCHAR(50) NOT NULL,
    temperature DECIMAL(5, 2) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data JSON,
    INDEX idx_device_time (device_id, timestamp),
    INDEX idx_sensor_time (sensor_id, timestamp)
);

-- 2. 疫苗信息表
CREATE TABLE IF NOT EXISTS vaccine_info (
    sensor_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    batch_no VARCHAR(50),
    expiry_date DATE,
    location VARCHAR(100),
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. 报警记录表
CREATE TABLE IF NOT EXISTS alert_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(100),
    sensor_id VARCHAR(50),
    temperature DECIMAL(5, 2),
    type ENUM('low', 'high') NOT NULL,
    message VARCHAR(255),
    confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at DATETIME,
    confirm_note VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 统计表 (可选，也可以通过视图或实时计算)
CREATE TABLE IF NOT EXISTS daily_statistics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stat_date DATE NOT NULL,
    sensor_id VARCHAR(50),
    avg_temp DECIMAL(5, 2),
    max_temp DECIMAL(5, 2),
    min_temp DECIMAL(5, 2),
    count INT,
    UNIQUE KEY unique_date_sensor (stat_date, sensor_id)
);
