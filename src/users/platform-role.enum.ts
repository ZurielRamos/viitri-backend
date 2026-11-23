/**
 * Rol a nivel de plataforma, por encima de los negocios.
 * - super_admin: gestiona toda la plataforma y tiene acceso a todos los negocios.
 * - user: usuario común; su acceso a negocios depende de sus membresías.
 */
export enum PlatformRole {
  SuperAdmin = 'super_admin',
  User = 'user',
}
