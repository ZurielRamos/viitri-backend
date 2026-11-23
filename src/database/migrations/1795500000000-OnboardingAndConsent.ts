import { MigrationInterface, QueryRunner } from 'typeorm';

export class OnboardingAndConsent1795500000000 implements MigrationInterface {
  name = 'OnboardingAndConsent1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "terms_accepted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "marketing_opt_in_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "referral_source" character varying(20)`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "acquisition" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "onboarded_at" TIMESTAMP WITH TIME ZONE`,
    );
    // Quien ya tenía cuenta no pasa por la bienvenida.
    await queryRunner.query(`UPDATE "users" SET "onboarded_at" = "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "business_type" character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "business_type"`,
    );
    for (const column of [
      'onboarded_at',
      'acquisition',
      'referral_source',
      'marketing_opt_in_at',
      'terms_accepted_at',
    ]) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "${column}"`);
    }
  }
}
