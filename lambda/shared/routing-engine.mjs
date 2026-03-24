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

import { info, warn } from "./logger.mjs";

/**
 * Find the best reviewer for a PR using a weighted scoring algorithm.
 *
 * The SQL query uses CTEs (Common Table Expressions) to calculate three
 * sub-scores per team member, then combines them into a total score.
 */
export async function findBestReviewer(dbPool, prId, teamId, authorUserId) {
    info("Finding best reviewer", { pr_id: prId, team_id: teamId });

    // Get file paths and tags for this PR
    const filesResult = await dbPool.query(
        "SELECT file_path FROM pr_files WHERE pr_id = $1",
        [prId],
    );
    const filePaths = filesResult.rows.map((r) => r.file_path);

    const tagsResult = await dbPool.query(
        "SELECT tag FROM pr_tags WHERE pr_id = $1",
        [prId],
    );
    const tags = tagsResult.rows.map((r) => r.tag);

    // Main reviewer matching query
    const query = `
            WITH reviewer_workload AS (
            SELECT 
                reviewer_id,
                COUNT(*) as current_queue_depth
            FROM review_assignments
            WHERE status = 'pending'
            GROUP BY reviewer_id
            ),
            reviewer_file_expertise AS (
            SELECT 
                ufe.user_id,
                SUM(ufe.times_modified) as expertise_score
            FROM user_file_expertise ufe
            WHERE ufe.file_path = ANY($1)
            GROUP BY ufe.user_id
            ),
            reviewer_tag_match AS (
            SELECT 
                u.user_id,
                CASE 
                WHEN u.expertise_areas IS NOT NULL AND ARRAY_LENGTH(u.expertise_areas, 1) > 0 
                THEN (
                    SELECT COUNT(*) 
                    FROM unnest(u.expertise_areas) AS exp_tag 
                    WHERE exp_tag = ANY($2::text[])
                )
                ELSE 0 
                END as tag_match_count
            FROM users u
            WHERE u.team_id = $3
            )
            SELECT 
            u.user_id,
            u.display_name,
            u.github_username,
            COALESCE(rw.current_queue_depth, 0) as queue_depth,
            COALESCE(rfe.expertise_score, 0) as file_expertise,
            COALESCE(rtm.tag_match_count, 0) as tag_matches,
            (
                COALESCE(rfe.expertise_score, 0) * 0.5 +
                COALESCE(rtm.tag_match_count, 0) * 3.0 +
                (10 - LEAST(COALESCE(rw.current_queue_depth, 0), 10)) * 0.3
            ) as total_score
            FROM users u
            LEFT JOIN reviewer_workload rw ON u.user_id = rw.reviewer_id
            LEFT JOIN reviewer_file_expertise rfe ON u.user_id = rfe.user_id
            LEFT JOIN reviewer_tag_match rtm ON u.user_id = rtm.user_id
            WHERE u.team_id = $3
            AND u.is_active = true
            AND u.user_id != $4
            ORDER BY total_score DESC, queue_depth ASC
            LIMIT 5;
        `;

    const result = await dbPool.query(query, [
        filePaths,
        tags,
        teamId,
        authorUserId || "00000000-0000-0000-0000-000000000000",
    ]);

    if (result.rows.length === 0) {
        warn("No available reviewers found", { pr_id: prId, team_id: teamId });
        return null;
    }

    const bestReviewer = result.rows[0];

    // Build assignment reason
    const reasons = [];
    if (bestReviewer.file_expertise > 0) {
        reasons.push(`file expertise score: ${bestReviewer.file_expertise}`);
    }
    if (bestReviewer.tag_matches > 0) {
        reasons.push(`${bestReviewer.tag_matches} matching expertise tag(s)`);
    }
    reasons.push(`queue depth: ${bestReviewer.queue_depth}`);

    const assignmentReason = reasons.join(", ");

    info("Best reviewer found", {
        pr_id: prId,
        reviewer: bestReviewer.github_username,
        total_score: bestReviewer.total_score,
        file_expertise: bestReviewer.file_expertise,
        tag_matches: bestReviewer.tag_matches,
        queue_depth: bestReviewer.queue_depth,
        reason: assignmentReason,
        candidates: result.rows.length,
    });

    return {
        reviewer: bestReviewer,
        reason: assignmentReason,
        allCandidates: result.rows,
    };
}

/**
 * Create a review assignment record and update the PR.
 */
export async function assignReviewer(dbPool, prId, reviewerId, reason, assignedBy = "auto") {
    info("Assigning reviewer", { pr_id: prId, reviewer_id: reviewerId, assigned_by: assignedBy,});
    
    // Create the assignment
    const result = await dbPool.query(`
        INSERT INTO review_assignments (pr_id, reviewer_id, assigned_by, assignment_reason, status)
        VALUES ($1, $2, $3, $4, 'pending')
        ON CONFLICT DO NOTHING
        RETURNING assignment_id
    `, [prId, reviewerId, assignedBy, reason]);

    if (result.rows.length === 0) {
        warn('Assignment already exists or failed', { pr_id: prId, reviewer_id: reviewerId });
        return null;
    }

    // Update PR state to show it's been assigned
    await dbPool.query(`
        UPDATE prs SET 
        state = CASE WHEN state = 'open' THEN 'in_review' ELSE state END,
        assigned_at = COALESCE(assigned_at, NOW())
        WHERE pr_id = $1
    `, [prId]);

    info('Reviewer assigned', {
        pr_id: prId,
        assignment_id: result.rows[0].assignment_id,
        reviewer_id: reviewerId
    });

    return result.rows[0].assignment_id;
}

/**
 * Full routing pipeline: find best reviewer and assign them.
 * Called after PR analysis completes.
 */
export async function routePr(dbPool, prId, teamId, authorUserId) {
    info("Starting PR routing", { pr_id: prId });

    const match = await findBestReviewer(dbPool, prId, teamId, authorUserId);

    if (!match) {
        warn("No reviewer found, PR left unassigned", { pr_id: prId });
        return null;
    }

    const assignmentId = await assignReviewer(dbPool, prId, match.reviewer.user_id, match.reason, 'auto');

    return {
        assignmentId,
        reviewer: match.reviewer,
        reason: match.reason,
        allCandidates: match.allCandidates
    };
}
