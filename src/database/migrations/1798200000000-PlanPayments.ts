import { MigrationInterface, QueryRunner } from 'typeorm';

/** Pagos de los planes con Wompi y los datos de facturación del negocio. */
export class PlanPayments1798200000000 implements MigrationInterface {
  name = 'PlanPayments1798200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD "billing_profile" jsonb`);
    await queryRunner.query(`CREATE TABLE "plan_payments" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "business_id" uuid NOT NULL,
      "plan" character varying(10) NOT NULL,
      "months" integer NOT NULL DEFAULT 1,
      "amount_in_cents" integer NOT NULL,
      "currency" character(3) NOT NULL DEFAULT 'COP',
      "reference" character varying(40) NOT NULL,
      "status" character varying(10) NOT NULL DEFAULT 'pending',
      "wompi_transaction_id" character varying(64),
      "payment_method_type" character varying(40),
      "billing" jsonb NOT NULL,
      "period_start" TIMESTAMP WITH TIME ZONE,
      "period_end" TIMESTAMP WITH TIME ZONE,
      "approved_at" TIMESTAMP WITH TIME ZONE,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "uq_plan_payments_reference" UNIQUE ("reference"),
      CONSTRAINT "pk_plan_payments" PRIMARY KEY ("id"),
      CONSTRAINT "fk_plan_payments_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "idx_plan_payments_business_id" ON "plan_payments" ("business_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "plan_payments"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "billing_profile"`);
  }
}
