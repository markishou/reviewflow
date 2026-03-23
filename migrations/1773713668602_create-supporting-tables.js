/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    // ── pr_tags ──
    pgm.createTable('pr_tags', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        pr_id: { type: 'varchar(255)', notNull: true, references: '"prs"', onDelete: 'CASCADE' },
        tag: { type: 'varchar(100)', notNull: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
    });
    pgm.addConstraint('pr_tags', 'unique_pr_tag', { unique: ['pr_id', 'tag'] });
    pgm.createIndex('pr_tags', 'pr_id');
    pgm.createIndex('pr_tags', 'tag');

    // ── pr_files ──
    pgm.createTable('pr_files', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        pr_id: { type: 'varchar(255)', notNull: true, references: '"prs"', onDelete: 'CASCADE' },
        file_path: { type: 'text', notNull: true },
        lines_added: { type: 'integer', default: 0 },
        lines_deleted: { type: 'integer', default: 0 },
        is_critical: { type: 'boolean', default: false },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
    });
    pgm.createIndex('pr_files', 'pr_id');
    pgm.createIndex('pr_files', 'file_path');

    // ── review_assignments ──
    pgm.createTable('review_assignments', {
        assignment_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        pr_id: { type: 'varchar(255)', notNull: true, references: '"prs"', onDelete: 'CASCADE' },
        reviewer_id: { type: 'uuid', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        assigned_by: { type: 'varchar(50)', default: "'auto'" },
        assignment_reason: { type: 'text' },
        status: { type: 'varchar(50)', notNull: true, default: "'pending'" },
        assigned_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        started_at: { type: 'timestamp' },
        completed_at: { type: 'timestamp' },
        time_to_complete_minutes: { type: 'integer' },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
    });
    pgm.createIndex('review_assignments', ['reviewer_id', 'status']);
    pgm.createIndex('review_assignments', 'pr_id');

    // ── user_file_expertise ──
    pgm.createTable('user_file_expertise', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        user_id: { type: 'uuid', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        file_path: { type: 'text', notNull: true },
        times_modified: { type: 'integer', default: 1 },
        last_modified_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
    });
    pgm.addConstraint('user_file_expertise', 'unique_user_file', { unique: ['user_id', 'file_path'] });
    pgm.createIndex('user_file_expertise', 'user_id');
    pgm.createIndex('user_file_expertise', 'file_path');

    // ── team_analytics_daily ──
    pgm.createTable('team_analytics_daily', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        team_id: { type: 'uuid', notNull: true, references: '"teams"', onDelete: 'CASCADE' },
        date: { type: 'date', notNull: true },
        total_prs_opened: { type: 'integer', default: 0 },
        total_prs_merged: { type: 'integer', default: 0 },
        total_prs_closed: { type: 'integer', default: 0 },
        avg_review_time_minutes: { type: 'decimal(10,2)' },
        total_reviews_completed: { type: 'integer', default: 0 },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
    });
    pgm.addConstraint('team_analytics_daily', 'unique_team_date', { unique: ['team_id', 'date'] });
    pgm.createIndex('team_analytics_daily', ['team_id', { name: 'date', sort: 'DESC' }]);

    // ── updated_at trigger function ──
    pgm.sql(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
        END;
        $$ language 'plpgsql';
    `);

    pgm.sql('CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
    pgm.sql('CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
    pgm.sql('CREATE TRIGGER update_prs_updated_at BEFORE UPDATE ON prs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {};
