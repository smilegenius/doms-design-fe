// ─── New Case Flow · dictation ───────────────────────────────────────────────
// Speak the description instead of typing it. Uses the browser's own speech
// recognition where there is one (Chrome, Edge, Safari): words appear as they
// are heard and land in the text when a phrase is final. Where there's none, a
// short demo dictation "speaks" a sample case word by word, so the idea still
// shows in the prototype.

import { useEffect, useRef, useState } from 'react';

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export type DictationState = 'idle' | 'listening' | 'demo';

/** `onPhrase` gets each final phrase; `interim` is what's being heard right now. */
export function useDictation(onPhrase: (text: string) => void, demo: string) {
  const [state, setState] = useState<DictationState>('idle');
  const [interim, setInterim] = useState('');
  const rec = useRef<Recognition | null>(null);
  const timer = useRef<number>();
  const phrase = useRef(onPhrase);
  phrase.current = onPhrase;

  const reset = () => { setState('idle'); setInterim(''); };
  const stop = () => {
    rec.current?.stop();
    rec.current = null;
    window.clearInterval(timer.current);
    reset();
  };
  const start = () => {
    const Ctor = recognitionCtor();
    if (Ctor) {
      const r = new Ctor();
      r.lang = 'en-GB';
      r.interimResults = true;
      r.continuous = true;
      r.onresult = e => {
        let done = '';
        let heard = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) done += res[0].transcript; else heard += res[0].transcript;
        }
        if (done.trim()) phrase.current(done.trim());
        setInterim(heard.trim());
      };
      r.onend = reset;
      r.onerror = reset;
      rec.current = r;
      try { r.start(); setState('listening'); } catch { reset(); }
      return;
    }
    // No speech recognition in this browser: a demo dictation, word by word.
    const words = demo.split(' ');
    let k = 0;
    setState('demo');
    timer.current = window.setInterval(() => {
      k += 1;
      setInterim(words.slice(0, k).join(' '));
      if (k >= words.length) {
        window.clearInterval(timer.current);
        phrase.current(demo);
        reset();
      }
    }, 130);
  };

  useEffect(() => () => { rec.current?.abort(); window.clearInterval(timer.current); }, []);

  return { state, interim, live: !!recognitionCtor(), toggle: () => (state === 'idle' ? start() : stop()), stop };
}
