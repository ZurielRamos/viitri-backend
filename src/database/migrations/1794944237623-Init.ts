import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1794944237623 implements MigrationInterface {
  name = 'Init1794944237623';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."platform_role" AS ENUM('super_admin', 'user')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying(254) NOT NULL, "password_hash" character varying(255) NOT NULL, "name" character varying(120) NOT NULL, "platform_role" "public"."platform_role" NOT NULL DEFAULT 'user', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."store_mode" AS ENUM('store', 'digital_menu')`,
    );
    await queryRunner.query(
      `CREATE TABLE "stores" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "slug" character varying(63) NOT NULL, "mode" "public"."store_mode" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_790b2968701a6ff5ff383237765" UNIQUE ("slug"), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."store_role" AS ENUM('owner', 'admin', 'staff')`,
    );
    await queryRunner.query(
      `CREATE TABLE "store_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "store_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."store_role" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_store_members_store_user" UNIQUE ("store_id", "user_id"), CONSTRAINT "PK_6bb7b2a72126664a5cac36d3c07" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_store_members_user_id" ON "store_members"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_channel" AS ENUM('email', 'whatsapp', 'sms')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked')`,
    );
    await queryRunner.query(
      `CREATE TABLE "store_invitations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "store_id" uuid NOT NULL, "channel" "public"."notification_channel" NOT NULL, "recipient" character varying(254) NOT NULL, "role" "public"."store_role" NOT NULL, "token_hash" character(64) NOT NULL, "status" "public"."invitation_status" NOT NULL DEFAULT 'pending', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "invited_by_id" uuid, "accepted_by_id" uuid, "accepted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a0739491271ce6fa5b14a8460e3" UNIQUE ("token_hash"), CONSTRAINT "PK_efb6ddddde0a543730e3fe1bf55" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_store_invitations_store_id" ON "store_invitations"  ("store_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" ADD CONSTRAINT "FK_ca3fefdd99c1f2714119479c28c" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" ADD CONSTRAINT "FK_e9a006e2fe10bd3fb7b0fad33d1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_invitations" ADD CONSTRAINT "FK_6d7871a79a3e0bed52f20b2fcf6" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_invitations" ADD CONSTRAINT "FK_3d7609a64e5c599c8c2d20be316" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_invitations" ADD CONSTRAINT "FK_740eaa31f59a52bf10195c40830" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_invitations" DROP CONSTRAINT "FK_740eaa31f59a52bf10195c40830"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_invitations" DROP CONSTRAINT "FK_3d7609a64e5c599c8c2d20be316"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_invitations" DROP CONSTRAINT "FK_6d7871a79a3e0bed52f20b2fcf6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" DROP CONSTRAINT "FK_e9a006e2fe10bd3fb7b0fad33d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" DROP CONSTRAINT "FK_ca3fefdd99c1f2714119479c28c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_store_invitations_store_id"`,
    );
    await queryRunner.query(`DROP TABLE "store_invitations"`);
    await queryRunner.query(`DROP TYPE "public"."invitation_status"`);
    await queryRunner.query(`DROP TYPE "public"."notification_channel"`);
    await queryRunner.query(`DROP INDEX "public"."idx_store_members_user_id"`);
    await queryRunner.query(`DROP TABLE "store_members"`);
    await queryRunner.query(`DROP TYPE "public"."store_role"`);
    await queryRunner.query(`DROP TABLE "stores"`);
    await queryRunner.query(`DROP TYPE "public"."store_mode"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."platform_role"`);
  }
}
