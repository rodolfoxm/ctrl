import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context.jsx';
import introUrl from '../assets/intro.mp4';

// Decided once when the page loads: a renderer reload doesn't replay it, and neither does a window
// that started hidden (with Windows, into the tray) and is opened later. Reduced motion is not a
// reason to skip: Windows sets it when animation effects are off, which one of our own tweaks does;
// the "Animação de abertura" setting turns it off instead.
const SKIP = (() => {
  try {
    if (sessionStorage.getItem('ctrl.intro')) return true;
    sessionStorage.setItem('ctrl.intro', '1');
  } catch {}
  // ?demo is the browser preview used for the README screenshots.
  return document.hidden || location.search.includes('demo');
})();

/** Opening animation over the whole window. Click, any key or the end of the video closes it. */
export default function Intro() {
  const { settings } = useApp();
  const [phase, setPhase] = useState(SKIP ? 'gone' : 'play');
  const video = useRef(null);
  const ready = !!settings;
  const off = settings?.intro === false;

  useEffect(() => {
    if (phase !== 'play' || !ready || off) return;
    const v = video.current;
    // Electron allows sound without a click; the browser preview falls back to muted.
    v?.play().catch(() => {
      v.muted = true;
      v.play().catch(() => setPhase('out'));
    });
    const finish = () => setPhase('out');
    const safety = setTimeout(finish, 6000);
    window.addEventListener('keydown', finish);
    return () => {
      clearTimeout(safety);
      window.removeEventListener('keydown', finish);
    };
  }, [phase, ready, off]);

  if (phase === 'gone' || off) return null;
  return (
    <div
      className={`intro${phase === 'out' ? ' out' : ''}`}
      onClick={() => setPhase('out')}
      onAnimationEnd={(e) => e.animationName === 'intro-out' && setPhase('gone')}
      aria-hidden="true"
    >
      {ready && <video ref={video} src={introUrl} playsInline preload="auto" onEnded={() => setPhase('out')} onError={() => setPhase('out')} />}
    </div>
  );
}
