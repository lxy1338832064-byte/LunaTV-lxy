import { fireEvent, render, screen } from '@testing-library/react';

import PlaybackAutomationControls from './PlaybackAutomationControls';

test('enabling empty skip settings opens the editor instead of enabling a no-op', () => {
  const save = jest.fn();
  render(
    <PlaybackAutomationControls
      config={{ enable: false, intro_time: 0, outro_time: 0 }}
      autoNext
      onConfig={save}
      onAutoNext={jest.fn()}
      getPosition={() => ({ time: 0, duration: 1800 })}
    />
  );
  fireEvent.click(screen.getByRole('switch', { name: '自动跳过片头片尾' }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('请先设置');
  expect(
    screen.getByLabelText('片头时长（秒）').closest('details')
  ).toHaveAttribute('open');
});

test('per-title skip durations and marking the current playback point are explicit', () => {
  const save = jest.fn();
  render(
    <PlaybackAutomationControls
      config={{ enable: false, intro_time: 0, outro_time: 0 }}
      autoNext
      onConfig={save}
      onAutoNext={jest.fn()}
      getPosition={() => ({ time: 85, duration: 1800 })}
    />
  );
  fireEvent.click(screen.getByText('90 秒模板'));
  expect(save).toHaveBeenLastCalledWith({
    enable: true,
    intro_time: 90,
    outro_time: -90,
  });
  fireEvent.click(screen.getByText('当前为正片开始'));
  expect(save).toHaveBeenLastCalledWith({
    enable: true,
    intro_time: 85,
    outro_time: 0,
  });
  fireEvent.change(screen.getByLabelText('片头时长（秒）'), {
    target: { value: '999' },
  });
  fireEvent.click(screen.getByText('保存并开启'));
  expect(save).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('status')).toHaveTextContent('0–600');
});
