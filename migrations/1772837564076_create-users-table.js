/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    pgm.createTable('users', {
        user_id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        github_username: {
            type: 'varchar(255)',
            notNull: true,
            unique: true
        },
        github_user_id: {
            type: 'varchar(255)',
            notNull: true,
            unique: true
        },
        email: { type: 'varchar(255)' },
        display_name: { type: 'varchar(255)' },
        avatar_url: { type: 'text' },
        expertise_areas: {
            type: 'text[]',
            comment: 'PostgreSQL array of expertise tags, e.g. {backend,auth,payments}'
        },
        team_id: {
            type: 'uuid',
            references: '"teams"',
            onDelete: 'SET NULL'
        },
        is_active: { type: 'boolean', default: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
    });
    pgm.createIndex('users', 'team_id');
    pgm.createIndex('users', 'github_username');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('users');
};
