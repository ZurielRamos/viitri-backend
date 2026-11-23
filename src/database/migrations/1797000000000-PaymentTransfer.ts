import { MigrationInterface, QueryRunner } from 'typeorm';

/** Pago por transferencia (Nequi, Daviplata, Bre-B, cuenta bancaria). */
export class PaymentTransfer1797000000000 implements MigrationInterface {
  name = 'PaymentTransfer1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'transfer'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres no permite quitar un valor de un enum sin recrearlo.
  }
}
