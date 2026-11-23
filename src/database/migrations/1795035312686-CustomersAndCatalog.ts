import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomersAndCatalog1795035312686 implements MigrationInterface {
  name = 'CustomersAndCatalog1795035312686';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "catalog_options" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "group_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "price_delta" numeric(12,2) NOT NULL DEFAULT '0', "is_available" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_f709450f07fd9d988511a41d154" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_options_group_id" ON "catalog_options"  ("group_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "catalog_option_groups" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "business_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "min_select" integer NOT NULL DEFAULT '0', "max_select" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_catalog_option_groups_select_range" CHECK ("min_select" >= 0 AND "max_select" >= 1 AND "min_select" <= "max_select"), CONSTRAINT "PK_828b95033f296d96cc16c61cf63" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_option_groups_business_id" ON "catalog_option_groups"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "catalog_categories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "business_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" text, "image_url" character varying(2048), "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e22b0520ebd3477c52ff4307dc2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_categories_business_id" ON "catalog_categories"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "catalog_product_option_groups" ("product_id" uuid NOT NULL, "group_id" uuid NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_fa7064bd09b3e86cce865b0defe" PRIMARY KEY ("product_id", "group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_product_option_groups_group_id" ON "catalog_product_option_groups"  ("group_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "catalog_products" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "business_id" uuid NOT NULL, "category_id" uuid, "name" character varying(160) NOT NULL, "description" text, "price" numeric(12,2) NOT NULL, "image_urls" jsonb NOT NULL DEFAULT '[]', "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "is_available" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9f7a978657257a0bb575a174f0a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_products_business_category" ON "catalog_products"  ("business_id", "category_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "business_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "email" character varying(254), "phone" character varying(16), "password_hash" character varying(255), "registered_at" TIMESTAMP WITH TIME ZONE, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_customers_business_id" ON "customers"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_customers_business_phone" ON "customers"  ("business_id", "phone") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_customers_business_account_email" ON "customers"  ("business_id", "email") WHERE "password_hash" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_options" ADD CONSTRAINT "FK_bd25ff770e6a3eae058475e8ea9" FOREIGN KEY ("group_id") REFERENCES "catalog_option_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_option_groups" ADD CONSTRAINT "FK_e73983d237371e0dd1c6946fd2d" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" ADD CONSTRAINT "FK_7074dcbac8027c9f53838762d3c" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_product_option_groups" ADD CONSTRAINT "FK_b8ea256c75110bd15f9e2e7656d" FOREIGN KEY ("product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_product_option_groups" ADD CONSTRAINT "FK_7743cca21cd25e8b393a58d4a30" FOREIGN KEY ("group_id") REFERENCES "catalog_option_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_products" ADD CONSTRAINT "FK_50adc3e3dd3b770a8296cf45f2b" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_products" ADD CONSTRAINT "FK_32bf2e1749252a75bf50b18c887" FOREIGN KEY ("category_id") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_c04b1ab3076e753f96c64318286" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_c04b1ab3076e753f96c64318286"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_products" DROP CONSTRAINT "FK_32bf2e1749252a75bf50b18c887"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_products" DROP CONSTRAINT "FK_50adc3e3dd3b770a8296cf45f2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_product_option_groups" DROP CONSTRAINT "FK_7743cca21cd25e8b393a58d4a30"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_product_option_groups" DROP CONSTRAINT "FK_b8ea256c75110bd15f9e2e7656d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_categories" DROP CONSTRAINT "FK_7074dcbac8027c9f53838762d3c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_option_groups" DROP CONSTRAINT "FK_e73983d237371e0dd1c6946fd2d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog_options" DROP CONSTRAINT "FK_bd25ff770e6a3eae058475e8ea9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_customers_business_account_email"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_customers_business_phone"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_customers_business_id"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_catalog_products_business_category"`,
    );
    await queryRunner.query(`DROP TABLE "catalog_products"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_catalog_product_option_groups_group_id"`,
    );
    await queryRunner.query(`DROP TABLE "catalog_product_option_groups"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_catalog_categories_business_id"`,
    );
    await queryRunner.query(`DROP TABLE "catalog_categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_catalog_option_groups_business_id"`,
    );
    await queryRunner.query(`DROP TABLE "catalog_option_groups"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_catalog_options_group_id"`,
    );
    await queryRunner.query(`DROP TABLE "catalog_options"`);
  }
}
