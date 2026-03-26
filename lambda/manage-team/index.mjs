import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import { info, warn, error, withLogging } from './shared/logger.mjs';
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

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: ''
        };
    }

    // Authenticate
    const user = await authenticateRequest(event);
    if (!user) {
        return unauthorizedResponse('Invalid or missing session token');
    }

    const dbPool = await getPool();
    const path = event.path || '';
    const method = event.httpmMethod;

    try {
        // POST /api/teams — Create a team
        if (method === 'POST' && path.endsWith('/teams')) {
            let body;
            try {
                body = JSON.parse(event.body);
            } catch {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid JSON body' }) };
            }

            const teamName = body.team_name;
            const githubOrg = body.github_org;

            if (!teamName || !githubOrg) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'team_name and github_org are required' }) };
            }

            // Create the team
            const teamResult = await dbPool.query(
                'INSERT INTO teams (team_name, github_org) VALUES ($1, $2) RETURNING team_id, team_name, github_org',
                [teamName, githubOrg]
            );

            const team = teamResult.rows[0];

            // Assign the user to the team
            await dbPool.query(
                'UPDATE users SET team_id = $1 WHERE user_id = $2',
                [team.team_id, user.user_id]
            );

            info('Team created and user assigned', {
                team_id: team.team_id,
                team_name: teamName,
                user_id: user.user_id
            });

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ success: true, data: { team } })
            };
        }

        // POST /api/teams/repos — Connect a repo to the team
        if (method === 'POST' && path.endsWith('/repos')) {
            // Look up the user's team
            const userResult = await dbPool.query(
                'SELECT team_id FROM users WHERE user_id = $1',
                [user.user_id]
            );

            const teamId = userResult.rows[0]?.team_id;
            if (!teamId) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'You must create or join a team first' }) };
            }

            let body;
            try {
                body = JSON.parse(event.body);
            } catch {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid JSON body' }) };
            }

            const repoFullName = body.repository_full_name;
            if (!repoFullName || !repoFullName.includes('/')) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'repository_full_name is required (format: owner/repo)' }) };
            }

            // Connect the repo
            const repoResult = await dbPool.query(`
                INSERT INTO team_repositories (team_id, repository_full_name, is_active)
                VALUES ($1, $2, true)
                ON CONFLICT (team_id, repository_full_name) DO UPDATE SET is_active = true
                RETURNING *
            `, [teamId, repoFullName]);

            info('Repository connected to team', {
                team_id: teamId,
                repository: repoFullName
            });

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ success: true, data: { repository: repoResult.rows[0] } })
            };
        }

        // GET /api/teams/me — Get user's team info
        if (method === 'GET' && path.endsWith('/me')) {
            const result = await dbPool.query(`
                SELECT t.team_id, t.team_name, t.github_org,
                (SELECT json_agg(json_build_object(
                    'repository_full_name', tr.repository_full_name,
                    'is_active', tr.is_active
                )) FROM team_repositories tr WHERE tr.team_id = t.team_id AND tr.is_active = true) as repos,
                (SELECT json_agg(json_build_object(
                    'user_id', u2.user_id,
                    'github_username', u2.github_username,
                    'display_name', u2.display_name
                )) FROM users u2 WHERE u2.team_id = t.team_id AND u2.is_active = true) as members
                FROM users u
                JOIN teams t ON u.team_id = t.team_id
                WHERE u.user_id = $1
            `, [user.user_id]);

            if (result.rows.length === 0) {
                return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: { team: null } })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: { team: result.rows[0] } })
            };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'Not found' }) };
    } catch (error) {
        error('Team management error', { error: err.message });
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
    }
}

export const handler = withLogging(handlerFn);