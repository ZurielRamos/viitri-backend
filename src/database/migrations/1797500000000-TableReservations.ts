import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reservas de mesa en la agenda: tipo de reserva, personas y sus ajustes. */
export class TableReservations1797500000000 implements MigrationInterface {
  name = 'TableReservations1797500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "kind" character varying(10) NOT NULL DEFAULT 'service'`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" ADD "party_size" integer`);
    await queryRunner.query(
      `ALTER TABLE "booking_settings" ADD "reservation_duration_minutes" integer NOT NULL DEFAULT 90`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_settings" ADD "reservations_per_slot" integer NOT NULL DEFAULT 5`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_settings" ADD "max_party_size" integer NOT NULL DEFAULT 10`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_settings" DROP COLUMN "max_party_size"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_settings" DROP COLUMN "reservations_per_slot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_settings" DROP COLUMN "reservation_duration_minutes"`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "party_size"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "kind"`);
  }
}
