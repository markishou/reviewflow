import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import { info, warn, withLogging } from './shared/logger.mjs';
import { authenticateRequest, unauthorizedResponse } from './shared/auth.mjs';
const { Pool } = pg;

let pool = null;

async function getPool() {
    if (pool) return pool;

    const client = new SecretsManagerClient({ region: 'us-east-1' });
    const response = await client.send(
        new GetSecretValueCommand({ SecretId: 'reviewflow/neon-connection-string' })
    );

    pool = new Pool({
        connectionString: response.SecretString,
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

async function handlerFn(event) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    // Authenticate the request
    const user = await authenticateRequest(event);
    if (!user) {
        return unauthorizedResponse('Invalid or missing session token');
    }

    const params = event.queryStringParameters || {};
    const state = params.state || null;
    const priority = params.priority || null;
    const limit = Math.min(parseInt(params.limit) || 50, 100);

    const dbPool = await getPool();

    // Build dynamic query
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (state) {
        conditions.push(`p.state = $${paramIndex}`);
        values.push(state);
        paramIndex++;
    }

    if (priority) {
        conditions.push(`p.priority = $${paramIndex}`);
        values.push(priority);
        paramIndex++;
    }

    // Get team_id — prefer JWT, fall back to database lookup
    let teamId = user.team_id;
    if (!teamId) {
        const userResult = await dbPool.query(
        'SELECT team_id FROM users WHERE user_id = $1',
        [user.user_id]
        );
        teamId = userResult.rows[0]?.team_id || null;
    }

    // No team = no PRs
    if (!teamId) {
        info('User has no team, returning empty results', { user_id: user.user_id });
        return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: { prs: [], total: 0 } })
        };
    }

    conditions.push(`p.team_id = $${paramIndex}`);
    values.push(teamId);
    paramIndex++;

    info('Team filter applied', { 
        jwt_team_id: user.team_id, 
        db_team_id: teamId, 
        conditions: conditions,
        values: values
    });


    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const priorityOrder = `
        CASE p.priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        END
    `;

    try {
        const result = await dbPool.query(`
        SELECT 
            p.*,
            COALESCE(
            (SELECT json_agg(t.tag) FROM pr_tags t WHERE t.pr_id = p.pr_id),
            '[]'::json
            ) as tags,
            COALESCE(
            (SELECT u.github_username 
            FROM review_assignments ra 
            JOIN users u ON ra.reviewer_id = u.user_id 
            WHERE ra.pr_id = p.pr_id AND ra.status != 'reassigned'
            LIMIT 1),
            NULL
            ) as assigned_reviewer
        FROM prs p
        ${whereClause}
        ORDER BY ${priorityOrder}, p.github_created_at DESC
        LIMIT $${paramIndex}
        `, [...values, limit]);

        const countResult = await dbPool.query(
        `SELECT COUNT(*) as total FROM prs p ${whereClause}`,
        values
        );

        info('PRs fetched', {
            count: result.rows.length,
            total: parseInt(countResult.rows[0].total),
            filters: { state, priority }
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                prs: result.rows,
                total: parseInt(countResult.rows[0].total)
                }
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
}

export const handler = withLogging(handlerFn);