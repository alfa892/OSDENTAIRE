import type { NextFunction, Request, Response } from 'express';
import { roles, type Role } from '../types/auth';

const roleSet = new Set<Role>(roles);

const parseRoleFromAuthorization = (header: string | undefined): Role | null => {
  if (!header) return null;
  const token = header.replace('Bearer', '').trim();
  if (token.startsWith('role:')) {
    const maybeRole = token.split(':')[1]?.toLowerCase();
    if (maybeRole && roleSet.has(maybeRole as Role)) {
      return maybeRole as Role;
    }
  }
  return null;
};

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const headerRole = req.header('x-user-role')?.toLowerCase() as Role | undefined;
  const authRole = parseRoleFromAuthorization(req.header('authorization') ?? undefined);
  const role = headerRole ?? authRole;

  if (!role || !roleSet.has(role)) {
    return res.status(401).json({ error: 'missing_credentials' });
  }

  req.user = {
    id: req.header('x-user-id') ?? 'anonymous',
    role,
  };

  next();
};

export const requireRole = (allowed: Role[]) => {
  const allowedSet = new Set<Role>(allowed);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'missing_credentials' });
    }

    if (!allowedSet.has(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', requiredRoles: [...allowedSet] });
    }

    next();
  };
};
