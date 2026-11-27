/**
 * Credenciales de los servicios externos que se pueden cambiar desde el
 * panel del equipo. Lo guardado en el panel tiene prioridad sobre el `.env`;
 * si se borra, vuelve a regir el `.env`.
 *
 * No están aquí, a propósito: la base de datos, JWT_SECRET y las URLs de la
 * app. Cambiarlas desde el panel puede dejar la API sin arrancar o cerrar
 * todas las sesiones.
 */
export type SettingFieldType = 'text' | 'url' | 'number' | 'email' | 'select';

export interface SettingField {
  key: string;
  label: string;
  help?: string;
  placeholder?: string;
  type?: SettingFieldType;
  options?: { value: string; label: string }[];
  /** Nunca se devuelve completo: solo los últimos caracteres. */
  secret?: boolean;
  /** Se lee al arrancar la API: el cambio rige después de reiniciarla. */
  restart?: boolean;
}

export interface SettingGroup {
  id: string;
  name: string;
  description: string;
  /** Sin estas, el servicio no funciona. */
  required: string[];
  /** Tiene "Probar conexión". */
  testable?: boolean;
  docsUrl?: string;
  fields: SettingField[];
}

export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: 'mail',
    name: 'Correo',
    description:
      'Servidor SMTP para la bienvenida, la recuperación de contraseña y los comprobantes de pago. Sin servidor, en desarrollo los correos se guardan en var/mail.',
    required: ['SMTP_HOST'],
    testable: true,
    docsUrl: 'https://app.mailgun.com/mg/sending/domains',
    fields: [
      { key: 'SMTP_HOST', label: 'Servidor', placeholder: 'smtp.mailgun.org' },
      {
        key: 'SMTP_PORT',
        label: 'Puerto',
        type: 'number',
        placeholder: '587',
        help: '465 usa TLS directo; 587 y 2525, STARTTLS.',
      },
      {
        key: 'SMTP_USER',
        label: 'Usuario',
        placeholder: 'postmaster@mg.viitri.com',
      },
      { key: 'SMTP_PASS', label: 'Contraseña', secret: true },
      {
        key: 'MAIL_FROM',
        label: 'Remitente',
        placeholder: 'viitri <no-reply@viitri.com>',
        restart: true,
      },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description:
      'Códigos de acceso y avisos con plantillas aprobadas, por la API de Strategee. Sin token, fuera de producción el código se escribe en el log.',
    required: ['WHATSAPP_API_URL', 'WHATSAPP_API_TOKEN', 'WHATSAPP_INBOX_ID'],
    fields: [
      {
        key: 'WHATSAPP_API_URL',
        label: 'URL de códigos de acceso',
        type: 'url',
        placeholder:
          'https://crm.example.com/api/v1/cuenta/whatsapp/auth-template',
        help: 'La URL completa del endpoint de la plantilla de autenticación.',
      },
      {
        key: 'WHATSAPP_TEMPLATE_API_URL',
        label: 'URL de avisos con plantillas',
        type: 'url',
        help: 'Vacía: los avisos de pedidos, reservas y planes solo se escriben en el log.',
      },
      { key: 'WHATSAPP_API_TOKEN', label: 'Token', secret: true },
      { key: 'WHATSAPP_INBOX_ID', label: 'ID del inbox' },
      {
        key: 'WHATSAPP_TEMPLATE_NAME',
        label: 'Plantilla de códigos',
        placeholder: 'autenticacion',
      },
      {
        key: 'WHATSAPP_LANGUAGE_CODE',
        label: 'Idioma de la plantilla de códigos',
        placeholder: 'es',
      },
      {
        key: 'WHATSAPP_TEMPLATES_LANGUAGE_CODE',
        label: 'Idioma de los avisos',
        placeholder: 'es_CO',
      },
    ],
  },
  {
    id: 'google-auth',
    name: 'Inicio con Google',
    description:
      'Client ID con el que la API verifica el inicio de sesión con Google. Debe ser el mismo que usa la web.',
    required: ['GOOGLE_CLIENT_ID'],
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      {
        key: 'GOOGLE_CLIENT_ID',
        label: 'Client ID',
        placeholder: 'xxxxxxxx.apps.googleusercontent.com',
        help: 'El Client Secret vive en la web (web/.env): la API no lo necesita.',
      },
    ],
  },
  {
    id: 'maps',
    name: 'Google Maps',
    description:
      'Distancia de la ruta para cotizar los domicilios, con Routes API. Sin clave no se cotizan domicilios.',
    required: ['GOOGLE_MAPS_API_KEY'],
    docsUrl: 'https://console.cloud.google.com/google/maps-apis/credentials',
    fields: [
      { key: 'GOOGLE_MAPS_API_KEY', label: 'API key', secret: true },
      {
        key: 'DISTANCE_PROVIDER',
        label: 'Cálculo de distancia',
        type: 'select',
        options: [
          { value: 'google', label: 'Google Routes (real)' },
          { value: 'straight_line', label: 'Línea recta (solo pruebas)' },
        ],
      },
    ],
  },
  {
    id: 'storage',
    name: 'Almacenamiento',
    description:
      'Logos y portadas en Google Cloud Storage con claves HMAC. Sin bucket, en desarrollo se guardan en var/uploads.',
    required: [
      'STORAGE_BUCKET',
      'STORAGE_HMAC_ACCESS_KEY',
      'STORAGE_HMAC_SECRET',
    ],
    docsUrl:
      'https://console.cloud.google.com/storage/settings;tab=interoperability',
    fields: [
      {
        key: 'STORAGE_BUCKET',
        label: 'Bucket',
        placeholder: 'tu-proyecto.firebasestorage.app',
        restart: true,
      },
      {
        key: 'STORAGE_HMAC_ACCESS_KEY',
        label: 'Access key',
        secret: true,
        restart: true,
      },
      {
        key: 'STORAGE_HMAC_SECRET',
        label: 'Secret',
        secret: true,
        restart: true,
      },
    ],
  },
  {
    id: 'ai',
    name: 'Inteligencia artificial',
    description:
      'Modelos por OpenRouter: leer menús desde una foto, sugerir el diseño según el logo y crear logos.',
    required: ['OPENROUTER_API_KEY'],
    testable: true,
    docsUrl: 'https://openrouter.ai/keys',
    fields: [
      { key: 'OPENROUTER_API_KEY', label: 'API key', secret: true },
      {
        key: 'OPENROUTER_MODEL',
        label: 'Modelo principal',
        placeholder: 'google/gemini-2.5-flash',
        restart: true,
      },
      {
        key: 'LOGO_MODEL',
        label: 'Modelo del creador de logos',
        help: 'Vacío: el modelo por defecto del creador de logos.',
      },
    ],
  },
  {
    id: 'payments',
    name: 'Pagos',
    description:
      'Cobro de los planes con Wompi. Las llaves de Sandbox empiezan por pub_test_, test_integrity_ y test_events_.',
    required: [
      'WOMPI_PUBLIC_KEY',
      'WOMPI_INTEGRITY_SECRET',
      'WOMPI_EVENTS_SECRET',
    ],
    testable: true,
    docsUrl: 'https://comercios.wompi.co/developers',
    fields: [
      {
        key: 'WOMPI_PUBLIC_KEY',
        label: 'Llave pública',
        placeholder: 'pub_prod_…',
      },
      {
        key: 'WOMPI_INTEGRITY_SECRET',
        label: 'Secreto de integridad',
        secret: true,
      },
      { key: 'WOMPI_EVENTS_SECRET', label: 'Secreto de eventos', secret: true },
    ],
  },
  {
    id: 'push',
    name: 'Notificaciones push',
    description:
      'Claves VAPID de los avisos en el celular. Si cambias el par, los celulares tienen que volver a activar los avisos.',
    required: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
    fields: [
      { key: 'VAPID_PUBLIC_KEY', label: 'Clave pública' },
      { key: 'VAPID_PRIVATE_KEY', label: 'Clave privada', secret: true },
      {
        key: 'VAPID_SUBJECT',
        label: 'Contacto',
        placeholder: 'mailto:soporte@viitri.com',
      },
    ],
  },
];

/** Todas las claves que se pueden guardar desde el panel. */
export const SETTING_KEYS = new Set(
  SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.key)),
);

export function settingGroup(id: string): SettingGroup | undefined {
  return SETTING_GROUPS.find((g) => g.id === id);
}
