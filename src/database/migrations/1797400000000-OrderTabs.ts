import { MigrationInterface, QueryRunner } from 'typeorm';

/** Cuentas por mesa: los pedidos de una mesa se juntan hasta cobrarlos, con propina. */
export class OrderTabs1797400000000 implements MigrationInterface {
  name = 'OrderTabs1797400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "order_tab_status" AS ENUM ('open', 'closed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "order_tabs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "table_id" uuid,
        "table_name" character varying(60) NOT NULL,
        "status" "order_tab_status" NOT NULL DEFAULT 'open',
        "currency" character(3) NOT NULL,
        "bill_requested_at" TIMESTAMP WITH TIME ZONE,
        "subtotal" numeric(12,2),
        "tip" numeric(12,2) NOT NULL DEFAULT 0,
        "payment_method" "payment_method",
        "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "closed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_order_tabs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_tabs_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_tabs_table" FOREIGN KEY ("table_id") REFERENCES "menu_tables"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_order_tabs_business_status" ON "order_tabs" ("business_id", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_order_tabs_open_table" ON "order_tabs" ("table_id") WHERE "status" = 'open'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" ADD "tab_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_tab" FOREIGN KEY ("tab_id") REFERENCES "order_tabs"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_tab_id" ON "orders" ("tab_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_orders_tab_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_tab"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "tab_id"`);
    await queryRunner.query(`DROP TABLE "order_tabs"`);
    await queryRunner.query(`DROP TYPE "order_tab_status"`);
  }
}
