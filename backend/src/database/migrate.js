require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  };

  const dbName = process.env.DB_NAME || 'smart_question_system';
  const schemaPath = path.join(__dirname, 'schema.sql');

  console.log('Connecting to MySQL...');
  const conn = await mysql.createConnection(dbConfig);

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database "${dbName}" ready.`);
    await conn.query(`USE \`${dbName}\``);

    const sql = fs.readFileSync(schemaPath, 'utf8');
    await conn.query(sql);
    console.log('Schema applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
