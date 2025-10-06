import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const {
    DB_HOST = '127.0.0.1',
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'fantasy_db',
    DB_PORT = '3306',
  } = process.env;

  const conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: Number(DB_PORT),
    multipleStatements: true,
  });

  try {
    console.log('[migration] Checking groups table columns...');
    const [cols] = await conn.query("SHOW COLUMNS FROM `groups`");
    const names = new Set(cols.map((c) => c.Field));

    if (names.has('owner_id') && !names.has('created_by')) {
      console.log('[migration] Renaming groups.owner_id -> created_by');
      await conn.query('ALTER TABLE `groups` CHANGE `owner_id` `created_by` INT NOT NULL');
    }

    // Refresh columns after possible rename
    const [cols2] = await conn.query("SHOW COLUMNS FROM `groups`");
    const names2 = new Set(cols2.map((c) => c.Field));

    if (!names2.has('code')) {
      console.log('[migration] Adding groups.code');
      await conn.query("ALTER TABLE `groups` ADD COLUMN `code` VARCHAR(10) NOT NULL AFTER `name`");
      console.log('[migration] Creating unique index on groups.code');
      await conn.query("ALTER TABLE `groups` ADD UNIQUE KEY `code` (`code`)");
    }

    console.log('[migration] Done.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migration] Failed:', e);
  process.exit(1);
});
