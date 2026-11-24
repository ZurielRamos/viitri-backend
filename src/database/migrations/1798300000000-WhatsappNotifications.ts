import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Avisos por WhatsApp: enlaces cortos para los botones de las plantillas,
 * el enlace de seguimiento de pedidos y reservas, y las marcas para no
 * repetir el aviso al dueño ni el recordatorio de la reserva.
 */
export class WhatsappNotifications1798300000000 implements MigrationInterface {
  name = 'WhatsappNotifications1798300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "short_links" (
      "code" character varying(16) NOT NULL,
      "url" character varying(1000) NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "pk_short_links" PRIMARY KEY ("code")
    )`);
    await queryRunner.query(
      `CREATE INDEX "idx_short_links_expires_at" ON "short_links" ("expires_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "tracking_link_code" character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "owner_alerted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "tracking_link_code" character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "reminded_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "reminded_at"`);
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "tracking_link_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "owner_alerted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "tracking_link_code"`,
    );
    await queryRunner.query(`DROP TABLE "short_links"`);
  }
}
