import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notificaciones push: los celulares con los avisos activos en cada tienda
 * (del equipo o de clientes) y, por persona del equipo, si recibe los de
 * pedidos y reservas.
 */
export class PushNotifications1798400000000 implements MigrationInterface {
  name = 'PushNotifications1798400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "push_devices" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "endpoint" character varying(1000) NOT NULL,
      "p256dh" character varying(200) NOT NULL,
      "auth" character varying(100) NOT NULL,
      "business_id" uuid NOT NULL,
      "user_id" uuid,
      "customer_id" uuid,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "pk_push_devices" PRIMARY KEY ("id"),
      CONSTRAINT "fk_push_devices_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
      CONSTRAINT "fk_push_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
      CONSTRAINT "fk_push_devices_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_push_devices_endpoint" ON "push_devices" ("endpoint")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_push_devices_business_id" ON "push_devices" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_push_devices_user_id" ON "push_devices" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_push_devices_customer_id" ON "push_devices" ("customer_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_members" ADD "notify_orders" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_members" DROP COLUMN "notify_orders"`,
    );
    await queryRunner.query(`DROP TABLE "push_devices"`);
  }
}
