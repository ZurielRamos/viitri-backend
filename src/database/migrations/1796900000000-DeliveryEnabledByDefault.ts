import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Domicilio activo por defecto: ya no requiere tarifas por distancia ni la
 * ubicación del negocio (solo se toma la dirección del cliente).
 */
export class DeliveryEnabledByDefault1796900000000 implements MigrationInterface {
  name = 'DeliveryEnabledByDefault1796900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_settings" ALTER COLUMN "delivery_enabled" SET DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "menu_settings" SET "delivery_enabled" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_settings" ALTER COLUMN "delivery_enabled" SET DEFAULT false`,
    );
  }
}
