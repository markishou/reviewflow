/**
 * Auth Middleware — JWT Session Token Management
 * 
 * Issues and validates ReviewFlow session tokens (JWTs).
 * 
 * Flow:
 * 1. User logs in via GitHub OAuth
 * 2. Auth-callback Lambda issues a ReviewFlow JWT
 * 3. Frontend stores the JWT and sends it with every API request
 * 4. Protected Lambdas validate the JWT using this middleware
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import crypto from 'crypto';
import { warn } from './logger.mjs'

let jwtSecret = null;

async function getJwtSecret() {
    if (jwtSecret) return jwtSecret;

    const client = new SecretsManagerClient({ region: 'us-east-1' });
    const response = await client.send(
        new GetSecretValueCommand({ SecretId: 'reviewflow/jwt-secret' })
    );

    jwtSecret = response.SecretString;
    return jwtSecret;
}

/**
 * Base64url encode (URL-safe base64 without padding)
 */
function base64url(data) {
    if (typeof data === 'string') {
        data = Buffer.from(data);
    }

    return data.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Base64url decode
 */
function base64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * Sign a JWT token with HMAC-SHA256
 * We implement this manually to avoid needing the jsonwebtoken npm package.
 */
export async function signToken(payload, expireInSeconds = 86400) {
    const secret = await getJwtSecret();

    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const fullPayload = {
        ...payload,
        iat: now,
        exp: now + expireInSeconds,
    };

    const headerEncoded = base64url(JSON.stringify(header));
    const payloadEncoded = base64url(JSON.stringify(fullPayload));
    const signingInput = `${headerEncoded}.${payloadEncoded}`;

    const signature = crypto
        .createHmac('sha256', secret)
        .update(signingInput)
        .digest();
    
    return `${signingInput}.${base64url(signature)}`;
}

/**
 * Verify and decode a JWT token
 * Returns the decoded payload if valid, null if invalid/expired.
 */
export async function verifyToken(token) {
    if (!token) return null;

    // Remove "Bearer " prefix if present
    if (token.startsWith('Bearer ')) {
        token = token.slice(7);
    }

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
        const secret = await getJwtSecret();

        // Verify signature
        const signingInput = `${parts[0]}.${parts[1]}`;
        const expectedSig = crypto
            .createHmac('sha256', secret)
            .update(signingInput)
            .digest();

        const actualSig = Buffer.from(
            parts[2].replace(/-/g, '+').replace(/_/g, '/') + '==',
            'base64'
        );

        if (!crypto.timingSafeEqual(expectedSig, actualSig)) {
            return null;
        }

        // Decode and check expiry
        const payload = JSON.parse(base64urlDecode(parts[1]));

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * Middleware: Extract and validate the JWT from an API Gateway event.
 * Returns the decoded user payload or null.
 */
export async function authenticateRequest(event) {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader) {
        return null;
    }

    const payload = await verifyToken(authHeader);

    if (!payload) {
        warn('Invalid or expired session token');
    }

    return payload;
}

/**
 * Helper: Build a 401 Unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
    return {
        statusCode: 401,
        headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: false, error: message })
    };
}