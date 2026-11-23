import { MigrationInterface, QueryRunner } from 'typeorm';

/** Valor del domicilio: fijo o por barrio, y el barrio de cada pedido. */
export class DeliveryZones1797800000000 implements MigrationInterface {
  name = 'DeliveryZones1797800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_settings" ADD "delivery_fee_mode" character varying(12) NOT NULL DEFAULT 'to_confirm'`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_settings" ADD "delivery_fixed_fee" numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_settings" ADD "delivery_zones" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "delivery_zone" character varying(60)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "delivery_zone"`);
    await queryRunner.query(
      `ALTER TABLE "menu_settings" DROP COLUMN "delivery_zones"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_settings" DROP COLUMN "delivery_fixed_fee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_settings" DROP COLUMN "delivery_fee_mode"`,
    );
  }
}
