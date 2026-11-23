import { MigrationInterface, QueryRunner } from 'typeorm';

/** Pasos confirmados de la configuración asistida de la tienda. */
export class SetupConfirmed1798100000000 implements MigrationInterface {
  name = 'SetupConfirmed1798100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "setup_confirmed" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP COLUMN "setup_confirmed"`,
    );
  }
}
