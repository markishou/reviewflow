import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import https from 'https';
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
        console.error('Pool error:', err.message);
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

export const handler = async (event) => {
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

    console.log('[AUTH] GitHub OAuth callback received');

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
            console.error('[AUTH] Token exchange failed:', tokenData);
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({success: false, error: 'Failed to authenticate with Github' })
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

        console.log('[AUTH] GitHub user fetched:', githubUser.login)

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
        console.log('[AUTH] User upserted:', user.user_id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                user: {
                    user_id: user.user_id,
                    github_username: user.github_username,
                    display_name: user.display_name,
                    avatar_url: user.avatar_url,
                    email: user.email,
                    team_id: user.team_id
                },
                github_token: tokenData.access_token
            })
        };
    } catch (err) {
        console.error('[AUTH] OAuth flow failed:', err.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Authentication failed' })
        }
    }
};
