import { MigrationInterface, QueryRunner } from 'typeorm';

/** Cuántas veces se puede elegir la misma opción ("Queso extra × 3"). */
export class OptionMaxQuantity1796300000000 implements MigrationInterface {
  name = 'OptionMaxQuantity1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_options" ADD "max_quantity" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_options" ADD CONSTRAINT "chk_catalog_options_max_quantity" CHECK ("max_quantity" >= 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_options" DROP CONSTRAINT "chk_catalog_options_max_quantity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_options" DROP COLUMN "max_quantity"`,
    );
  }
}
