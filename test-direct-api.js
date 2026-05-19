const axios = require('axios');
const crypto = require('crypto');

console.log('========================================');
console.log('  IoTDA API 直接调用测试 (AK/SK签名)');
console.log('========================================\n');

const ak = 'HPUAFXXSG0YMMIMU6WGD';
const sk = '1Kka8tWzfzjpo4384KuLBcModlGLVOzjysQeLNgY';
const projectId = '019e06a27ea47ab6a9939949b6df62c4';
const deviceId = '69fd9d23cbb0cf6bb958c9d0_YUESE001';
const instanceId = '6a513570-cf68-4834-8c55-6ba62ae23d9f';
const endpoint = 'iotda.cn-north-4.myhuaweicloud.com';

function getSignatureKey(key, date, region, service) {
  const kDate = crypto.createHmac('sha256', key).update(date).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('sdk_request').digest();
  return kSigning;
}

function sign(key, message) {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

function getSHA256Hash(message) {
  return crypto.createHash('sha256').update(message).digest('hex');
}

const method = 'GET';
const uri = `/v5/iot/${projectId}/devices/${deviceId}/shadow`;
const now = new Date();
const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '').split('T')[0];
const timeStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

const queryString = '';
const body = '';
const bodyHash = getSHA256Hash(body);

const headers = {
  'host': endpoint,
  'content-type': 'application/json',
  'x-project-id': projectId,
  'x-sdk-date': timeStr.substring(0, 15) + 'Z'
};

const sortedHeaders = Object.keys(headers).sort();
const canonicalHeaders = sortedHeaders.map(k => `${k.toLowerCase()}:${headers[k]}`).join('\n');
const signedHeaders = sortedHeaders.join(';');

const canonicalRequest = [
  method,
  uri,
  queryString,
  canonicalHeaders,
  '',
  signedHeaders,
  bodyHash
].join('\n');

const algorithm = 'SDK-HMAC-SHA256';
const credentialScope = `${dateStr}/cn-north-4/iotda/sdk_request`;
const canonicalRequestHash = getSHA256Hash(canonicalRequest);

const stringToSign = [
  algorithm,
  timeStr.substring(0, 15) + 'Z',
  credentialScope,
  canonicalRequestHash
].join('\n');

const kSigning = getSignatureKey(sk, dateStr, 'cn-north-4', 'iotda');
const signature = sign(kSigning, stringToSign);

const authorization = `${algorithm} Access=${ak}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

console.log('请求信息:');
console.log('  URL:', `https://${endpoint}${uri}`);
console.log('  Method:', method);
console.log('  Instance-Id:', instanceId);
console.log('\n========================================\n');

axios({
  method: method,
  url: `https://${endpoint}${uri}`,
  headers: {
    'Content-Type': 'application/json',
    'X-Project-Id': projectId,
    'X-Sdk-Date': timeStr.substring(0, 15) + 'Z',
    'Authorization': authorization,
    'Instance-Id': instanceId
  }
})
.then(response => {
  console.log('✅ 测试成功!');
  console.log('\n设备影子数据:');
  console.log(JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.log('❌ 测试失败!');
  if (error.response) {
    console.log('状态码:', error.response.status);
    console.log('错误:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.log('错误:', error.message);
  }
});
