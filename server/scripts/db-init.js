const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function main({ reset = process.argv.includes('--reset') } = {}) {
  if (reset) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  await pool.query(fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8'));
}

if (require.main === module) {
  main().then(() => { console.log('Schéma initialisé.'); return pool.end(); }).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = main;
