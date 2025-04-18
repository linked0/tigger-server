import mysql from 'mysql2/promise';

const DATABASE_NAME = 'devswap9';
const connectionConfig = {
  host: '127.0.0.1',
  user: 'devswap_user',
  password: 'password',
  port: 3306,
  multipleStatements: true
};

async function initDatabase() {
  try {
    const connection = await mysql.createConnection(connectionConfig);
    console.log('[Init] Connected to MySQL');

    // Create the database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DATABASE_NAME}\`;`);
    console.log(`[Init] Database "${DATABASE_NAME}" is ready`);

    // Optional: Select the database if you want to continue doing things
    await connection.changeUser({ database: DATABASE_NAME });

    // Optional: Run migrations, seed data, etc. here

    await connection.end();
    console.log('[Init] Done. Closing connection.');

  } catch (err) {
    console.error('[Init] Error:', err);
    process.exit(1);
  }
}

initDatabase();
