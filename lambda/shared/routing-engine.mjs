/**
 * Routing Engine — Intelligent Reviewer Assignment
 * 
 * Finds the best reviewer for a PR based on:
 * 1. File expertise (who has modified these files before)
 * 2. Tag matching (whose expertise_areas match the PR's tags)
 * 3. Workload balancing (who has the fewest pending reviews)
 * 
 * Falls back to round-robin if no expertise data exists.
 */

import { info, warn } from './logger.mjs';

/**
 * Find the best reviewer for a PR using a weighted scoring algorithm.
 * 
 * The SQL query uses CTEs (Common Table Expressions) to calculate three
 * sub-scores per team member, then combines them into a total score.
 */
export async function findBestReviewer(dbPool, prId, teamId, authorUserId) {
    info('Finding best reviewer', { pr_id: prId, team_id: teamId });
}

/**
 * Create a review assignment record and update the PR.
 */
export async function assignReviewer(dbPool, prId, reviewerId, reason, assignedBy = 'auto') {
    info('Assigning reviewer', { pr_id: prId, reviewer_id: reviewerId, assigned_by: assignedBy });
}

/**
 * Full routing pipeline: find best reviewer and assign them.
 * Called after PR analysis completes.
 */
export async function routePr(dbPool, prId, teamId, authorUserId) {
    info('Starting PR routing', { pr_id: prId });

    const match = await findBestReviewer(dbPool, prId, teamId, authorUserId);

    if (!match) {
        warn('No reviewer found, PR left unassigned', { pr_id: prId });
        return null;
    }

    // assignReviewer call

    return null
}