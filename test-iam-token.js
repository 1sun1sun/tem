const axios = require('axios');

console.log('========================================');
console.log('  IAM Token 获取测试');
console.log('========================================\n');

const iamEndpoint = 'https://iam.cn-north-4.myhuaweicloud.com/v3/auth/tokens';

const authData = {
  auth: {
    identity: {
      methods: ['password'],
      password: {
        user: {
          name: 'TEST',
          password: 'VHYVvUu9OeXVsuYZcXCf',
          domain: {
            name: 'hid_nozx10xbhh3hgxp'
          }
        }
      }
    },
    scope: {
      project: {
        id: '019e06a27ea47ab6a9939949b6df62c4'
      }
    }
  }
};

console.log('请求IAM Token...');
console.log('IAM用户: TEST');
console.log('Domain: hid_nozx10xbhh3hgxp');
console.log('项目ID: 019e06a27ea47ab6a9939949b6df62c4\n');

axios.post(iamEndpoint, authData, {
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => {
  const token = response.headers['x-subject-token'];
  console.log('✅ Token获取成功!');
  console.log('\nToken:', token);
  console.log('\n现在尝试用Token访问IoTDA...\n');
  
  return axios.get(
    'https://ec8501a872.st1.iotda-app.cn-north-4.myhuaweicloud.com/v5/iot/019e06a27ea47ab6a9939949b6df62c4/devices/69fd9d23cbb0cf6bb958c9d0_YUESE001/shadow',
    {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/json'
      }
    }
  );
})
.then(response => {
  console.log('✅ IoTDA访问成功!');
  console.log('\n设备影子数据:');
  console.log(JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.log('❌ 失败!');
  if (error.response) {
    console.log('状态码:', error.response.status);
    console.log('错误:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.log('错误:', error.message);
  }
});
