import { MigrationInterface, QueryRunner } from 'typeorm';

/** Última dirección de entrega del cliente, para precargarla. */
export class CustomerAddress1797100000000 implements MigrationInterface {
  name = 'CustomerAddress1797100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "address" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "address_reference" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "address_reference"`,
    );
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "address"`);
  }
}
