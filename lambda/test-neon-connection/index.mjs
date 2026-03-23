import {SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
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
    console.log('Testing Lambda -> Secrets Manager -> Neon connection...');

    try {
        const dbPool = await getPool();

        // Test 1: Basic Connectivity
        const timeResult = await dbPool.query('SELECT NOW() as server_time, current_database() as db_name');
        console.log('Connected to Neon:', timeResult.rows[0]);

        // Test 2: Verify tables exist
        const tableResult = await dbPool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        const tables = tableResult.rows.map(r => r.table_name);
        console.log('Tables found:', tables);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Lambda -> Secrets Manager -> Neon connection verified!',
                database: timeResult.rows[0].db_name,
                server_time: timeResult.rows[0].server_time,
                tables: tables,
                table_count: tables.length
            })
        };
    } catch (error) {
        console.error('Connection test failed:', error.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};