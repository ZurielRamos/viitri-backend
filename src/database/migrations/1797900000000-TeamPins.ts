import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Equipo con PIN: perfiles sin correo ni celular que pertenecen a un solo
 * negocio, el enlace del equipo y quién tomó o atendió cada pedido.
 */
export class TeamPins1797900000000 implements MigrationInterface {
  name = 'TeamPins1797900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "team_business_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pin_lookup" character(64)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_team_pin" ON "users" ("team_business_id", "pin_lookup")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "session_version" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_team_business_id" ON "users" ("team_business_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "fk_users_team_business" FOREIGN KEY ("team_business_id") REFERENCES "businesses"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "team_key" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD CONSTRAINT "uq_businesses_team_key" UNIQUE ("team_key")`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "taken_by_name" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "handled_by_name" character varying(120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "handled_by_name"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "taken_by_name"`);
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP CONSTRAINT "uq_businesses_team_key"`,
    );
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "team_key"`);
    // Los perfiles del equipo no tienen correo: no caben en el esquema anterior.
    await queryRunner.query(
      `DELETE FROM "users" WHERE "team_business_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "fk_users_team_business"`,
    );
    await queryRunner.query(`DROP INDEX "idx_users_team_business_id"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "session_version"`,
    );
    await queryRunner.query(`DROP INDEX "uq_users_team_pin"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "pin_lookup"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "team_business_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`,
    );
  }
}
