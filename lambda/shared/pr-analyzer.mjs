/**
 * PR Analysis Engine — Complexity Scoring & Priority Calculation
 * 
 * Called by the webhook Lambda after a PR is stored.
 * Fetches file details from GitHub, calculates complexity score,
 * determines priority, detects critical files, and stores enriched data.
 */

import https from 'https';
import { info, warn } from './logger.mjs';

// File paths that indicate critical/sensitive code
const CRITICAL_PATH_PATTERNS = [
    /^(src\/)?auth\//i,
    /^(src\/)?security\//i,
    /^(src\/)?payments?\//i,
    /^(src\/)?billing\//i,
    /^(src\/)?core\//i,
    /^(src\/)?middleware\//i,
    /\.env/i,
    /secrets?\./i,
    /config\/(prod|production)/i,
    /migrations?\//i
];

// File extensions that indicate different types of work
const TAG_PATTERNS = {
    docs: [/\.md$/i, /\.txt$/i, /\.rst$/i, /docs?\//i, /README/i],
    tests: [/\.test\./i, /\.spec\./i, /\/__tests__\//i, /test\//i],
    config: [/\.json$/i, /\.ya?ml$/i, /\.toml$/i, /\.env/i, /Dockerfile/i],
    frontend: [/\.jsx$/i, /\.tsx$/i, /\.css$/i, /\.scss$/i, /\.html$/i, /components?\//i],
    backend: [/\.mjs$/i, /\.js$/i, /\.ts$/i, /lambda\//i, /api\//i, /server\//i],
    database: [/migrations?\//i, /\.sql$/i, /schema/i],
    dependencies: [/package\.json$/i, /package-lock\.json$/i, /yarn\.lock$/i]
};

/**
 * Fetch PR file details from GitHub API.
 */
export function fetchPrFiles(owner, repo, prNumber, accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'ReviewFlow/1.0',
                ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const files = JSON.parse(data);
                    if (!Array.isArray(files)) {
                        reject(new Error(`GitHub API error: ${JSON.stringify(files)}`));
                        return;
                    }
                    resolve(files);
                } catch {
                    reject(new Error('Invalid JSON from GitHub API'));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

/**
 * Calculate complexity score for a PR (0.0 to 10.0).
 * 
 * Factors:
 * - Lines changed (more lines = more complex)
 * - Files changed (more files = more context switching)
 * - Critical files touched (auth, payments, etc.)
 * - File type diversity (touching many different types = more complex)
 */
export function calculateComplexity(prData) {
    const { linesAdded, linesDeleted, filesChanged, criticalFileCount, fileTypes } = prData;
    const totalLines = linesAdded + linesDeleted;

    // Lines score: 0-10 based on total lines changed
    // 0-50 lines = low, 50-200 = medium, 200-500 = high, 500+ = very high
    const linesScore = Math.min(totalLines / 500 * 10, 10);

    // Files score: 0-10 based on number of files
    // 1-3 files = low, 3-8 = medium, 8-15 = high, 15+ = very high
    const filesScore = Math.min(filesChanged / 15 * 10, 10);

    // Critical files score: 0-10, each critical file adds 2.5 points
    const criticalScore = Math.min(criticalFileCount * 2.5, 10);

    // Diversity score: 0-10 based on how many different file types are touched
    const uniqueTypes = fileTypes ? new Set(fileTypes).size : 0;
    const diversityScore = Math.min(uniqueTypes / 4 * 10, 10);

    // Weighted average
    const weights = {
        lines: 0.30,
        files: 0.20,
        critical: 0.30,
        diversity: 0.20
    };

    const score = (
        linesScore * weights.lines +
        filesScore * weights.files +
        criticalScore * weights.critical +
        diversityScore * weights.diversity
    );

    // Round to 1 decimal place
    return Math.round(score * 10) / 10;
}

/**
 * Calculate priority based on tags and complexity score.
 * 
 * Priority levels:
 * - critical: security/auth files touched, or complexity > 8
 * - high: complexity > 6, or feature work with critical files
 * - medium: complexity 3-6, or standard feature work
 * - low: docs, deps, small changes, complexity < 3
 */
export function calculatePriority(tags, complexityScore) {
    // Critical: security-sensitive or very complex
    if (tags.includes('security') || tags.includes('auth')) {
        return 'critical';
    }
    if (complexityScore >= 8.0) {
        return 'critical';
    }

    // High: significant complexity or touches critical paths
    if (complexityScore >= 6.0) {
        return 'high';
    }
    if (tags.includes('database') && complexityScore >= 4.0) {
        return 'high';
    }

    // Low: documentation, dependencies, or trivial changes
    if (tags.includes('docs') && !tags.includes('backend') && !tags.includes('frontend')) {
        return 'low';
    }
    if (tags.includes('dependencies') && tags.length === 1) {
        return 'low';
    }
    if (complexityScore < 3.0) {
        return 'low';
    }

    // Medium: everything else
    return 'medium';
}

/**
 * Detect tags based on file paths.
 */
export function detectTags(files) {
    const tags = new Set();

    for (const file of files) {
        const filePath = file.filename || file.file_path || '';

        for (const [tag, patterns] of Object.entries(TAG_PATTERNS)) {
            if (patterns.some(pattern => pattern.test(filePath))) {
                tags.add(tag);
            }
        }

        // Check for security/auth specifically
        if (CRITICAL_PATH_PATTERNS.some(pattern => pattern.test(filePath))) {
            if (/auth/i.test(filePath)) tags.add('auth');
            if (/security/i.test(filePath)) tags.add('security');
            if (/payments?|billing/i.test(filePath)) tags.add('payments');
        }
    }

    return Array.from(tags);
}

/**
 * Check if a file path is critical.
 */
export function isCriticalFile(filePath) {
    return CRITICAL_PATH_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Estimate review time in minutes based on complexity and size.
 */
export function estimateReviewTime(linesAdded, linesDeleted, filesChanged, complexityScore) {
    // Base: ~1 minute per 20 lines changed
    const lineMinutes = (linesAdded + linesDeleted) / 20;

    // Add time for context switching between files
    const fileMinutes = filesChanged * 2;

    // Complexity multiplier: 1.0 for simple, up to 2.0 for very complex
    const complexityMultiplier = 1 + (complexityScore / 10);

    const estimated = (lineMinutes + fileMinutes) * complexityMultiplier;

    // Minimum 5 minutes, maximum 120 minutes
    return Math.max(5, Math.min(Math.round(estimated), 120));
}

/**
 * Full PR analysis pipeline.
 * Fetches files from GitHub, calculates everything, stores in database.
 */
export async function analyzePr(dbPool, prId, owner, repo, prNumber, accessToken) {
    info('Starting PR analysis', { pr_id: prId });

    let files;
    try {
        files = await fetchPrFiles(owner, repo, prNumber, accessToken);
    } catch (err) {
        warn('Failed to fetch PR files from GitHub, using basic analysis', {
        pr_id: prId,
        error: err.message
        });
        return null;
    }

    // Calculate metrics
    let totalAdded = 0;
    let totalDeleted = 0;
    let criticalFileCount = 0;
    const fileTypes = [];

    for (const file of files) {
        totalAdded += file.additions || 0;
        totalDeleted += file.deletions || 0;

        const ext = (file.filename || '').split('.').pop()?.toLowerCase() || 'unknown';
        fileTypes.push(ext);

        if (isCriticalFile(file.filename || '')) {
        criticalFileCount++;
        }
    }

    const complexityScore = calculateComplexity({
        linesAdded: totalAdded,
        linesDeleted: totalDeleted,
        filesChanged: files.length,
        criticalFileCount,
        fileTypes
    });

    const tags = detectTags(files);
    const priority = calculatePriority(tags, complexityScore);
    const reviewTime = estimateReviewTime(totalAdded, totalDeleted, files.length, complexityScore);

    info('PR analysis complete', {
        pr_id: prId,
        complexity_score: complexityScore,
        priority,
        estimated_review_time: reviewTime,
        tags,
        files_analyzed: files.length,
        critical_files: criticalFileCount
    });

    // Update PR with analysis results
    await dbPool.query(`
        UPDATE prs SET
        complexity_score = $2,
        priority = $3,
        estimated_review_time = $4,
        lines_added = $5,
        lines_deleted = $6,
        files_changed = $7
        WHERE pr_id = $1
    `, [prId, complexityScore, priority, reviewTime, totalAdded, totalDeleted, files.length]);

    // Store individual file data
    for (const file of files) {
        await dbPool.query(`
        INSERT INTO pr_files (pr_id, file_path, lines_added, lines_deleted, is_critical)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
        `, [
        prId,
        file.filename,
        file.additions || 0,
        file.deletions || 0,
        isCriticalFile(file.filename || '')
        ]);
    }

    // Store tags
    for (const tag of tags) {
        await dbPool.query(`
        INSERT INTO pr_tags (pr_id, tag)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `, [prId, tag]);
    }

    return { complexityScore, priority, reviewTime, tags, filesAnalyzed: files.length };
}