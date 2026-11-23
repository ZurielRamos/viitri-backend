import { MigrationInterface, QueryRunner } from 'typeorm';

/** Funcionalidades que dejan de ofrecerse al enfocarse en restaurantes y bares. */
const RETIRED = [
  'ecommerce',
  'quotes',
  'bookings',
  'memberships',
  'gift_cards',
  'promotions',
];

/**
 * El producto se enfoca en restaurantes, comidas rápidas, bares y similares.
 * Se apagan las funcionalidades retiradas en los negocios que las tenían
 * (sus datos, como servicios y citas, se conservan) y los tipos de negocio
 * que ya no existen pasan a restaurante.
 */
export class FocusOnFood1797700000000 implements MigrationInterface {
  name = 'FocusOnFood1797700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const feature of RETIRED) {
      await queryRunner.query(
        `UPDATE "businesses" SET "features" = array_remove("features", $1::"business_feature") WHERE $1::"business_feature" = ANY("features")`,
        [feature],
      );
    }
    await queryRunner.query(
      `UPDATE "businesses" SET "business_type" = 'restaurant' WHERE "business_type" IN ('store', 'beauty', 'gym', 'classes')`,
    );
  }

  public async down(): Promise<void> {
    // No se sabe qué negocio tenía cada funcionalidad ni su tipo anterior.
  }
}
