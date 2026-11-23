import { MigrationInterface, QueryRunner } from 'typeorm';

/** Borrado lógico de productos, servicios y planes. */
export class ItemSoftDelete1796800000000 implements MigrationInterface {
  name = 'ItemSoftDelete1796800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_items" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog_items" DROP COLUMN "deleted_at"`,
    );
  }
}
