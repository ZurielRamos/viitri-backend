import type { BusinessType } from '../business-type.js';

/**
 * Opciones de un toque para describir el negocio sin escribir. La web arma
 * la descripción con ellas, y la tienda las muestra como etiquetas.
 */
export interface ProfileOption {
  id: string;
  label: string;
}

/** Máximo de especialidades: con más, la tienda deja de ser clara. */
export const MAX_SPECIALTIES = 3;

/** "¿Qué ofreces?", según el tipo de negocio. */
export const SPECIALTIES: Partial<Record<BusinessType, ProfileOption[]>> = {
  restaurant: [
    { id: 'home_cooking', label: 'Comida casera' },
    { id: 'lunch', label: 'Almuerzos (corrientazo)' },
    { id: 'breakfast', label: 'Desayunos' },
    { id: 'fast_food', label: 'Comida rápida' },
    { id: 'grill', label: 'Asados' },
    { id: 'chicken', label: 'Pollo' },
    { id: 'pizza', label: 'Pizza' },
    { id: 'healthy', label: 'Saludable' },
    { id: 'seafood', label: 'Mariscos' },
    { id: 'bakery', label: 'Postres y panadería' },
    { id: 'coffee', label: 'Café' },
  ],
  fast_food: [
    { id: 'burgers', label: 'Hamburguesas' },
    { id: 'hot_dogs', label: 'Perros calientes' },
    { id: 'pizza', label: 'Pizza' },
    { id: 'chicken', label: 'Pollo' },
    { id: 'salchipapas', label: 'Salchipapas' },
    { id: 'arepas', label: 'Arepas' },
    { id: 'empanadas', label: 'Empanadas' },
    { id: 'sandwiches', label: 'Sándwiches' },
  ],
  bar: [
    { id: 'cocktails', label: 'Cócteles' },
    { id: 'beer', label: 'Cerveza' },
    { id: 'craft_beer', label: 'Cerveza artesanal' },
    { id: 'liquor', label: 'Licores' },
    { id: 'wine', label: 'Vinos' },
    { id: 'snacks', label: 'Picadas' },
    { id: 'live_music', label: 'Música en vivo' },
  ],
  cafe: [
    { id: 'specialty_coffee', label: 'Café de especialidad' },
    { id: 'breakfast', label: 'Desayunos' },
    { id: 'brunch', label: 'Brunch' },
    { id: 'desserts', label: 'Postres' },
    { id: 'tea', label: 'Té e infusiones' },
    { id: 'bakery', label: 'Panadería' },
  ],
  bakery: [
    { id: 'bread', label: 'Pan' },
    { id: 'cakes', label: 'Tortas y pasteles' },
    { id: 'desserts', label: 'Postres' },
    { id: 'cookies', label: 'Galletas' },
    { id: 'breakfast', label: 'Desayunos' },
    { id: 'coffee', label: 'Café' },
  ],
  ice_cream: [
    { id: 'artisan_ice_cream', label: 'Helado artesanal' },
    { id: 'popsicles', label: 'Paletas' },
    { id: 'milkshakes', label: 'Malteadas' },
    { id: 'desserts', label: 'Postres' },
    { id: 'frozen_yogurt', label: 'Yogur helado' },
    { id: 'coffee', label: 'Café' },
  ],
};

/** "¿Cómo atiendes?" */
export const SERVICE_MODES: ProfileOption[] = [
  { id: 'dine_in', label: 'En el local' },
  { id: 'takeaway', label: 'Para llevar' },
  { id: 'delivery', label: 'Domicilios' },
];

/** "¿Cómo te pagan?" Por ahora, los medios de Colombia. */
export const PAYMENT_METHODS: ProfileOption[] = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  // Pagos inmediatos del Banco de la República, con llave (celular, cédula, correo).
  { id: 'breb', label: 'Bre-B' },
  { id: 'card', label: 'Tarjeta' },
  { id: 'transfer', label: 'Transferencia' },
];

export const SERVICE_MODE_IDS = SERVICE_MODES.map((o) => o.id);
export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map((o) => o.id);

/** Especialidades válidas para el tipo de negocio, o un motivo de error. */
export function specialtiesError(
  type: BusinessType | null,
  specialties: string[],
): string | null {
  if (specialties.length > MAX_SPECIALTIES) {
    return `Elige hasta ${MAX_SPECIALTIES} opciones.`;
  }
  // Los negocios creados antes de elegir tipo se tratan como restaurante,
  // el único tipo disponible hoy.
  const allowed = new Set(
    SPECIALTIES[type ?? 'restaurant']?.map((o) => o.id) ?? [],
  );
  const unknown = specialties.find((id) => !allowed.has(id));
  return unknown ? `"${unknown}" no es una opción para este negocio.` : null;
}
