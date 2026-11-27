import { MigrationInterface, QueryRunner } from 'typeorm';

/** Credenciales de los servicios guardadas desde el panel del equipo (cifradas). */
export class PlatformSettings1798500000000 implements MigrationInterface {
  name = 'PlatformSettings1798500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "platform_settings" (
      "key" character varying(64) NOT NULL,
      "value" text NOT NULL,
      "updated_by" uuid,
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "pk_platform_settings" PRIMARY KEY ("key")
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "platform_settings"`);
  }
}
