export type ApiResponse<T> = {
  data: T;
  meta?: Record<string, string | number | boolean>;
};
