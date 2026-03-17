/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    pgm.createTable("prs", {
        pr_id: {
            type: "varchar(255)",
            primaryKey: true,
            comment: "Format: owner/repo#123",
        },
        team_id: {
            type: "uuid",
            notNull: true,
            references: '"teams"',
            onDelete: "CASCADE",
        },
        repository: {
            type: "varchar(255)",
            notNull: true,
        },
        pr_number: {
            type: "integer",
            notNull: true,
        },
        title: {
            type: "text",
            notNull: true,
        },
        author_github_username: {
            type: "varchar(255)",
            notNull: true,
        },
        author_user_id: {
            type: "uuid",
            references: '"users"',
            onDelete: "SET NULL",
        },
        state: {
            type: "varchar(50)",
            notNull: true,
            default: "'open'",
        }, 
        priority: {
            type: "varchar(20)",
            notNull: true,
            default: "'medium'",
        },
        lines_added: { type: "integer", default: 0 },
        lines_deleted: { type: "integer", default: 0 },
        files_changed: { type: "integer", default: 0 },
        complexity_score: {
            type: "decimal(3,1)",
            default: 0,
        },
        test_coverage: {
            type: "decimal(5,2)",
        },
        estimated_review_time: {
            type: "integer",
        },
        github_url: {
            type: "text",
            notNull: true,
        },
        github_created_at: {
            type: "timestamp",
            notNull: true,
        },
        created_at: {
            type: "timestamp",
            notNull: true,
            default: pgm.func("NOW()"),
        },
        updated_at: {
            type: "timestamp",
            notNull: true,
            default: pgm.func("NOW()"),
        },
        assigned_at: { type: "timestamp" },
        first_review_at: { type: "timestamp" },
        merged_at: { type: "timestamp" },
        closed_at: { type: "timestamp" },
  });

    pgm.createIndex("prs", [
        "team_id",
        "state",
        { name: "github_created_at", sort: "DESC" },
    ]);
    pgm.createIndex("prs", ["repository", "state"]);
    pgm.createIndex("prs", ["priority", "state"]);
    pgm.createIndex("prs", "author_user_id");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('prs');
};
