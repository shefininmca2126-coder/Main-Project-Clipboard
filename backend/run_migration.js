require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_question_system',
  });

  console.log('Connected to database');

  // Run distribution config migration
  const sql1 = fs.readFileSync(path.join(__dirname, 'src/database/migrations/001_add_distribution_config.sql'), 'utf8');

  try {
    await connection.query(sql1);
    console.log('✅ Migration 001_add_distribution_config.sql applied successfully');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Distribution config columns already exist, skipping migration');
    } else {
      throw err;
    }
  }

  // Run marks/feedback migration
  const sql2 = fs.readFileSync(path.join(__dirname, 'src/database/migrations/add_marks_feedback.sql'), 'utf8');

  try {
    await connection.query(sql2);
    console.log('✅ Migration add_marks_feedback.sql applied successfully');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Marks/feedback columns already exist, skipping migration');
    } else {
      throw err;
    }
  }

  await connection.end();
}

runMigration().catch(console.error);
