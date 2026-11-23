import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoreTheme1796100000000 implements MigrationInterface {
  name = 'StoreTheme1796100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "theme" jsonb NOT NULL DEFAULT '{"preset":"fresh","primary":"#0b5cff","mode":"light","font":"modern","corners":"round"}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP COLUMN "theme"`,
    );
  }
}
