import { ANALYSIS_ENGINE_HTML as RAW_ENGINE_HTML } from './analysisEngine.ts';

// Android compatibility: normalize any escaped closing SCRIPT tag before
// the hidden WebView receives the HTML. Different bundler/transpiler paths
// may leave one or more backslashes before /script.
const normalizedEngineHtml = RAW_ENGINE_HTML.replace(/<\\+\/script>/g, '</script>');

// v0.2.6: expiration is a separate recommendation from the chart timeframe.
// Keep BUY/SELL analysis untouched and use one clear, predictable expiry map.
const expiryPatchedEngineHtml = normalizedEngineHtml
  .replace("const ENGINE_VERSION='0.2.3';", "const ENGINE_VERSION='0.2.6';")
  .replace(
    /function expiryFor\(tf,score\)\{[\s\S]*?return mins;\n  \}/,
    `function expiryFor(tf,score){
    const EXPIRY_MIN={M1:3,M2:6,M3:9,M5:12,M10:15,M15:20,M30:30,H1:45};
    return EXPIRY_MIN[tf]||12;
  }`
  );

export const ANALYSIS_ENGINE_HTML = expiryPatchedEngineHtml;
