'use client';

import { useEffect, useState } from 'react';

import type { AdminConfig } from '@/lib/admin.types';
import { syncDefaultSource } from '@/lib/default-source';
import { allowedDefaultSources } from '@/lib/default-source-policy';

type User = AdminConfig['UserConfig']['Users'][number];
export default function AdminDefaultSourceEditor({
  users,
  config,
  onSaved,
}: {
  users: User[];
  config: AdminConfig;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(
    users.length === 1 ? users[0].defaultSourceKey || '' : ''
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const signature = users
    .map((user) => `${user.username}:${user.defaultSourceKey}`)
    .join('|');
  useEffect(() => {
    setValue(users.length === 1 ? users[0].defaultSourceKey || '' : '');
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  const choices = config.SourceConfig.filter(
    (source) =>
      !source.disabled &&
      users.every((user) =>
        allowedDefaultSources(config, user.username).some(
          (item) => item.key === source.key
        )
      )
  );
  const missing = Boolean(
    value && !choices.some((source) => source.key === value)
  );
  const all = users.length !== 1;
  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/default-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames: users.map((user) => user.username),
          sourceKey: value || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      await syncDefaultSource(true);
      await onSaved();
      setMessage(all ? `已更新 ${users.length} 位用户` : '已保存');
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className='min-w-[220px]'>
      <div className='flex flex-wrap items-center gap-2'>
        <select
          aria-label={
            all ? '全部用户默认播放源' : `默认播放源：${users[0]?.username}`
          }
          disabled={saving}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage('');
            setError('');
          }}
          className='max-w-[240px] rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
        >
          <option value=''>不设置默认源</option>
          {missing && (
            <option disabled value={value}>
              已失效：{value}
            </option>
          )}
          {choices.map((source) => (
            <option key={source.key} value={source.key}>
              {source.name}
            </option>
          ))}
        </select>
        <button
          disabled={saving || missing || !users.length}
          onClick={() => void save()}
          className='rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40'
        >
          {saving
            ? '保存中…'
            : all
            ? `应用到全部 ${users.length} 位用户`
            : '保存'}
        </button>
      </div>
      {message && (
        <p role='status' className='mt-1 text-xs text-green-500'>
          {message}
        </p>
      )}
      {error && (
        <p
          role='alert'
          className='mt-1 max-w-sm whitespace-normal text-xs text-red-400'
        >
          {error}
        </p>
      )}
      {all && (
        <p className='mt-2 text-xs text-gray-500'>
          保存会覆盖全部用户现有默认源；列表仅展示所有用户共同有权限使用的源。临时换源不受影响。
        </p>
      )}
    </div>
  );
}
