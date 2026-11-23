export const TTL_STORE = Symbol('TTL_STORE');

/** Resultado de `mutate`: qué hacer con el valor y qué devolver al llamador. */
export interface Mutation<T, R> {
  /** `undefined` deja el valor como está; `null` lo borra. Conserva el vencimiento. */
  value?: T | null;
  result: R;
}

/** Almacén clave-valor con vencimiento (el equivalente a SET con EX en Redis). */
export interface TtlStore {
  /** Crea o reemplaza el valor y reinicia su vencimiento. */
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;

  /** Crea el valor solo si no existe uno vigente. Devuelve `true` si lo creó. */
  setIfAbsent(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean>;

  delete(key: string): Promise<void>;

  /**
   * Lee, decide y escribe de forma atómica: dos llamadas concurrentes sobre la
   * misma clave se ejecutan una tras otra. `current` es `null` si no hay valor
   * vigente; en ese caso no se escribe nada.
   */
  mutate<T, R>(
    key: string,
    fn: (current: T | null) => Mutation<T, R>,
  ): Promise<R>;
}
