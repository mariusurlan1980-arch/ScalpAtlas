import { ANALYSIS_ENGINE_HTML as RAW_ENGINE_HTML } from './analysisEngine.ts';

// Android fix: the generic engine currently produces <\/script> in the HTML string.
// WebView does not treat that as a closing SCRIPT tag, so the engine never starts.
// Convert it to a real closing tag before the hidden analyzer WebView loads it.
export const ANALYSIS_ENGINE_HTML = RAW_ENGINE_HTML.replace('<\\/script>', '</script>');
