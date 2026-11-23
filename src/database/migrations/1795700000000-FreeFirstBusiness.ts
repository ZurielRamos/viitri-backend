import { MigrationInterface, QueryRunner } from 'typeorm';

export class FreeFirstBusiness1795700000000 implements MigrationInterface {
  name = 'FreeFirstBusiness1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "free_business_claimed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "free_basic" boolean NOT NULL DEFAULT false`,
    );
    // Para quien ya tenía negocios: el más antiguo que posee es el gratis.
    await queryRunner.query(`
      WITH first_owned AS (
        SELECT DISTINCT ON (m.user_id) m.user_id, b.id AS business_id, b.created_at
        FROM business_members m
        JOIN businesses b ON b.id = m.business_id
        WHERE m.role = 'owner'
        ORDER BY m.user_id, b.created_at
      )
      UPDATE businesses SET free_basic = true
      FROM first_owned
      WHERE businesses.id = first_owned.business_id AND businesses.plan = 'basic'
    `);
    await queryRunner.query(`
      UPDATE users SET free_business_claimed_at = first_owned.created_at
      FROM (
        SELECT m.user_id, MIN(b.created_at) AS created_at
        FROM business_members m
        JOIN businesses b ON b.id = m.business_id
        WHERE m.role = 'owner'
        GROUP BY m.user_id
      ) AS first_owned
      WHERE users.id = first_owned.user_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "free_basic"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "free_business_claimed_at"`,
    );
  }
}
