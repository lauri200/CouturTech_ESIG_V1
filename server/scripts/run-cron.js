const { pool } = require('../src/db');
const { executerAlertes } = require('../src/services/alertes');

executerAlertes().then((r) => { console.log(r); return pool.end(); }).catch((e) => { console.error(e); process.exit(1); });
