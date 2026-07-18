import { MembershipConfig } from '../config';
import {
  decodeMemberDocument,
  fetchMember,
  fromValue,
  registerMember,
} from '../firestore';

const config: MembershipConfig = {
  projectId: 'proj',
  apiKey: 'key',
  collection: 'members',
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('fromValue / decodeMemberDocument', () => {
  it('decodes Firestore scalar values', () => {
    expect(fromValue({ stringValue: 'x' })).toBe('x');
    expect(fromValue({ integerValue: '7' })).toBe(7);
    expect(fromValue({ booleanValue: true })).toBe(true);
    expect(fromValue(undefined)).toBeUndefined();
  });

  it('builds a MemberRecord, defaulting missing/invalid fields', () => {
    const rec = decodeMemberDocument('dev-1', {
      fields: {
        label: { stringValue: '호준 형' },
        plan: { stringValue: 'pro' },
        updatedAt: { stringValue: '2026-07-18T00:00:00Z' },
      },
    });
    expect(rec).toEqual({
      deviceId: 'dev-1',
      label: '호준 형',
      plan: 'pro',
      note: undefined,
      updatedAt: '2026-07-18T00:00:00Z',
    });
  });

  it('coerces an unknown plan to free', () => {
    expect(decodeMemberDocument('d', { fields: { plan: { stringValue: 'gold' } } }).plan).toBe(
      'free',
    );
    expect(decodeMemberDocument('d', null).plan).toBe('free');
  });
});

describe('fetchMember', () => {
  it('found → returns decoded record', async () => {
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ fields: { plan: { stringValue: 'pro' }, label: { stringValue: 'A' } } }),
    })) as unknown as typeof fetch;
    const r = await fetchMember(config, 'dev');
    expect(r.status).toBe('found');
    expect(r.status === 'found' && r.record.plan).toBe('pro');
  });

  it('404 → absent', async () => {
    global.fetch = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    expect((await fetchMember(config, 'dev')).status).toBe('absent');
  });

  it('500 → error', async () => {
    global.fetch = (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    expect((await fetchMember(config, 'dev')).status).toBe('error');
  });

  it('network throw → error', async () => {
    global.fetch = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect((await fetchMember(config, 'dev')).status).toBe('error');
  });
});

describe('registerMember', () => {
  it('created (200) → ok, not existed; omits deviceId from body', async () => {
    let sentBody: any;
    global.fetch = (async (_url: string, init: any) => {
      sentBody = JSON.parse(init.body);
      return { ok: true, status: 200 };
    }) as unknown as typeof fetch;
    const r = await registerMember(config, {
      deviceId: 'dev-1',
      label: 'A',
      plan: 'free',
      updatedAt: '2026-07-18T00:00:00Z',
    });
    expect(r).toEqual({ ok: true, existed: false });
    expect(sentBody.fields.deviceId).toBeUndefined();
    expect(sentBody.fields.plan).toEqual({ stringValue: 'free' });
  });

  it('conflict (409) → ok + existed (does not overwrite)', async () => {
    global.fetch = (async () => ({ ok: false, status: 409 })) as unknown as typeof fetch;
    expect(
      await registerMember(config, { deviceId: 'd', label: 'A', plan: 'free', updatedAt: 't' }),
    ).toEqual({ ok: true, existed: true });
  });

  it('network throw → not ok', async () => {
    global.fetch = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(
      (await registerMember(config, { deviceId: 'd', label: 'A', plan: 'free', updatedAt: 't' })).ok,
    ).toBe(false);
  });
});
