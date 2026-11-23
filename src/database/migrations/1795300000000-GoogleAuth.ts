import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleAuth1795300000000 implements MigrationInterface {
  name = 'GoogleAuth1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "google_sub" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_google_sub" ON "users" ("google_sub") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_users_google_sub"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "google_sub"`);
  }
}
