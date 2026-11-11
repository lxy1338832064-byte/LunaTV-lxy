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
