export const roles = ['assistant', 'practitioner', 'admin'] as const;
export type Role = (typeof roles)[number];
