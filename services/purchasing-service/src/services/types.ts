/**
 * @deprecated Tipos movidos a ubicaciones específicas.
 *
 * Usar en su lugar:
 * - Event types: src/use-cases/types.ts
 * - ProviderPurchaseResponse: src/externals/types.ts
 *
 * Este archivo se mantiene solo para compatibilidad hacia atrás.
 */

export type { 
  PurchaseRequestedEvent,
  PurchaseCompletedEvent,
  PurchaseFailedEvent,
} from '../use-cases/types';

export type { ProviderPurchaseResponse } from '../externals/types';
