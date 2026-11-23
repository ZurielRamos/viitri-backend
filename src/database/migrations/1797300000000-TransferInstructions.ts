import { MigrationInterface, QueryRunner } from 'typeorm';

/** Datos para transferir (Nequi, cuenta…), que ve el cliente al pagar. */
export class TransferInstructions1797300000000 implements MigrationInterface {
  name = 'TransferInstructions1797300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_settings" ADD "transfer_instructions" character varying(300)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_settings" DROP COLUMN "transfer_instructions"`,
    );
  }
}
