import { ANALYSIS_ENGINE_HTML as RAW_ENGINE_HTML } from './analysisEngine.ts';

// Android compatibility: Metro may resolve TypeScript before JavaScript.
// Keep the same normalization here so the hidden WebView always receives
// a real </script> closing tag and the Atlas engine can start.
export const ANALYSIS_ENGINE_HTML = RAW_ENGINE_HTML.replace(/<\\+\/script>/g, '</script>');
