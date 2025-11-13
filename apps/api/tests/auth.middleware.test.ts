import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { authenticate, requireRole } from '../src/middleware/auth';

type MutableReq = Partial<Request> & { headers?: Record<string, string> };

type MutableRes = Response & {
  statusCode?: number;
  payload?: unknown;
};

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = ((code: number) => {
    (res as MutableRes).statusCode = code;
    return res as Response;
  }) as Response['status'];
  res.json = ((payload: unknown) => {
    (res as MutableRes).payload = payload;
    return res as Response;
  }) as Response['json'];
  res.send = res.json;
  return res as Response;
};

describe('authenticate middleware', () => {
  it('rejects when no role header provided', () => {
    const req = { header: () => undefined } as MutableReq as Request;
    const res = createResponse();
    let nextCalled = false;
    authenticate(req, res, () => {
      nextCalled = true;
    });
    expect((res as MutableRes).statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('populates req.user from headers', () => {
    const req = {
      header: (name: string) => {
        if (name === 'x-user-role') return 'assistant';
        if (name === 'x-user-id') return 'tester';
        return undefined;
      },
    } as MutableReq as Request;
    const res = createResponse();
    let nextCalled = false;
    authenticate(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(req.user?.role).toBe('assistant');
    expect(req.user?.id).toBe('tester');
  });

  it('accepts bearer tokens with role prefix', () => {
    const req = {
      header: (name: string) => (name === 'authorization' ? 'Bearer role:admin' : undefined),
    } as MutableReq as Request;
    const res = createResponse();
    authenticate(req, res, () => {
      /* noop */
    });
    expect(req.user?.role).toBe('admin');
  });
});

describe('requireRole middleware', () => {
  it('blocks when role not allowed', () => {
    const req = { user: { id: 'x', role: 'assistant' } } as Request;
    const res = createResponse();
    let nextCalled = false;
    requireRole(['admin'])(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect((res as MutableRes).statusCode).toBe(403);
  });

  it('passes when role is allowed', () => {
    const req = { user: { id: 'admin', role: 'admin' } } as Request;
    const res = createResponse();
    let nextCalled = false;
    requireRole(['admin'])(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });
});
