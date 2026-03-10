/**
 * Tracks which GitHub repos are connected to each team
 */

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    pgm.createTable('team_repositories', {
        id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        team_id: {
            type: 'uuid',
            notNull: true,
            references: '"teams"',
            onDelete: 'CASCADE'
        },
        repository_full_name: {
            type: 'varchar(255)',
            notNull: true,
            comment: 'Format: owner/repo (e.g. johndoe/reviewflow'
        },
        webhook_id: {
            type: 'varchar(255)',
            comment: 'Github webhook ID for this repo'
        },
        is_active: { type: 'boolean', default: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
    });

    pgm.addConstraint('team_repositories', 'unique_team_repo', {
        unique: ['team_id', 'repository_full_name']
    });
    pgm.createIndex('team_repositories', 'team_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('team_repositories');
};
