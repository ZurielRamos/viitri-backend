/** Proveedores de inicio de sesión social. */
export type SocialProvider = 'google';

export const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: 'Google',
};

/** Cuenta ya verificada por el proveedor. */
export interface SocialIdentity {
  /** Identificador estable de la cuenta en el proveedor. */
  sub: string;
  email: string;
  name: string;
}
