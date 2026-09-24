import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export type AnalyzerMessageEvent = WebViewMessageEvent;
export type AnalyzerBridgeHandle = { postMessage: (data: string) => void };

type Props = { html: string; onMessage: (event: AnalyzerMessageEvent) => void };

export const AnalyzerBridge = forwardRef<AnalyzerBridgeHandle, Props>(({ html, onMessage }, ref) => {
  const webViewRef = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({
    postMessage(data: string) {
      webViewRef.current?.postMessage(data);
    },
  }));
  return (
    <WebView
      ref={webViewRef}
      source={{ html }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled={false}
      onMessage={onMessage}
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -20, top: -20 }}
    />
  );
});
