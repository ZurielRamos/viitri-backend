import { MigrationInterface, QueryRunner } from 'typeorm';

/** Si la categoría aparece en la barra de categorías de la tienda. */
export class CategoryShowInBar1796700000000 implements MigrationInterface {
  name = 'CategoryShowInBar1796700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" ADD "show_in_bar" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" DROP COLUMN "show_in_bar"`,
    );
  }
}
