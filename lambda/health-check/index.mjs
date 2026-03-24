import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import { info, error, withLogging } from './shared/logger.mjs';
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
        error('Pool error', { error: err.message });
        pool = null;
    });

    return pool;
}

async function handlerFn(event) {
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

        info('Health check passed', { database: 'ok', table_count: checks.tables.length });

    } catch (err) {
        checks.database = 'error';
        checks.db_error = err.message;
        error('Health check database failed', { error: err.message });
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: checks })
    };
};

export const handler = withLogging(handlerFn);