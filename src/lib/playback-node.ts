export function speedBytes(value: string): number {
  const match = value.match(/^([\d.]+)\s*(KB|MB)\/s$/i);
  return match
    ? Number(match[1]) * (match[2].toUpperCase() === 'MB' ? 1048576 : 1024)
    : 0;
}

export function selectedNodeUrl(
  original: string,
  source: string,
  id: string
): string {
  const url = new URL(original, 'http://localhost');
  url.searchParams.set('source', source);
  url.searchParams.set('id', id);
  url.searchParams.delete('prefer');
  return url.pathname + url.search;
}

export function readResume(params: {
  get(key: string): string | null;
}): { episode: number; time: number } | null {
  const episode = Number(params.get('resumeEpisode'));
  const time = Number(params.get('resumeTime'));
  if (
    !Number.isSafeInteger(episode) ||
    episode < 1 ||
    episode > 10000 ||
    !Number.isFinite(time) ||
    time < 0
  )
    return null;
  return { episode, time };
}
