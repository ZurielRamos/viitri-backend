import { SetMetadata } from '@nestjs/common';
import type { BusinessFeature } from '../business-feature.enum.js';

export const REQUIRED_FEATURES_KEY = 'requiredFeatures';

/**
 * Exige que el negocio de la ruta tenga activo al menos uno de los features.
 * Se usa junto con @BusinessAccess(), que es quien lo verifica después de
 * confirmar la membresía.
 */
export const RequireAnyFeature = (...features: BusinessFeature[]) =>
  SetMetadata(REQUIRED_FEATURES_KEY, features);
