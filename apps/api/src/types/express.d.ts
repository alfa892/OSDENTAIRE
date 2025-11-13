import type { Role } from './auth';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: Role;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: Express.UserContext;
  }
}

export {};
