#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
data/default_topics.csv の内容を js/data.js の EMBEDDED_CSV に反映するスクリプト。

CSV を差し替えたら、このスクリプトを1回実行してください。
（APK や file:// 実行時は fetch が使えないため、data.js 内の埋め込みデータが使われます）

使い方:
    cd ito-app
    python3 tools/embed_csv.py
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, 'data', 'default_topics.csv')
JS_PATH = os.path.join(ROOT, 'js', 'data.js')

START = '  var EMBEDDED_CSV = ['
END = "  ].join('\\n');"


def js_string(line):
    return "'" + line.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    if not os.path.exists(CSV_PATH):
        print('CSV が見つかりません:', CSV_PATH)
        return 1

    with io.open(CSV_PATH, encoding='utf-8-sig') as f:
        lines = [l.rstrip('\r\n') for l in f if l.strip()]

    body = ',\n'.join('    ' + js_string(l) for l in lines)
    block = START + '\n' + body + '\n' + END

    with io.open(JS_PATH, encoding='utf-8') as f:
        js = f.read()

    i = js.find(START)
    j = js.find(END, i)
    if i < 0 or j < 0:
        print('data.js の EMBEDDED_CSV ブロックが見つかりません')
        return 1

    js = js[:i] + block + js[j + len(END):]
    with io.open(JS_PATH, 'w', encoding='utf-8') as f:
        f.write(js)

    print('埋め込みデータを更新しました:', len(lines), '行（ヘッダ含む）')
    print('※ sw.js の APP_VERSION も上げるとキャッシュが確実に更新されます')
    return 0


if __name__ == '__main__':
    sys.exit(main())
