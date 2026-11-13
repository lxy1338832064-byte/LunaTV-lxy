export default function KittyWelcome() {
  return (
    <div className='kitty-welcome' aria-label='Hello Kitty 主题欢迎区'>
      <span className='kitty-welcome-character' aria-hidden='true' />
      <div>
        <span className='kitty-welcome-kicker'>HELLO KITTY · SWEET CINEMA</span>
        <p>
          今天，也要甜甜地追剧 <span aria-hidden='true'>♡</span>
        </p>
        <span className='kitty-welcome-note'>把喜欢的故事，装进粉色放映室</span>
      </div>
      <span className='kitty-welcome-bow' aria-hidden='true' />
    </div>
  );
}
