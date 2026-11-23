import { MigrationInterface, QueryRunner } from 'typeorm';

/** Cómo se muestran los productos de cada categoría: fila deslizable, lista o cuadrícula. */
export class CategoryDisplayMode1796600000000 implements MigrationInterface {
  name = 'CategoryDisplayMode1796600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" ADD "display_mode" character varying(20) NOT NULL DEFAULT 'list'`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" ADD CONSTRAINT "chk_catalog_categories_display_mode" CHECK ("display_mode" IN ('carousel', 'list', 'grid'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" DROP CONSTRAINT "chk_catalog_categories_display_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" DROP COLUMN "display_mode"`,
    );
  }
}
