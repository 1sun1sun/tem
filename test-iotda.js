const core = require('@huaweicloud/huaweicloud-sdk-core');
const iotda = require("@huaweicloud/huaweicloud-sdk-iotda/v5/public-api");

console.log('========================================');
console.log('  华为云IoTDA SDK 测试脚本');
console.log('========================================\n');

const ak = 'HPUAY6GSMQPGVPBNLQXJ';
const sk = 'lD0DyiKUiCPND7s3HhulP1PoaWnsBoqBPtAhxXSl';
const projectId = '019e06a27ea47ab6a9939949b6df62c4';
const deviceId = '69fd9d23cbb0cf6bb958c9d0_YUESE001';
const endpoint = 'https://ec8501a872.st1.iotda-app.cn-north-4.myhuaweicloud.com';

console.log('配置信息:');
console.log('  AccessKey:', ak);
console.log('  SecretKey:', sk);
console.log('  项目ID:', projectId);
console.log('  设备ID:', deviceId);
console.log('  Endpoint:', endpoint);
console.log('\n========================================\n');

console.log('创建认证凭证...');
const credentials = new core.BasicCredentials()
  .withAk(ak)
  .withSk(sk)
  .withProjectId(projectId);

console.log('创建客户端...');
const client = iotda.IoTDAClient.newBuilder()
  .withCredential(credentials)
  .withEndpoint(endpoint)
  .build();

console.log('创建请求...');
const request = new iotda.ShowDeviceShadowRequest();
request.deviceId = deviceId;

console.log('发送请求...\n');

client.showDeviceShadow(request)
  .then(response => {
    console.log('✅ 测试成功!');
    console.log('\n响应数据:');
    console.log(JSON.stringify(response, null, 2));
  })
  .catch(error => {
    console.log('❌ 测试失败!');
    console.log('\n错误信息:');
    console.log('  消息:', error.message);
    if (error.response) {
      console.log('  状态码:', error.response.status);
      console.log('  响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  });
