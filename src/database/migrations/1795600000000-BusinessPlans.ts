import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessPlans1795600000000 implements MigrationInterface {
  name = 'BusinessPlans1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "plan" character varying(10) NOT NULL DEFAULT 'basic'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "plan"`);
  }
}
