import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo general: los productos pasan a ser elementos (`catalog_items`) de
 * tipo producto, servicio o plan, con el precio y el stock en variantes. Las
 * tablas de productos estaban vacías, así que se reemplazan sin copiar datos.
 *
 * `order_items` (que cambia `product_id` por `item_id` y `variant_id`) no
 * tiene migración propia todavía: la de menú y pedidos está pendiente.
 */
export class CatalogItems1796200000000 implements MigrationInterface {
  name = 'CatalogItems1796200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "catalog_product_option_groups"`);
    await queryRunner.query(`DROP TABLE "catalog_products"`);

    await queryRunner.query(
      `CREATE TABLE "catalog_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "kind" character varying(20) NOT NULL DEFAULT 'product',
        "category_id" uuid,
        "name" character varying(160) NOT NULL,
        "description" text,
        "price_type" character varying(20) NOT NULL DEFAULT 'fixed',
        "image_urls" jsonb NOT NULL DEFAULT '[]',
        "sort_order" integer NOT NULL DEFAULT '0',
        "is_active" boolean NOT NULL DEFAULT true,
        "is_available" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "chk_catalog_items_kind" CHECK ("kind" IN ('product', 'service', 'plan')),
        CONSTRAINT "chk_catalog_items_price_type" CHECK ("price_type" IN ('fixed', 'from', 'free', 'on_request')),
        CONSTRAINT "pk_catalog_items" PRIMARY KEY ("id"),
        CONSTRAINT "fk_catalog_items_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_catalog_items_category" FOREIGN KEY ("category_id") REFERENCES "catalog_categories"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_items_business_category" ON "catalog_items" ("business_id", "category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_items_business_kind" ON "catalog_items" ("business_id", "kind")`,
    );

    await queryRunner.query(
      `CREATE TABLE "catalog_variants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "item_id" uuid NOT NULL,
        "name" character varying(80),
        "price" numeric(12,2) NOT NULL,
        "compare_at_price" numeric(12,2),
        "sku" character varying(64),
        "stock" integer,
        "is_available" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT '0',
        CONSTRAINT "chk_catalog_variants_stock" CHECK ("stock" IS NULL OR "stock" >= 0),
        CONSTRAINT "pk_catalog_variants" PRIMARY KEY ("id"),
        CONSTRAINT "fk_catalog_variants_item" FOREIGN KEY ("item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_variants_item_id" ON "catalog_variants" ("item_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "catalog_item_option_groups" (
        "item_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "sort_order" integer NOT NULL DEFAULT '0',
        CONSTRAINT "pk_catalog_item_option_groups" PRIMARY KEY ("item_id", "group_id"),
        CONSTRAINT "fk_catalog_item_option_groups_item" FOREIGN KEY ("item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_catalog_item_option_groups_group" FOREIGN KEY ("group_id") REFERENCES "catalog_option_groups"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_item_option_groups_group_id" ON "catalog_item_option_groups" ("group_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "catalog_service_details" (
        "item_id" uuid NOT NULL,
        "duration_minutes" integer NOT NULL,
        "buffer_minutes" integer NOT NULL DEFAULT '0',
        CONSTRAINT "chk_catalog_service_details_minutes" CHECK ("duration_minutes" > 0 AND "buffer_minutes" >= 0),
        CONSTRAINT "pk_catalog_service_details" PRIMARY KEY ("item_id"),
        CONSTRAINT "fk_catalog_service_details_item" FOREIGN KEY ("item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "catalog_plan_details" (
        "item_id" uuid NOT NULL,
        "interval" character varying(10) NOT NULL DEFAULT 'month',
        "interval_count" integer NOT NULL DEFAULT '1',
        "trial_days" integer NOT NULL DEFAULT '0',
        CONSTRAINT "chk_catalog_plan_details_values" CHECK ("interval" IN ('week', 'month', 'year') AND "interval_count" >= 1 AND "trial_days" >= 0),
        CONSTRAINT "pk_catalog_plan_details" PRIMARY KEY ("item_id"),
        CONSTRAINT "fk_catalog_plan_details_item" FOREIGN KEY ("item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "catalog_plan_benefits" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_item_id" uuid NOT NULL,
        "label" character varying(160) NOT NULL,
        "included_item_id" uuid,
        "quantity" integer,
        "sort_order" integer NOT NULL DEFAULT '0',
        CONSTRAINT "chk_catalog_plan_benefits_quantity" CHECK ("quantity" IS NULL OR "quantity" >= 1),
        CONSTRAINT "pk_catalog_plan_benefits" PRIMARY KEY ("id"),
        CONSTRAINT "fk_catalog_plan_benefits_plan" FOREIGN KEY ("plan_item_id") REFERENCES "catalog_plan_details"("item_id") ON DELETE CASCADE,
        CONSTRAINT "fk_catalog_plan_benefits_included_item" FOREIGN KEY ("included_item_id") REFERENCES "catalog_items"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_plan_benefits_plan_item_id" ON "catalog_plan_benefits" ("plan_item_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "catalog_plan_benefits"`);
    await queryRunner.query(`DROP TABLE "catalog_plan_details"`);
    await queryRunner.query(`DROP TABLE "catalog_service_details"`);
    await queryRunner.query(`DROP TABLE "catalog_item_option_groups"`);
    await queryRunner.query(`DROP TABLE "catalog_variants"`);
    await queryRunner.query(`DROP TABLE "catalog_items"`);
    await queryRunner.query(
      `CREATE TABLE "catalog_products" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "business_id" uuid NOT NULL, "category_id" uuid, "name" character varying(160) NOT NULL, "description" text, "price" numeric(12,2) NOT NULL, "image_urls" jsonb NOT NULL DEFAULT '[]', "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "is_available" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9f7a978657257a0bb575a174f0a" PRIMARY KEY ("id"), CONSTRAINT "FK_50adc3e3dd3b770a8296cf45f2b" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE, CONSTRAINT "FK_32bf2e1749252a75bf50b18c887" FOREIGN KEY ("category_id") REFERENCES "catalog_categories"("id") ON DELETE SET NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_products_business_category" ON "catalog_products" ("business_id", "category_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "catalog_product_option_groups" ("product_id" uuid NOT NULL, "group_id" uuid NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_fa7064bd09b3e86cce865b0defe" PRIMARY KEY ("product_id", "group_id"), CONSTRAINT "FK_b8ea256c75110bd15f9e2e7656d" FOREIGN KEY ("product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE, CONSTRAINT "FK_7743cca21cd25e8b393a58d4a30" FOREIGN KEY ("group_id") REFERENCES "catalog_option_groups"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_product_option_groups_group_id" ON "catalog_product_option_groups" ("group_id")`,
    );
  }
}
