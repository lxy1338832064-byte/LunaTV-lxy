/** @jest-environment node */
import { getConfig } from './config';
import defaultCatalog from './default-catalog.json';

jest.mock('@/lib/db', () => ({
  db: {
    getAdminConfig: jest.fn(async () => null),
    getAllUsers: jest.fn(async () => []),
    saveAdminConfig: jest.fn(async () => undefined),
  },
}));

test('a fresh installation loads the supplied catalog with 17 sources and 14 categories', async () => {
  process.env.USERNAME = 'owner';
  const config = await getConfig();
  expect(JSON.parse(config.ConfigFile)).toEqual(defaultCatalog);
  expect(config.SourceConfig).toHaveLength(17);
  expect(config.CustomCategories).toHaveLength(14);
  expect(config.SiteConfig.SiteInterfaceCacheTime).toBe(7200);
  expect(config.SourceConfig.every((source) => !source.disabled)).toBe(true);
});
