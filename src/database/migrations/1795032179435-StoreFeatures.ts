import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reemplaza el modo fijo de la tienda (`mode`) por una lista de features
 * activables (`features`). El modo existente se convierte en su feature
 * equivalente: digital_menu -> menu, store -> ecommerce, bookings -> bookings.
 */
export class StoreFeatures1795032179435 implements MigrationInterface {
  name = 'StoreFeatures1795032179435';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."store_feature" AS ENUM('menu', 'ecommerce', 'bookings')`,
    );
    await queryRunner.query(
      `ALTER TABLE "stores" ADD "features" "public"."store_feature" array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`
      UPDATE "stores" SET "features" = ARRAY[
        CASE "mode"
          WHEN 'digital_menu' THEN 'menu'
          WHEN 'store' THEN 'ecommerce'
          WHEN 'bookings' THEN 'bookings'
        END
      ]::"public"."store_feature"[]
    `);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "mode"`);
    await queryRunner.query(`DROP TYPE "public"."store_mode"`);
  }

  /**
   * Al revertir, cada tienda vuelve a un solo modo: el de su primer feature
   * según la prioridad menu > ecommerce > bookings, o `store` si no tiene.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."store_mode" AS ENUM('store', 'digital_menu', 'bookings')`,
    );
    await queryRunner.query(
      `ALTER TABLE "stores" ADD "mode" "public"."store_mode"`,
    );
    await queryRunner.query(`
      UPDATE "stores" SET "mode" = (CASE
        WHEN 'menu' = ANY("features") THEN 'digital_menu'
        WHEN 'ecommerce' = ANY("features") THEN 'store'
        WHEN 'bookings' = ANY("features") THEN 'bookings'
        ELSE 'store'
      END)::"public"."store_mode"
    `);
    await queryRunner.query(
      `ALTER TABLE "stores" ALTER COLUMN "mode" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "features"`);
    await queryRunner.query(`DROP TYPE "public"."store_feature"`);
  }
}
