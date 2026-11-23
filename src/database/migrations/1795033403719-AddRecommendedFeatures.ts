import { MigrationInterface, QueryRunner } from 'typeorm';

const BASE_FEATURES = ['menu', 'ecommerce', 'bookings'];

const NEW_FEATURES = [
  'promotions',
  'loyalty',
  'gift_cards',
  'reviews',
  'table_reservations',
  'memberships',
  'events',
  'waitlist',
  'quotes',
];

export class AddRecommendedFeatures1795033403719 implements MigrationInterface {
  name = 'AddRecommendedFeatures1795033403719';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const feature of NEW_FEATURES) {
      await queryRunner.query(
        `ALTER TYPE "public"."business_feature" ADD VALUE '${feature}'`,
      );
    }
  }

  /**
   * Postgres no permite quitar valores de un enum: se recrea el tipo sin los
   * features nuevos y antes se quitan de los negocios que los tengan activos.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const removeAll = NEW_FEATURES.reduce(
      (expr, f) => `array_remove(${expr}, '${f}')`,
      '"features"',
    );
    await queryRunner.query(
      `UPDATE "businesses" SET "features" = ${removeAll}`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."business_feature_old" AS ENUM(${BASE_FEATURES.map((f) => `'${f}'`).join(', ')})`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ALTER COLUMN "features" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ALTER COLUMN "features" TYPE "public"."business_feature_old"[] USING "features"::text[]::"public"."business_feature_old"[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ALTER COLUMN "features" SET DEFAULT '{}'`,
    );
    await queryRunner.query(`DROP TYPE "public"."business_feature"`);
    await queryRunner.query(
      `ALTER TYPE "public"."business_feature_old" RENAME TO "business_feature"`,
    );
  }
}
