import { MigrationInterface, QueryRunner } from 'typeorm';

/** Promociones por horario (happy hour) y la promoción aplicada en cada producto del pedido. */
export class Promotions1797600000000 implements MigrationInterface {
  name = 'Promotions1797600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalog_promotions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "name" character varying(60) NOT NULL,
        "percent" integer NOT NULL,
        "days" integer array NOT NULL,
        "start_time" character varying(5) NOT NULL,
        "end_time" character varying(5) NOT NULL,
        "category_ids" uuid array NOT NULL DEFAULT '{}',
        "item_ids" uuid array NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_promotions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_catalog_promotions_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_promotions_business" ON "catalog_promotions" ("business_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "promotion_name" character varying(80)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN "promotion_name"`,
    );
    await queryRunner.query(`DROP TABLE "catalog_promotions"`);
  }
}
