"""Generate small golden fixtures with Hugging Face's Rust tokenizer backend.
Usage: python scripts/generate-reference.py /path/to/pinned-tokenizer-assets
Requires: tokenizers==0.23.3. Assets are never copied into the repository.
"""
import hashlib
import json
import pathlib
import sys
import tokenizers

root = pathlib.Path(__file__).resolve().parents[1]
assets = pathlib.Path(sys.argv[1])
models = json.loads((root / 'src/models.json').read_text())
texts = [
    '', 'Hello, world!\n你好，世界！',
    'token tokenization Token TOKEN tokens',
    '你好世界。人工智能如何理解语言？',
    '落霞与孤鹜齐飞，秋水共长天一色。',
    '日本語のトークン。カタカナ ひらがな 한글 테스트',
    'مرحبا بالعالم שלום עולם नमस्ते दुनिया',
    'Привет мир! Ελληνικά İı ſ K ß café',
    '👩🏽‍💻 🧑‍🚀 🇨🇳 🏳️‍🌈 👍🏿 🫠',
    '𠀀𠮷𩸽 \U00031350 \U0001FAE8',
    'e\u0301 é A\u030a Å \u212b \u1100\u1161 가',
    '  hello   world \t\tend  ',
    '\n\n\t\r\n \rtest\n',
    '\x00\x01\x0b\x0c\x1c\x1d\x1e\x1f\x7f\x85\xa0\u1680\u2000\u2028\u2029\u202f\u205f\u3000\ufeff',
    'a\u200bb\u200cc\u200dd\u200ee\u200ff\u2060g',
    "I'm I'M we're WE'RE don't DON'T you've YOU'VE he'll HE'LL she'd SHE'D",
    '1234567890 000123 1.234e-05 ２０２６ ١٢٣٤٥٦ १२३',
    'foo_bar fooBar .git /usr/bin ~/repo -> => != === ++ --',
    'def hello(name):\n\treturn f"Hello, {name}!"\n',
    '{"key": [true, false, null, 123], "emoji": "🌱"}',
    'https://example.com/a?x=1&y=%20 user@example.org',
    '<script>alert("xss")</script> & < > " \'',
    '<｜begin▁of▁sentence｜>Hello<｜end▁of▁sentence｜>',
    '<｜image｜><｜deepseek_image｜><｜image2｜><｜User｜><｜Assistant｜>',
    '[gMASK]<sop><|user|>你好<|assistant|><think>思考</think>',
    '<|im_start|>user\nhi<|im_end|><|endoftext|>',
    'a' * 300 + ' ' + '😃' * 30,
    '\ufeffhello\ufeffworld',
    ' Leading and trailing spaces. \n',
]
# Reproducible mixed-script corpus exercises regex splitting beyond hand examples.
import random
rng = random.Random(42)
atoms = ['a', 'Z', '中', '文', 'あ', '한', 'é', '\u0301', 'İ', 'ß', '1', '４', '١', ' ', '\t', '\n', '\r', '\xa0', '\x85', '\ufeff', '!', "'", '.', '_', '🦉', '\u200d']
texts += [''.join(rng.choice(atoms) for _ in range(50)) for _ in range(40)]
output = {'reference': 'Hugging Face tokenizers ' + tokenizers.__version__ + ' (Rust backend)', 'models': {}}
for model in models:
    path = assets / (model['id'] + '-tokenizer.json')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == model['files'][0]['sha256']
    tokenizer = tokenizers.Tokenizer.from_file(str(path))
    cases = []
    for text in texts:
        enc = tokenizer.encode(text, add_special_tokens=False)
        cases.append({'text': text, 'ids': enc.ids, 'decoded': tokenizer.decode(enc.ids, skip_special_tokens=False)})
    output['models'][model['id']] = {'revision': model['revision'], 'cases': cases}
(root / 'tests/reference.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(f'Generated {len(texts)} reference cases for each of {len(models)} models.')
