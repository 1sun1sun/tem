const jsonStorage = require('./vaccineStorage');
const mysqlStorage = require('./mysqlStorage');

const dbType = process.env.DB_TYPE || 'json';

const storage = dbType === 'mysql' ? mysqlStorage : jsonStorage;

module.exports = storage;
