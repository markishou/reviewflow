import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pg from 'pg';
import crypto from 'crypto';
import { analyzePr } from './shared/pr-analyzer.mjs';
import { routPr } from './shared/routing-engine.mjs';
import { info, warn, error, withLogging } from './shared/logger.mjs';
const { Pool } = pg;


let pool = null;
let webhookSecret = null;

async function getWebhookSecret() {
    if (webhookSecret) return webhookSecret;

    const client = new SecretsManagerClient({ region: 'us-east-1' });
    const response = await client.send(
        new GetSecretValueCommand({ SecretId: 'reviewflow/github-webhook-secret' })
    );
    webhookSecret = response.SecretString;
    return webhookSecret;
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

function validateSignature(payload, signature, secret) {
    if (!signature || !secret) return false;

    const expected = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf-8')
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
        );
    } catch {
        return false;
  }
}

async function handlerFn(event) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    // Parse webhook headers (API Gateway lowercases them)
    const githubEvent = event.headers?.['x-github-event'] || event.headers?.['X-GitHub-Event'];
    const deliveryId = event.headers?.['x-github-delivery'] || event.headers?.['X-GitHub-Delivery'];
    const signature = event.headers?.['x-hub-signature-256'] || event.headers?.['X-Hub-Signature-256'];

    if (!githubEvent) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing X-GitHub-Event header' })
        };
    }

    // Validate webhook signature
    const secret = await getWebhookSecret();
    if (!validateSignature(event.body, signature, secret)) {
        error('Invalid webhook signature', { deliveryId });
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid webhook signature' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
        };
    }

    info('Webhook event received', { event: githubEvent, action: body.action, deliveryId });

    // Handle ping event (sent when webhook is first created)
    if (githubEvent === 'ping') {
        info('Ping received — webhook is active', { zen: body.zen });
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'pong', zen: body.zen })
        };
    }

    // Only handle pull_request events for now
    if (githubEvent !== 'pull_request') {
        info('Ignoring non-PR event', { event: githubEvent });
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Event ignored', event: githubEvent })
        };
    }

    const pr = body.pull_request;
    const repo = body.repository;

    if (!pr || !repo) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing PR or repository data' })
        };
    }

    const prId = `${repo.full_name}#${pr.number}`;
    const dbPool = await getPool();

    try {
        switch (body.action) {
            case 'opened':
            case 'reopened':
                await handlePrOpened(dbPool, prId, pr, repo);
                break;
            case 'synchronize':
                await handlePrUpdated(dbPool, prId, pr);
                break;
            case 'closed':
                await handlePrClosed(dbPool, prId, pr);
                break;
            default:
                info('Unhandled PR action', { action: body.action });
        }
    } catch (err) {
        error('Error processing webhook', { error: err.message });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Failed to process webhook' })
        };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, pr_id: prId, action: body.action })
    };
};

async function handlePrOpened(dbPool, prId, pr, repo) {
    info('Processing PR opened', { pr_id: prId });

    // Find the team for this repo
    const teamResult = await dbPool.query(
        'SELECT team_id FROM team_repositories WHERE repository_full_name = $1 AND is_active = true',
        [repo.full_name]
    );

    if (teamResult.rows.length === 0) {
        warn('No team found for repo', { repository: repo.full_name });
        return;
    }

    const teamId = teamResult.rows[0].team_id;

    // Look up author in our system
    const authorResult = await dbPool.query(
        'SELECT user_id FROM users WHERE github_username = $1',
        [pr.user.login]
    );
    const authorUserId = authorResult.rows.length > 0 ? authorResult.rows[0].user_id : null;

    // Upsert the PR
    await dbPool.query(`
        INSERT INTO prs (
        pr_id, team_id, repository, pr_number, title,
        author_github_username, author_user_id, state, priority,
        lines_added, lines_deleted, files_changed,
        github_url, github_created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (pr_id) DO UPDATE SET
        title = EXCLUDED.title,
        state = 'open',
        lines_added = EXCLUDED.lines_added,
        lines_deleted = EXCLUDED.lines_deleted,
        files_changed = EXCLUDED.files_changed
    `, [
        prId, teamId, repo.full_name, pr.number, pr.title,
        pr.user.login, authorUserId, 'open', 'medium',
        pr.additions || 0, pr.deletions || 0, pr.changed_files || 0,
        pr.html_url, pr.created_at
    ]);

    info('PR stored', { pr_id: prId });

    // Analyze the PR
    const [owner, repoName] = repo.full_name.split('/');
    try {
        await analyzePr(dbPool, prId, owner, repoName, pr.number, null);
    } catch (err) {
        warn('PR analysis failed (non-fatal)', { error: err.message });
    }

    // Route the PR to a reviewer
    try {
        await routPr(dbPool, prId, teamId, authorUserId);
    } catch (err) {
        warn('PR routing failed (non-fatal)', { pr_id: prId, error: err.message });
    }
}

async function handlePrUpdated(dbPool, prId, pr) {
    info('Processing PR updated', { pr_id: prId });

    await dbPool.query(`
        UPDATE prs SET
        title = $2, lines_added = $3, lines_deleted = $4, files_changed = $5
        WHERE pr_id = $1
    `, [prId, pr.title, pr.additions || 0, pr.deletions || 0, pr.changed_files || 0]);
}

async function handlePrClosed(dbPool, prId, pr) {
    const newState = pr.merged ? 'merged' : 'closed';
    info('Processing PR closed', { pr_id: prId, new_state: newState });

    const updateFields = pr.merged
        ? 'state = $2, merged_at = NOW(), closed_at = NOW()'
        : 'state = $2, closed_at = NOW()';

    await dbPool.query(
        `UPDATE prs SET ${updateFields} WHERE pr_id = $1`,
        [prId, newState]
    );
}

export const handler = withLogging(handlerFn);