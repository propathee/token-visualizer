# Developer guide

Implementation and maintenance notes for developers and coding agents. See the [README](../README.md) for the user-facing overview.

## Local development

Use Node.js 24.5 or newer. The CI workflows use Node 24.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. To build and preview the static site:

```sh
npm run build
npm run preview
```

The build runs TypeScript checks and writes `dist/`. It does not download tokenizer assets or bundle model weights. The application uses TypeScript, Vite, and the pinned `@huggingface/tokenizers` dependency in [package.json](../package.json).

## GitHub Pages deployment

1. Push the repository to GitHub with `main` as the deployment branch, or change the branch in [pages.yml](../.github/workflows/pages.yml).
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
3. Push to `main` or manually run **Deploy to GitHub Pages**.
4. The workflow tests, builds, and uploads `dist/`, then publishes it through the `github-pages` environment. Use the URL returned by the deployment.

[Vite configuration](../vite.config.ts) uses `base: './'`. Keep asset and worker URLs relative so both repository subpaths and custom domains work. No backend or API key is required.

## Code map

| Area | Files |
| --- | --- |
| Model registry and provenance | [models.json](../src/models.json), [models.ts](../src/models.ts) |
| Downloads, caching, worker lifecycle | [cache.ts](../src/tokenizer/cache.ts), [worker.ts](../src/tokenizer/worker.ts) |
| Tokenizer adapter and byte recovery | [engine.ts](../src/tokenizer/engine.ts), [bytes.ts](../src/tokenizer/bytes.ts) |
| Grapheme mapping, pagination, piece rendering | [layout.ts](../src/tokenizer/layout.ts), [pieces.ts](../src/tokenizer/pieces.ts), [fragment.ts](../src/tokenizer/fragment.ts) |
| Input, result panels, model menu | [main.ts](../src/main.ts), [panel.ts](../src/panel.ts), [model-picker.ts](../src/model-picker.ts) |
| Language, input counts, styling | [i18n.ts](../src/i18n.ts), [text-metrics.ts](../src/text-metrics.ts), [style.css](../src/style.css) |

## Tokenizer assets and lifecycle

The model registry is the source of truth for upstream repositories, pinned revisions, file sizes, SHA-256 hashes, vocabulary sizes, normalization, and adapter selection. Avoid duplicating this metadata in documentation.

- DeepSeek V4 uses the official `DeepSeek-V4-Pro` tokenizer; the verified V4 Flash tokenizer was byte-identical. V4.1 uses its own `DeepSeek-V4.1-Flash` files.
- All current models use the `hf-byte-bpe` adapter. Kimi-K3 is not supported; its custom tokenizer requires a separate adapter and parity checks.
- Each result panel creates a worker only when there is text to tokenize. Opening the model menu does not download anything.
- Switching models or removing a comparison panel terminates its old worker. Request IDs prevent stale results from replacing newer input; loading coalesces pending input to the latest request.
- Assets are downloaded from official Hugging Face repositories, checked against the registry, and stored in Cache API under pinned URLs. Cache hits are verified again; corrupt entries are downloaded again.
- Storage denial or quota exhaustion falls back to the current session. Downloads never include the input text. Only the language preference is stored in localStorage.

Do not commit tokenizer JSON files, vocabularies, or model weights. Upstream assets retain their own licenses; review those licenses when adding a model or changing distribution. The tokenizer library is Apache-2.0 licensed. Its license is included in the deployed site through [third-party-notices.txt](../public/third-party-notices.txt).

## Token and rendering semantics

These are compatibility constraints when changing the UI or adding adapters:

