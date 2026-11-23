import { MigrationInterface, QueryRunner } from 'typeorm';

export class GeoCodes1796000000000 implements MigrationInterface {
  name = 'GeoCodes1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "region_code" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD "city_code" character varying(10)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP COLUMN "city_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP COLUMN "region_code"`,
    );
  }
}
