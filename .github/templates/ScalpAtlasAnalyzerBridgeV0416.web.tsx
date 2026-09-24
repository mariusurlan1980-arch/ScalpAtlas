import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type AnalyzerMessageEvent = { nativeEvent: { data: string } };
export type AnalyzerBridgeHandle = { postMessage: (data: string) => void };

type Props = { html: string; onMessage: (event: AnalyzerMessageEvent) => void };

export const AnalyzerBridge = forwardRef<AnalyzerBridgeHandle, Props>(({ html, onMessage }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    postMessage(data: string) {
      iframeRef.current?.contentWindow?.postMessage(data, '*');
    },
  }));

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      onMessage({ nativeEvent: { data } });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      title="Scalp Atlas Analyzer"
      aria-hidden="true"
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -100, top: -100, border: 0 }}
    />
  );
});
