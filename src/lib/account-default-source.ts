import { getConfig, setCachedConfig } from './config';
import { db } from './db';
import {
  accountDefaultSource,
  allowedDefaultSources,
} from './default-source-policy';
import { createWorkLimiter } from './limit-work';

export class DefaultSourceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export async function loadDefaultSourceConfig() {
  return (await db.getAdminConfig()) || (await getConfig());
}
const write = createWorkLimiter(1, 100, 15000);

export async function updateAccountDefaultSources(
  actor: string,
  targets: string[],
  sourceKey: unknown,
  admin: boolean,
  migrateOnly = false
) {
  return write(async () => {
    const config = JSON.parse(
      JSON.stringify(await loadDefaultSourceConfig())
    ) as Awaited<ReturnType<typeof getConfig>>;
    const operator = config.UserConfig.Users.find(
      (user) => user.username === actor
    );
    const owner = actor === process.env.USERNAME;
    if (
      !owner &&
      (!operator || operator.banned || (admin && operator.role !== 'admin'))
    )
      throw new DefaultSourceError(403, '权限不足');
    if (
      !targets.length ||
      targets.length > 1000 ||
      targets.some((name) => typeof name !== 'string' || !name)
    )
      throw new DefaultSourceError(400, '请选择目标用户');
    if (!admin && (targets.length !== 1 || targets[0] !== actor))
      throw new DefaultSourceError(403, '只能修改自己的设置');
    if (sourceKey !== null && (typeof sourceKey !== 'string' || !sourceKey))
      throw new DefaultSourceError(400, '播放源参数错误');
    const users = Array.from(new Set(targets)).map((name) => {
      const user = config.UserConfig.Users.find(
        (item) => item.username === name
      );
      if (!user) throw new DefaultSourceError(404, `用户不存在：${name}`);
      if (
        !(migrateOnly && user.defaultSourceKey !== undefined) &&
        sourceKey !== null &&
        !allowedDefaultSources(config, name).some(
          (source) => source.key === sourceKey
        )
      )
        throw new DefaultSourceError(
          400,
          `播放源不可用，或用户「${name}」没有该源权限`
        );
      return user;
    });
    // Validate the whole selection before changing anything; a forbidden source cannot grant access.
    for (const user of users)
      if (!migrateOnly || user.defaultSourceKey === undefined)
        user.defaultSourceKey = sourceKey as string | null;
    await db.saveAdminConfig(config);
    await setCachedConfig(config);
    return accountDefaultSource(config, actor);
  });
}
