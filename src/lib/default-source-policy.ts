import type { AdminConfig } from './admin.types';

export function allowedDefaultSources(config: AdminConfig, username: string) {
  const sources = config.SourceConfig.filter((source) => !source.disabled);
  const user = config.UserConfig.Users.find(
    (item) => item.username === username
  );
  const explicit = user?.enabledApis;
  if (explicit?.length)
    return sources.filter((source) => explicit.includes(source.key));
  const keys = new Set<string>();
  user?.tags?.forEach((tag) =>
    config.UserConfig.Tags?.find(
      (group) => group.name === tag
    )?.enabledApis.forEach((key) => keys.add(key))
  );
  return keys.size ? sources.filter((source) => keys.has(source.key)) : sources;
}

export function accountDefaultSource(config: AdminConfig, username: string) {
  const user = config.UserConfig.Users.find(
    (item) => item.username === username
  );
  const source = allowedDefaultSources(config, username).find(
    (item) => item.key === user?.defaultSourceKey
  );
  return {
    defaultSource: source ? { key: source.key, name: source.name } : null,
    configured: user?.defaultSourceKey !== undefined,
    supported: true,
  };
}
