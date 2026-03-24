/**
 * Structured logging middleware for ReviewFlow Lambda functions.
 * 
 * Produces JSON-formatted logs that are searchable in CloudWatch Logs Insights.
 * Every log entry includes: timestamp, level, message, requestId, function name,
 * and any additional context passed by the caller.
 * 
 */

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

let requestContext = {};

/**
 * Set context for the current Lambda invocation.
 * Call this at the start of every handler.
 */
export function setRequestContext(event, context) {
    requestContext = {
        requestId: context?.awsRequestId || 'local',
        functionName: context?.functionName || 'unknown',
        httpMethod: event?.httpMethod || 'unknown',
        path: event?.path || 'unknown',
        sourceIp: event?.requestContext?.identity?.sourceIp || 'unknown',
        userAgent: event?.headers?.['User-Agent'] || event?.headers?.['user-agent'] || 'unknown'
    };
}

/**
 * Core logging function. Outputs structured JSON to stdout.
 * CloudWatch automatically captures stdout from Lambda.
 */
function log(level, message, data = {}) {
    if (LOG_LEVELS[level] < CURRENT_LEVEL) return;

    // Redact sensitive fields
    const safeData = redactSensitive(data);

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...requestContext,
        ...safeData
    };

    console.log(JSON.stringify(entry));
}

/**
 * Redact sensitive fields from log data.
 * Prevents accidental logging of tokens, passwords, PII, and code content.
 */
function redactSensitive(data) {
    const sensitiveKeys = [
        // Auth & credentials
        'password', 'token', 'secret', 'authorization', 'cookie',
        'access_token', 'client_secret', 'refresh_token',
        // Code content & diffs
        'patch', 'diff', 'content', 'body',
        // PII
        'email', 'ip_address', 'ssn', 'phone'
    ];

    const redacted = {};

    for (const [key, value] of Object.entries(data)) {
        // Check if this key matches a sensitive pattern
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
            if (typeof value === 'string' && value.length > 100) {
                redacted[key] = `[REDACTED - ${value.length} chars]`;
            } else if (typeof value === 'string') {
                redacted[key] = '[REDACTED]';
            } else {
                redacted[key] = '[REDACTED]';
            }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Recursively redact nested objects
            redacted[key] = redactSensitive(value);
        } else {
            redacted[key] = value;
        }
    }

    return redacted;
}

// Convenience methods
export function debug(message, data) { log('DEBUG', message, data); }
export function info(message, data) { log('INFO', message, data); }
export function warn(message, data) { log('WARN', message, data); }
export function error(message, data) { log('ERROR', message, data); }

/**
 * Wrap a Lambda handler with automatic request logging.
 * Logs the start and end of every request with timing.
 */
export function withLogging(handler) {
    return async (event, context) => {
        setRequestContext(event, context);

        info('Request received', {
            queryParams: event.queryStringParameters || {},
        });

        const startTime = Date.now();

        try {
            const result = await handler(event, context);
            const duration = Date.now() - startTime;

            info('Request completed', {
                statusCode: result.statusCode,
                duration_ms: duration
            });

            return result;
        } catch (err) {
            const duration = Date.now() - startTime;

            error('Request failed', {
                error: err.message,
                stack: err.stack,
                duration_ms: duration
            });

            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'Internal server error' })
            };
        }
    };
}