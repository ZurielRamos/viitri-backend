import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhoneAuth1795200000000 implements MigrationInterface {
  name = 'PhoneAuth1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone" character varying(15)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_phone" ON "users" ("phone") `,
    );
    // Las cuentas creadas con WhatsApp no tienen contraseña.
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "ttl_entries" ("key" character varying(255) NOT NULL, "value" jsonb NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_ttl_entries" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ttl_entries_expires_at" ON "ttl_entries" ("expires_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ttl_entries"`);
    // Falla si ya hay cuentas sin contraseña: hay que resolverlas antes.
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "uq_users_phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
  }
}
