export type Role = 'assistant' | 'practitioner' | 'admin';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5050';

export const buildHeaders = (role: Role) => ({
  'Content-Type': 'application/json',
  'x-user-role': role,
  'x-user-id': `demo-${role}`,
});

export const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return {} as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = (payload as { error?: string }).error ?? 'unexpected_error';
    throw new Error(message);
  }

  return payload as T;
};
