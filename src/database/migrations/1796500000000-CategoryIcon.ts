import { MigrationInterface, QueryRunner } from 'typeorm';

/** Icono de cada categoría, cuando no tiene foto. */
export class CategoryIcon1796500000000 implements MigrationInterface {
  name = 'CategoryIcon1796500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" ADD "icon" character varying(40)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" DROP COLUMN "icon"`,
    );
  }
}
