import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

async function main() {
 // الكود المُعدَّل (سيأخذ القيم الصحيحة من Vercel)

// ... (خطوط الكود الأخرى تبقى كما هي)
const 
    DB_HOST = process.env.MYSQL_HOST, // استخدمي MYSQL_HOST من الآن فصاعداً
    DB_USER = process.env.MYSQL_USER, // استخدمي MYSQL_USER
    DB_PASSWORD = process.env.MYSQL_ROOT_PASSWORD, // **الأهم:** استخدمي MYSQL_ROOT_PASSWORD
    DB_NAME = process.env.MYSQL_DATABASE, // استخدمي MYSQL_DATABASE
    DB_PORT = process.env.MYSQL_PORT // استخدمي MYSQL_PORT
// ...
  } = process.env;

  const sqlPath = path.resolve(process.cwd(), 'server/scripts/schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`[db:init] Missing schema file at ${sqlPath}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`[db:init] Connecting to ${DB_HOST}:${DB_PORT} as ${DB_USER}`);
  const conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    port: Number(DB_PORT),
    multipleStatements: true,

    
    // 💡 ضيفي هاد السطرين هنا:
    ssl: {
        rejectUnauthorized: false
    }
  });

  try {
    // Ensure DB exists
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${DB_NAME}\`;`);
    console.log('[db:init] Applying schema...');
    await conn.query(sql);
    console.log('[db:init] Done.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[db:init] Failed:', err);
  process.exit(1);
});
