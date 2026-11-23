/**
 * Promueve a super_admin a un usuario ya registrado.
 * Uso: npm run admin:promote -- usuario@ejemplo.com
 */
import dataSource from '../database/data-source.js';
import { User } from '../users/entities/user.entity.js';
import { PlatformRole } from '../users/platform-role.enum.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: npm run admin:promote -- <email>');
  process.exit(1);
}

await dataSource.initialize();
try {
  const result = await dataSource
    .getRepository(User)
    .update({ email }, { platformRole: PlatformRole.SuperAdmin });
  if (!result.affected) {
    console.error(`No existe un usuario con email ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`${email} ahora es super_admin.`);
  }
} finally {
  await dataSource.destroy();
}
