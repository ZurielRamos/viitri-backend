import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfileAbout1795800000000 implements MigrationInterface {
  name = 'ProfileAbout1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "specialties" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "service_modes" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "payment_methods" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "founded_year" smallint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'founded_year',
      'payment_methods',
      'service_modes',
      'specialties',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "business_profiles" DROP COLUMN "${column}"`,
      );
    }
  }
}
