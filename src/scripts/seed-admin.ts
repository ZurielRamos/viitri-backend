/**
 * Crea (o deja listo) el usuario super_admin del panel admin.
 * Uso: npm run admin:seed
 *
 * Por defecto: admin@viitri.com / 123123123. Es solo para desarrollo: en
 * producción exige ADMIN_SEED_EMAIL y ADMIN_SEED_PASSWORD. Si el usuario ya
 * existe, no cambia su contraseña: solo se asegura de que sea super_admin.
 */
import * as argon2 from 'argon2';
import dataSource from '../database/data-source.js';
import { User } from '../users/entities/user.entity.js';
import { PlatformRole } from '../users/platform-role.enum.js';
const DEFAULT_EMAIL = 'admin@viitri.com';
const DEFAULT_PASSWORD = '123123123';
const email = (process.env.ADMIN_SEED_EMAIL ?? DEFAULT_EMAIL)
  .trim()
  .toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD ?? DEFAULT_PASSWORD;
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD)
) {
  console.error(
    'En producción define ADMIN_SEED_EMAIL y ADMIN_SEED_PASSWORD: no se usan las credenciales por defecto.',
  );
  process.exit(1);
}
await dataSource.initialize();
try {
  const users = dataSource.getRepository(User);
  const existing = await users.findOneBy({ email });
  if (existing) {
    if (existing.platformRole !== PlatformRole.SuperAdmin) {
      await users.update(existing.id, {
        platformRole: PlatformRole.SuperAdmin,
      });
    }
    console.log(`${email} ya existe y es super_admin. Contraseña sin cambios.`);
  } else {
    await users.save(
      users.create({
        email,
        name: 'Admin',
        passwordHash: await argon2.hash(password),
        platformRole: PlatformRole.SuperAdmin,
        onboardedAt: new Date(),
      }),
    );
    console.log(`Usuario ${email} creado como super_admin.`);
  }
} finally {
  await dataSource.destroy();
}