- Encode raw text with `add_special_tokens: false`. Do not insert BOS/EOS tokens or apply a chat template. Special-token spellings already present in the input still follow the official tokenizer.
- Recover ByteLevel bytes from the vocabulary representation, not by re-encoding decoded replacement characters. For example, `Ġ` represents the space byte. A genuine `�` in the input must remain distinguishable from incomplete UTF-8.
- Added-token bytes represent the UTF-8 spelling of that token. Byte ranges are zero-based, half-open intervals in the **tokenized text**, not necessarily the original input. Qwen's NFC normalization can change that text; retain the normalization notice.
- **Text** renders complete grapheme clusters. A character shared by several tokens has equal-width background slices, a color rail, and matching hit regions. The enlarged preview uses the same divisions. Width does not represent byte count; byte data must remain unchanged.
- Preserve ZWJ sequences, variation selectors, emoji tags, and combining characters within graphemes. Standalone invisible controls or marks use visible Unicode escapes. Emoji appearance depends on the browser and system fonts.
- **Token pieces** gives each token its own selectable representation. Preserve actual line breaks, blank lines, spaces, and tab stops. The whitespace switch only changes markers. In partial UTF-8 tokens, retain ASCII layout whitespace and show the remaining bytes as hex; all rendered segments still belong to one token.
- **IDs** follows encoding order. Switching views must retain the pinned token, current page, count, and full copied ID array without reloading or retokenizing.
- Colors cycle by token position. A token that spans multiple display units keeps its identity and color. Pages target roughly 500 tokens but may extend to avoid splitting or duplicating a token or grapheme.

Input is limited to 100,000 Unicode code points. Keep oversized input intact and show a message. Statistics distinguish grapheme clusters, code points, and UTF-8 bytes: `👩🏽‍💻`, for example, is one grapheme, four code points, and 15 bytes. Grapheme segmentation uses the browser's `Intl.Segmenter`.

Hover previews remain available while moving into the details; leaving the result panel clears an unpinned preview. Clicking pins a token. Preserve keyboard access and the larger token buttons for narrow slices. Language changes must retain input and selection.

Keep result viewports and detail panels aligned across models. In parallel layouts, the input editor's bottom aligns with the output/detail divider; input statistics remain below it. Put normalization notices inside the output viewport so they do not shift the divider.

## Adding a model

1. Verify the official source, license, and exact revision. Fetch the tokenizer files outside the repository.
2. Add a registry entry with file sizes, SHA-256 hashes, vocabulary size, normalization, and engine. The model menu is generated from this registry.
3. For compatible ByteLevel BPE files, use `hf-byte-bpe`. Other formats need an implementation of `TokenizerAdapter`; unsupported formats must fail explicitly rather than use an approximate replacement.
4. Generate independent reference results and run parity checks before treating the model as supported.

## Validation

```sh
npm test               # Offline tests; model integration tests skip without assets
npm run build          # TypeScript checks and production build
npm run verify:models  # Download pinned assets and compare against reference results
```

[verify-models.mjs](../scripts/verify-models.mjs) verifies asset sizes and hashes, runs the real adapter against reference data, and removes its temporary downloads afterward. It uses Node's environment proxy support (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`). Network failure fails verification rather than substituting another tokenizer.

[reference.json](../tests/reference.json) contains 69 cases per model, currently 276 cases in total, generated independently with the Rust backend of Hugging Face `tokenizers==0.23.3`. Checks cover token IDs, decoded text, reconstructed bytes, grapheme mapping, and lossless pagination. This is a regression corpus, not exhaustive Unicode coverage.

To update reference fixtures, prepare pinned assets outside the repository as `<model-id>-tokenizer.json`, install the Python package above, and run:

```sh
python scripts/generate-reference.py /path/to/pinned-tokenizer-assets
```

The [generator](../scripts/generate-reference.py) verifies tokenizer hashes before generating fixtures. Integration tests also need matching `<model-id>-tokenizer_config.json` files; `npm run verify:models` supplies both automatically.

Unit and DOM tests cover caching failures, request races, byte fragments, grapheme preservation, equal-width slices, whitespace, view switching, selection, keyboard controls, model menus, and copying IDs. For rendering or layout changes, also check the app in a browser: shared emoji, whitespace, dropdown clipping, narrow viewports, and GitHub Pages subpaths cannot all be verified by DOM tests alone.

[PR checks](../.github/workflows/check.yml) run offline tests and a build. Run that workflow manually with `verify_models` enabled for network-dependent parity checks.

## Runtime limits

Use a modern browser with module workers, ES2022, `Intl.Segmenter`, Web Crypto, and Cache API. Serve over HTTPS or localhost. The model menu uses Popover when available, with a positioned fallback.

First use of a model requires access to Hugging Face and its file delivery domains. Cached models can continue working in an already-open page without the network, but there is no Service Worker to guarantee offline page reloads. Browsers may evict cached files or restrict persistent storage.

Counts cover raw text only. Image/audio processing, API chat-template overhead, model inference, and cost estimation are outside the current scope.
