import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renombra el concepto "store" a "business" en tablas, columnas, tipos,
 * índices y restricciones. Solo usa RENAME, así que conserva los datos.
 */
const TABLES: Array<[string, string]> = [
  ['stores', 'businesses'],
  ['store_members', 'business_members'],
  ['store_profiles', 'business_profiles'],
  ['store_invitations', 'business_invitations'],
];

/** [tabla nueva, columna vieja, columna nueva] */
const COLUMNS: Array<[string, string, string]> = [
  ['business_members', 'store_id', 'business_id'],
  ['business_profiles', 'store_id', 'business_id'],
  ['business_invitations', 'store_id', 'business_id'],
];

const TYPES: Array<[string, string]> = [
  ['store_role', 'business_role'],
  ['store_feature', 'business_feature'],
];

const INDEXES: Array<[string, string]> = [
  ['idx_store_members_user_id', 'idx_business_members_user_id'],
  ['idx_store_invitations_store_id', 'idx_business_invitations_business_id'],
];

/**
 * [tabla nueva, restricción vieja, restricción nueva]. Los nombres con hash
 * los genera TypeORM a partir de tabla y columnas, por eso cambian.
 */
const CONSTRAINTS: Array<[string, string, string]> = [
  // business_profiles.business_id -> businesses
  [
    'business_profiles',
    'FK_dabe5b05f9fda04880d9a599e17',
    'FK_3d5311aa214e5b6034286d09b41',
  ],
  // business_members.business_id -> businesses
  [
    'business_members',
    'FK_ca3fefdd99c1f2714119479c28c',
    'FK_123f737f36b33e71fe0b3028fdc',
  ],
  // business_members.user_id -> users
  [
    'business_members',
    'FK_e9a006e2fe10bd3fb7b0fad33d1',
    'FK_7a8eebc9f4792ffdc2d350643fe',
  ],
  // business_invitations.business_id -> businesses
  [
    'business_invitations',
    'FK_6d7871a79a3e0bed52f20b2fcf6',
    'FK_be825ea9419529b47aa6cbbaee2',
  ],
  // business_invitations.invited_by_id -> users
  [
    'business_invitations',
    'FK_3d7609a64e5c599c8c2d20be316',
    'FK_f117fde993d41e8662dffa4e2a9',
  ],
  // business_invitations.accepted_by_id -> users
  [
    'business_invitations',
    'FK_740eaa31f59a52bf10195c40830',
    'FK_1c8b1da6e79f94ad981ec997a31',
  ],
  [
    'business_members',
    'uq_store_members_store_user',
    'uq_business_members_business_user',
  ],
];

export class RenameStoreToBusiness1795033001155 implements MigrationInterface {
  name = 'RenameStoreToBusiness1795033001155';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of TABLES) {
      await queryRunner.query(`ALTER TABLE "${from}" RENAME TO "${to}"`);
    }
    for (const [table, from, to] of COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`,
      );
    }
    for (const [from, to] of TYPES) {
      await queryRunner.query(
        `ALTER TYPE "public"."${from}" RENAME TO "${to}"`,
      );
    }
    for (const [from, to] of INDEXES) {
      await queryRunner.query(
        `ALTER INDEX "public"."${from}" RENAME TO "${to}"`,
      );
    }
    for (const [table, from, to] of CONSTRAINTS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME CONSTRAINT "${from}" TO "${to}"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of [...CONSTRAINTS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME CONSTRAINT "${to}" TO "${from}"`,
      );
    }
    for (const [from, to] of [...INDEXES].reverse()) {
      await queryRunner.query(
        `ALTER INDEX "public"."${to}" RENAME TO "${from}"`,
      );
    }
    for (const [from, to] of [...TYPES].reverse()) {
      await queryRunner.query(
        `ALTER TYPE "public"."${to}" RENAME TO "${from}"`,
      );
    }
    for (const [table, from, to] of [...COLUMNS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "${to}" TO "${from}"`,
      );
    }
    for (const [from, to] of [...TABLES].reverse()) {
      await queryRunner.query(`ALTER TABLE "${to}" RENAME TO "${from}"`);
    }
  }
}
