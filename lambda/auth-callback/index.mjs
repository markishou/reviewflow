import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import https from 'https';
import { info, warn, error, withLogging } from './shared/logger.mjs';
import { signToken } from './shared/auth.mjs';
const { Pool } = pg;

let pool = null;
let githubCredentials = null;

async function getGitHubCredentials() {
    if (githubCredentials) return githubCredentials;

    const client = new SecretsManagerClient({ region: 'us-east-1' });
    const response = await client.send(
        new GetSecretValueCommand({ SecretId: 'reviewflow/github-oauth' })
    );
    githubCredentials = JSON.parse(response.SecretString);
    return githubCredentials;
}

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

function httpsRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function handlerFn(event) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const code = event.queryStringParameters?.code;

    if (!code) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing authorization code' })
        }
    }

    info('GitHub OAuth callback received');

    try {
        // Step 1: Get GitHub OAuth credentials from Secrets Manager
        const creds = await getGitHubCredentials();

        // Step 2: Exchange code for access token
        const tokenData = await httpsRequest({
            hostname: 'github.com',
            path: '/login/oauth/access_token',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'ReviewFlow/1.0'
            }
        }, JSON.stringify({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            code
        }));

        if (!tokenData.access_token) {
            warn('Token exchange failed', { tokenData: tokenData });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return {
                statusCode: 302,
                headers: { 'Location': `${frontendUrl}?auth_error=token_exchange_failed` },
                body: ''
            };
        }

        // Step 3: Fetch user profile from GitHub
        const githubUser = await httpsRequest({
            hostname: 'api.github.com',
            path: '/user',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'ReviewFlow/1.0'
            }
        });

        info('GitHub user fetched', { githubUser: githubUser.login });

        // Step 4: Upsert user in database
        const dbPool = await getPool();
        const result = await dbPool.query(`
            INSERT INTO users (
                github_username, github_user_id, email, display_name, avatar_url
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (github_user_id) DO UPDATE SET
                github_username = EXCLUDED.github_username,
                email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                avatar_url = EXCLUDED.avatar_url
            RETURNING *
            `, [
            githubUser.login,
            String(githubUser.id),
            githubUser.email,
            githubUser.name || githubUser.login,
            githubUser.avatar_url
        ]);

        const user = result.rows[0];
        info('User upserted', { user_id: user.user_id});

        // Step 4: Generate a ReviewFlow session token (JWT)
        const sessionToken = await signToken({
            user_id: user.user_id,
            github_username: user.github_username,
            team_id: user.team_id || null,
        });

        // Step 6: Redirect back to frontend with user data
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // Encode user data as a base64 JSON string for the URL
        const userData = Buffer.from(JSON.stringify({
        user: {
            user_id: user.user_id,
            github_username: user.github_username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            email: user.email,
            team_id: user.team_id
        },
        session_token: sessionToken,
        github_token: tokenData.access_token
        })).toString('base64');

        return {
            statusCode: 302,
            headers: {
                'Location': `${frontendUrl}?auth=${encodeURIComponent(userData)}`,
                'Cache-Control': 'no-cache'
            },
            body: ''
        };
    } catch (err) {
        error('OAuth flow failed', { error: err.message });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return {
            statusCode: 302,
            headers: { 'Location': `${frontendUrl}?auth_error=${encodeURIComponent(err.message)}` },
            body: ''
        };
    }
};

export const handler = withLogging(handlerFn);
