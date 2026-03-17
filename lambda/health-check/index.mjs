import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
const { Pool } = pg;

let pool = null;

async function getConnectionString() {
    const client = new SecretsManagerClient({ region: 'us-east-1' });
    const command = new GetSecretValueCommand({
        SecretId: 'reviewflow/neon-connection-string'
    });
    const response = await client.send(command);
    return response.SecretString;
}

async function getPool() {
    if (pool) return pool;

    const connectionString = await getConnectionString();

    pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
        console.error('Pool error:', err.message);
        pool = null;
    });

    return pool;
}

export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const checks = {
        lambda: 'ok',
        database: 'unknown',
        timestamp: new Date().toISOString(),
        region: process.env.AWS_REGION || 'unkown'
    };

    try {
        const dbPool = await getPool();
        const result = await dbPool.query(
            'SELECT NOW() as server_time, current_database() as db_name'
        );
        checks.database = 'ok';
        checks.db_server_time = result.rows[0].server_time;
        checks.db_name = result.rows[0].db_name;

        const tableResult = await dbPool.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' ORDER BY table_name
        `);
        checks.tables = tableResult.rows.map(r => r.table_name);

    } catch (err) {
        checks.database = 'error';
        checks.db_error = err.message;
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: checks })
    };
};