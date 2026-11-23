import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoreProfilesAndBookingsMode1795024223377 implements MigrationInterface {
  name = 'StoreProfilesAndBookingsMode1795024223377';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "store_profiles" ("store_id" uuid NOT NULL, "description" text, "logo_url" character varying(2048), "cover_url" character varying(2048), "phone" character varying(16), "whatsapp" character varying(16), "email" character varying(254), "address_line" character varying(255), "city" character varying(120), "region" character varying(120), "postal_code" character varying(20), "country_code" character(2), "latitude" double precision, "longitude" double precision, "currency" character(3) NOT NULL DEFAULT 'USD', "timezone" character varying(64) NOT NULL DEFAULT 'UTC', "opening_hours" jsonb NOT NULL DEFAULT '[]', "social_links" jsonb NOT NULL DEFAULT '{}', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dabe5b05f9fda04880d9a599e17" PRIMARY KEY ("store_id"))`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."store_mode" ADD VALUE 'bookings'`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_profiles" ADD CONSTRAINT "FK_dabe5b05f9fda04880d9a599e17" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Toda tienda existente necesita su perfil (relación 1 a 1).
    await queryRunner.query(
      `INSERT INTO "store_profiles" ("store_id") SELECT "id" FROM "stores"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_profiles" DROP CONSTRAINT "FK_dabe5b05f9fda04880d9a599e17"`,
    );
    // Falla si hay tiendas en modo 'bookings': hay que migrarlas o borrarlas antes de revertir.
    await queryRunner.query(
      `CREATE TYPE "public"."store_mode_old" AS ENUM('store', 'digital_menu')`,
    );
    await queryRunner.query(
      `ALTER TABLE "stores" ALTER COLUMN "mode" TYPE "public"."store_mode_old" USING "mode"::"text"::"public"."store_mode_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."store_mode"`);
    await queryRunner.query(
      `ALTER TYPE "public"."store_mode_old" RENAME TO "store_mode"`,
    );
    await queryRunner.query(`DROP TABLE "store_profiles"`);
  }
}
