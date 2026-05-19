const axios = require('axios');

async function simulatePush() {
    const url = 'http://localhost:3000/api/iot/push';
    
    // 模拟华为云 IoTDA 推送的 JSON 数据格式
    const mockData = {
        "resource": "device.property",
        "event": "report",
        "event_time": new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
        "notify_data": {
            "header": {
                "device_id": "69fd9d23cbb0cf6bb958c9d0_YUESE001"
            },
            "body": {
                "services": [
                    {
                        "service_id": "DHDHGHETEG",
                        "properties": {
                            "sensor_id": "0X48",
                            "temperature": 26.8
                        },
                        "event_time": new Date().toISOString()
                    }
                ]
            }
        }
    };

    console.log('>>> 正在模拟华为云推送数据至本地后端...');
    try {
        const response = await axios.post(url, mockData);
        console.log('✓ 后端响应:', response.data);
        if (response.data.success) {
            console.log('🎉 自动存储测试成功！数据已进入数据库。');
        }
    } catch (error) {
        console.error('✗ 推送失败:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 请确保后端服务 (npm start) 正在运行并监听 3000 端口。');
        }
    }
}

simulatePush();
