import { MigrationInterface, QueryRunner } from 'typeorm';

/** Agenda: ajustes de citas, profesionales y citas. */
export class Bookings1797200000000 implements MigrationInterface {
  name = 'Bookings1797200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "booking_status" AS ENUM ('pending', 'confirmed', 'completed', 'no_show', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "booking_source" AS ENUM ('customer', 'staff')`,
    );
    await queryRunner.query(`
      CREATE TABLE "booking_settings" (
        "business_id" uuid NOT NULL,
        "slot_interval_minutes" integer NOT NULL DEFAULT 30,
        "min_notice_minutes" integer NOT NULL DEFAULT 60,
        "max_days_ahead" integer NOT NULL DEFAULT 30,
        "requires_approval" boolean NOT NULL DEFAULT false,
        "use_business_hours" boolean NOT NULL DEFAULT true,
        "hours" jsonb NOT NULL DEFAULT '[]',
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_settings" PRIMARY KEY ("business_id"),
        CONSTRAINT "FK_booking_settings_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`
      CREATE TABLE "booking_professionals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "name" character varying(80) NOT NULL,
        "service_ids" uuid array NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_professionals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_professionals_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_booking_professionals_business" ON "booking_professionals" ("business_id", "sort_order")`,
    );
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "number" integer NOT NULL,
        "status" "booking_status" NOT NULL,
        "source" "booking_source" NOT NULL,
        "item_id" uuid,
        "service_name" character varying(160) NOT NULL,
        "duration_minutes" integer NOT NULL,
        "buffer_minutes" integer NOT NULL DEFAULT 0,
        "price_type" character varying(20) NOT NULL,
        "price" numeric(12,2) NOT NULL,
        "currency" character(3) NOT NULL,
        "professional_id" uuid,
        "professional_name" character varying(80),
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "blocked_until" TIMESTAMP WITH TIME ZONE NOT NULL,
        "customer_id" uuid,
        "contact_name" character varying(120) NOT NULL,
        "contact_phone" character varying(32),
        "notes" character varying(500),
        "cancel_reason" character varying(300),
        "tracking_token_hash" character(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "uq_bookings_business_number" UNIQUE ("business_id", "number"),
        CONSTRAINT "FK_bookings_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bookings_item" FOREIGN KEY ("item_id") REFERENCES "catalog_items"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_bookings_professional" FOREIGN KEY ("professional_id") REFERENCES "booking_professionals"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_bookings_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_bookings_business_starts" ON "bookings" ("business_id", "starts_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bookings_professional" ON "bookings" ("professional_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bookings_customer" ON "bookings" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_bookings_tracking" ON "bookings" ("tracking_token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TABLE "booking_professionals"`);
    await queryRunner.query(`DROP TABLE "booking_settings"`);
    await queryRunner.query(`DROP TYPE "booking_source"`);
    await queryRunner.query(`DROP TYPE "booking_status"`);
  }
}
