import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enlace legible de cada elemento: {slug}.dominio/producto/{slug}. Los que ya
 * existen reciben el nombre en minúsculas y, para no repetir, el inicio de su id.
 */
export class ItemSlug1796400000000 implements MigrationInterface {
  name = 'ItemSlug1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_items" ADD "slug" character varying(100)`,
    );
    await queryRunner.query(
      `UPDATE "catalog_items"
          SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')) || '-' || left("id"::text, 6)`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_items" ALTER COLUMN "slug" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_catalog_items_business_slug" ON "catalog_items" ("business_id", "slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_catalog_items_business_slug"`);
    await queryRunner.query(`ALTER TABLE "catalog_items" DROP COLUMN "slug"`);
  }
}
