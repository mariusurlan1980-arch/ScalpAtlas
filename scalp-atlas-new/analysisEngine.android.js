import { ANALYSIS_ENGINE_HTML as RAW_ENGINE_HTML } from './analysisEngine.ts';

// Android compatibility: normalize any escaped closing SCRIPT tag before
// the hidden WebView receives the HTML. Different bundler/transpiler paths
// may leave one or more backslashes before /script.
export const ANALYSIS_ENGINE_HTML = RAW_ENGINE_HTML.replace(/<\\+\/script>/g, '</script>');
