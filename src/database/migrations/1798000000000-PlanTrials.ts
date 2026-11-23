import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prueba gratis y pago de los planes. Los pedidos pasan a Avanzado y la
 * reserva de mesas a Pro: los negocios que ya existen reciben 14 días de
 * prueba del plan que necesitan para no perder nada de golpe, y los que ya
 * estaban en un plan de pago (asignado a mano) quedan pagados un mes.
 */
export class PlanTrials1798000000000 implements MigrationInterface {
  name = 'PlanTrials1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "trial_ends_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "paid_until" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "businesses" SET "paid_until" = now() + interval '30 days' WHERE "plan" <> 'basic'`,
    );
    await queryRunner.query(
      `UPDATE "businesses"
         SET "plan" = CASE WHEN 'table_reservations' = ANY("features") THEN 'pro' ELSE 'advanced' END,
             "trial_ends_at" = now() + interval '14 days'
       WHERE "plan" = 'basic' AND 'menu' = ANY("features")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "businesses" SET "plan" = 'basic' WHERE "trial_ends_at" IS NOT NULL AND "paid_until" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "paid_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "trial_ends_at"`,
    );
  }
}
