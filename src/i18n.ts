export type Language = 'en' | 'zh';
const en = {
  home: 'Token Visualizer home', language: 'Interface language', whitespace: 'Show whitespace', compare: '＋ Compare models', endCompare: '− End comparison',
  input: 'Input text', clear: 'Clear', placeholder: 'Type or paste text here…', characters: 'characters', codePoints: 'code points',
  charactersHelp: 'Grapheme clusters: approximately the characters you see, including spaces and line breaks.',
  codePointsHelp: 'Unicode code points. One visible character can contain several code points.',
  bytesHelp: 'The number of bytes needed to encode the original input as UTF-8.',
  privacy: 'Local tokenization. Your input is never uploaded.', limit: 'Up to 100,000 Unicode code points per input. Your text is kept; shorten it to continue.', tooLong: 'Input exceeds the limit',
  legend: 'Shared characters use equal-width token colors, not byte proportions.', whitespaceLegend: '· space   ⇥ tab   ↵ line feed (\\n)',
  scope: 'Raw text only. No added BOS / EOS or chat template.', about: 'About tokenizers & display',
  aboutCache: 'Official Hugging Face tokenizer files load on demand, with pinned revisions and SHA-256 verification. Files are cached in this browser; model weights are never downloaded.',
  aboutBytes: 'Shared characters keep their complete shape. Background slices and the thin color rail are divided equally among contributing tokens. Width does not indicate byte count, strokes, or meaning. Hover a slice or use the token buttons in the details. Token pieces shows one block per token, using hex for incomplete UTF-8 fragments. Line breaks, spaces, and tabs retain their layout; whitespace markers are optional. Byte ranges refer to tokenized text; NFC normalization (Qwen) may change the input.',
  aboutScope: 'Special token spellings follow the official vocabulary. Image, audio, and API chat-template overhead are not included.',
  keyboardHelp: 'Keyboard: Tab to focus tokens, ← / → to browse, Enter to pin, Esc to unpin.',
  clearCache: 'Clear tokenizer cache', cacheCleared: 'Cache cleared. The next tokenization downloads it again.', cacheUnavailable: 'Browser cache is unavailable.',
  model: 'Tokenizer', vocabItems: 'vocabulary entries', source: 'Official source', revision: 'Pinned revision', downloadProgress: 'Tokenizer download progress', resultViews: 'Result view', resultLabel: 'Tokenization result',
  textView: 'Text', piecesView: 'Token pieces', idsView: 'IDs',
  textHelp: 'Intact characters with token-colored backgrounds.', piecesHelp: 'One color per token. Original line breaks, spaces, and tabs keep their layout; incomplete UTF-8 uses hex.', idsHelp: 'Token IDs in encoding order.', copy: 'Copy IDs', copied: 'Copied', copyFailed: 'Copy failed', reload: 'Reload', emptyStatus: 'Enter text to load the tokenizer', waiting: 'Waiting…', encoding: 'Tokenizing…',
  ready: 'Ready', cached: 'tokenizer cached', sessionCache: 'session cache only', cacheState: 'Cache cleared · reload on next use',
  empty: 'Type or paste text\nto explore token boundaries.', preparing: 'Preparing tokens…', overLimit: 'Shorten the input to continue.', noTokens: 'No tokens',
  errorTitle: 'Tokenizer unavailable', retryHelp: 'Check access to Hugging Face and retry.', workerError: 'The tokenizer worker could not start.',
  normalization: 'This tokenizer normalized the input. The text and byte offsets below may differ from the original.',
  previous: '← Previous', next: 'Next →', details: 'TOKEN DETAILS', hoverHint: 'Hover to inspect · click to pin', previewHint: 'Preview · click to pin', pinnedHint: 'Pinned', unpin: 'Unpin',
  inspectPlaceholder: 'Inspect a token to see its ID and original bytes.', special: 'Special token', fragment: 'UTF-8 fragment', length: 'Length', byteRange: 'Byte range', vocabPiece: 'Vocab piece',
  byteRangeHelp: 'Zero-based UTF-8 byte offsets in the tokenized text: start included, end excluded.',
  vocabPieceHelp: 'The raw string stored in the tokenizer vocabulary. ByteLevel symbols represent bytes, not the decoded text.',
  fragmentNote: 'These bytes need adjacent tokens to form complete Unicode characters.', specialNote: 'Bytes and hex show the UTF-8 spelling of this special token.',
  shared: 'Shared character', sharedAria: '{text}, shared by {count} tokens', sharedHelp: 'Equal-width token slices; width does not indicate byte count. Choose a token:', memberAria: 'Inspect token {index}, ID {id}',
  reconstructed: 'Decoded together', tokens: 'tokens', tokenAria: 'Token {index}, ID {id}, {text}',
} as const;
export type MessageKey = keyof typeof en;
const zh: Record<MessageKey, string> = {
  home: 'Token Visualizer 首页', language: '界面语言', whitespace: '显示空白', compare: '＋ 对比模型', endCompare: '− 结束对比',
  input: '输入文本', clear: '清空', placeholder: '在这里输入或粘贴文本…', characters: '字符', codePoints: '码点',
  charactersHelp: '按字素簇计数，接近肉眼感知的字符数，包含空格和换行。', codePointsHelp: 'Unicode 码点数。一个可见字符可能由多个码点组成。', bytesHelp: '原始输入编码为 UTF-8 后占用的字节数。',
  privacy: '仅在浏览器本地分词，输入内容不会上传。', limit: '单次最多 100,000 个 Unicode 码点。输入已保留，请缩短后继续。', tooLong: '超出单次分词上限',
  legend: '共享字符的色区等宽，表示参与的 token，不表示字节数。', whitespaceLegend: '· 空格   ⇥ Tab   ↵ 换行（\\n）', scope: '仅对原始文本分词；不添加 BOS / EOS 或聊天模板。', about: '关于分词器与显示',
  aboutCache: '分词器从 Hugging Face 官方仓库按需下载，固定版本并校验 SHA-256。文件缓存在浏览器中；不下载模型权重。',
  aboutBytes: '跨 token 字符保持完整字形，分色背景和底部细色带按参与的 token 等宽划分，宽度不表示字节数、笔画或语义。可悬停色区，或使用详情中的 token 按钮选择。分词片段视图中，每个 token 独立成块，不完整 UTF-8 显示为 hex；保留换行、空格及 Tab 布局，空白开关只控制提示符号。字节区间对应分词后文本；Qwen 的 NFC 归一化可能改变输入。',
  aboutScope: '特殊 token 拼写按官方词表识别。不包含图片、音频或 API 聊天模板开销。', keyboardHelp: '键盘：Tab 聚焦 token，← / → 浏览，Enter 固定，Esc 取消固定。',
  clearCache: '清除分词器缓存', cacheCleared: '缓存已清除，下次分词会重新下载。', cacheUnavailable: '当前浏览器无法访问缓存。',
  model: '分词模型', vocabItems: '词表项', source: '官方来源', revision: '固定版本', downloadProgress: '分词器下载进度', resultViews: '结果视图', resultLabel: '分词结果',
  textView: '文本', piecesView: '分词片段', idsView: 'IDs',
  textHelp: '完整字符与分 token 背景。', piecesHelp: '每个 token 独立着色；保留原有换行、空格与 Tab 布局，不完整 UTF-8 显示为 hex。', idsHelp: '按编码顺序显示 token ID。', copy: '复制 IDs', copied: '已复制', copyFailed: '复制失败', reload: '重新加载', emptyStatus: '输入文本后加载分词器', waiting: '等待分词…', encoding: '正在分词…',
  ready: '就绪', cached: '分词器已缓存', sessionCache: '仅本次会话缓存', cacheState: '缓存已清除 · 下次分词重新加载',
  empty: '输入或粘贴文本，\n观察每一个 token 的边界。', preparing: '正在准备分词结果…', overLimit: '请缩短输入后继续。', noTokens: '没有 token',
  errorTitle: '分词器不可用', retryHelp: '请检查网络是否可访问 Hugging Face 后重试。', workerError: '分词线程未能启动。', normalization: '此模型对输入进行了归一化。下方文本及字节位置可能与原始输入不同。',
  previous: '← 上一页', next: '下一页 →', details: 'TOKEN 详情', hoverHint: '悬停查看 · 点击固定', previewHint: '预览 · 点击固定', pinnedHint: '已固定', unpin: '取消固定',
  inspectPlaceholder: '选择一个 token，查看 ID 与原始字节。', special: '特殊 token', fragment: 'UTF-8 片段', length: '长度', byteRange: '字节区间', vocabPiece: '词表表示',
  byteRangeHelp: '分词后文本中的 UTF-8 字节位置，从 0 开始，含起点、不含终点。', vocabPieceHelp: 'tokenizer 词表中保存的原始字符串。ByteLevel 符号代表字节，不是解码后的文本。',
  fragmentNote: '这些字节需要与相邻 token 合并，才能组成完整的 Unicode 字符。', specialNote: 'bytes / hex 对应该特殊 token 文本拼写的 UTF-8 字节。',
  shared: '共享字符', sharedAria: '{text}，由 {count} 个 token 共享', sharedHelp: '色区等宽，不表示字节数。选择 token：', memberAria: '查看第 {index} 个 token，ID {id}',
  reconstructed: '合并解码', tokens: 'tokens', tokenAria: '第 {index} 个 token，ID {id}，{text}',
};
let language: Language = 'en';
try { if (localStorage.getItem('token-visualizer-language') === 'zh') language = 'zh'; } catch { /* optional preference */ }
export const getLanguage = () => language;
export function setLanguage(value: Language) {
  language = value;
  try { localStorage.setItem('token-visualizer-language', value); } catch { /* private browsing */ }
}
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const message = (language === 'zh' ? zh : en)[key];
  return message.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}
// Worker diagnostics stay independent of the UI locale; translate at the boundary.
export function diagnostic(text: string): string {
  if (language === 'zh') return text;
  const replacements: Record<string, string> = {
    '读取本地缓存': 'Reading local cache', '下载分词器': 'Downloading tokenizer', '初始化分词器': 'Initializing tokenizer',
    '文件大小不匹配，请重试。': 'File size mismatch. Retry.', '完整性校验失败，请重试。': 'Integrity check failed. Retry.',
    '下载失败（HTTP': 'Download failed (HTTP', '）': ')', '浏览器不支持流式下载。': 'Streaming downloads are unavailable.',
    '下载文件超出预期大小。': 'Download exceeds the expected size.', '分词失败，请重试。': 'Tokenization failed. Retry.',
    '不支持此 tokenizer 格式，请为它添加独立的 adapter。': 'Unsupported tokenizer format.',
    '此 tokenizer 不是受支持的 ByteLevel 编码。': 'Unsupported ByteLevel encoding.',
  };
  for (const [source, target] of Object.entries(replacements)) text = text.replaceAll(source, target);
  return text;
}
