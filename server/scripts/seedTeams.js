import 'dotenv/config';
import mysql from 'mysql2/promise';

const TEAMS = [
  { name: 'Arsenal', slug: 'arsenal', logo: '/logos/arsenal.png' },
  { name: 'Aston Villa', slug: 'aston-villa', logo: '/logos/aston-villa.png' },
  { name: 'AFC Bournemouth', slug: 'afc-bournemouth', logo: '/logos/afc-bournemouth.png' },
  { name: 'Brentford', slug: 'brentford', logo: '/logos/brentford.png' },
  { name: 'Brighton & Hove Albion', slug: 'brighton-hove-albion', logo: '/logos/brighton-hove-albion.png' },
  { name: 'Burnley', slug: 'burnley', logo: '/logos/burnley.png' },
  { name: 'Chelsea', slug: 'chelsea', logo: '/logos/chelsea.png' },
  { name: 'Crystal Palace', slug: 'crystal-palace', logo: '/logos/crystal-palace.png' },
  { name: 'Everton', slug: 'everton', logo: '/logos/everton.png' },
  { name: 'Fulham', slug: 'fulham', logo: '/logos/fulham.png' },
  { name: 'Leeds United', slug: 'leeds-united', logo: '/logos/leeds-united.png' },
  { name: 'Liverpool', slug: 'liverpool', logo: '/logos/liverpool.png' },
  { name: 'Manchester City', slug: 'manchester-city', logo: '/logos/manchester-city.png' },
  { name: 'Manchester United', slug: 'manchester-united', logo: '/logos/manchester-united.png' },
  { name: 'Newcastle United', slug: 'newcastle-united', logo: '/logos/newcastle-united.png' },
  { name: 'Nottingham Forest', slug: 'nottingham-forest', logo: '/logos/nottingham-forest.png' },
  { name: 'Sunderland', slug: 'sunderland', logo: '/logos/sunderland.png' },
  { name: 'Tottenham Hotspur', slug: 'tottenham-hotspur', logo: '/logos/tottenham-hotspur.png' },
  { name: 'West Ham United', slug: 'west-ham-united', logo: '/logos/west-ham-united.png' },
  { name: 'Wolverhampton Wanderers', slug: 'wolverhampton-wanderers', logo: '/logos/wolverhampton-wanderers.png' },
];

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
    port: Number(DB_PORT),
    database: DB_NAME,
  });

  try {
    await conn.query('CREATE TABLE IF NOT EXISTS `teams` (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, slug VARCHAR(60) NOT NULL UNIQUE, logo VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');

    for (const t of TEAMS) {
      await conn.query('INSERT IGNORE INTO teams (name, slug, logo) VALUES (?, ?, ?)', [t.name, t.slug, t.logo || null]);
    }
    console.log('[seed:teams] Done.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error('[seed:teams] Failed:', e); process.exit(1); });
