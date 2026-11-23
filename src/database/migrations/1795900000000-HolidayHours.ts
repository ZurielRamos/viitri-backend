import { MigrationInterface, QueryRunner } from 'typeorm';

export class HolidayHours1795900000000 implements MigrationInterface {
  name = 'HolidayHours1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "holiday_hours" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP COLUMN "holiday_hours"`,
    );
  }
}
