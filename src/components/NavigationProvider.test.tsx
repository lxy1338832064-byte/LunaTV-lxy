import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import { NavigationProvider, useNavigation } from './NavigationProvider';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock(
  'next/dynamic',
  () => () =>
    function Picker() {
      return <div>节点选择内容</div>;
    }
);

function Entry({ url }: { url: string }) {
  const navigate = useNavigation();
  return <button onClick={() => navigate(url, '测试影片')}>继续观看</button>;
}

test('continue watching preserves the remembered source, episode and time without opening probes', () => {
  const push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push });
  render(
    <NavigationProvider>
      <Entry url='/play?source=old&id=123&title=test&prefer=true&resumeEpisode=5&resumeTime=456' />
    </NavigationProvider>
  );
  fireEvent.click(screen.getByText('继续观看'));
  expect(push).toHaveBeenCalledTimes(1);
  const params = new URL(push.mock.calls[0][0], 'http://localhost')
    .searchParams;
  expect(params.get('source')).toBe('old');
  expect(params.get('id')).toBe('123');
  expect(params.get('resumeEpisode')).toBe('5');
  expect(params.get('resumeTime')).toBe('456');
  expect(params.has('prefer')).toBe(false);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('an explicit source-change request opens nodes while retaining the resume position', () => {
  const push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push });
  render(
    <NavigationProvider>
      <Entry url='/play?source=old&id=123&resumeEpisode=5&resumeTime=456&chooseNode=1' />
    </NavigationProvider>
  );
  fireEvent.click(screen.getByText('继续观看'));
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveTextContent('从第 5 集 7:36 继续');
  expect(screen.getByText('节点选择内容')).toBeInTheDocument();
});
