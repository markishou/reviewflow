/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    // Enable UUID generation function in PostgreSQL
    pgm.sql('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    pgm.createTable('teams', {
        team_id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()')
        },
        team_name: { type: 'varchar(255)', notNull: true },
        github_org: { type: 'varchar(255)' },
        settings: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
    })

    pgm.createIndex('teams', 'github_org');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('teams');
};
