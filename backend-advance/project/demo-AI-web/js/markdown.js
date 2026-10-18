/* 轻量 Markdown 渲染：先转义 HTML，再支持常用语法，避免 XSS。 */
(function (window) {
  'use strict';

  var Jotang = window.Jotang = window.Jotang || {};
  var escapeHtml = Jotang.utils.escapeHtml;
  var sanitizeUrl = Jotang.utils.sanitizeUrl;
  var TOKEN_START = '\uE000';
  var TOKEN_END = '\uE001';
  var TOKEN_RE = /\uE000(\d+)\uE001/g;

  function restoreTokens(html, tokens) {
    var previous;
    do {
      previous = html;
      html = html.replace(TOKEN_RE, function (match, index) {
        return tokens[Number(index)] != null ? tokens[Number(index)] : match;
      });
    } while (html !== previous);
    return html;
  }

  function renderInline(source) {
    var text = String(source == null ? '' : source);
    var tokens = [];

    function stash(html) {
      var token = TOKEN_START + tokens.length + TOKEN_END;
      tokens.push(html);
      return token;
    }

    /* 行内代码与链接先抽出来，避免其中的 * _ 被当作强调符号 */
    text = text.replace(/`([^`\n]+)`/g, function (match, code) {
      return stash('<code>' + escapeHtml(code) + '</code>');
    });

    text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (match, label, url) {
      var safeUrl = sanitizeUrl(url);
      if (!safeUrl) return match;
      return stash('<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(label) + '</a>');
    });

    text = escapeHtml(text)
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
      .replace(/\n/g, '<br>');

    return restoreTokens(text, tokens);
  }

  function splitTableRow(line) {
    return line.trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(function (cell) { return cell.trim(); });
  }

  function isTableSeparator(line) {
    if (line.indexOf('|') === -1) return false;
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function renderTable(headerLine, separatorLine, rows) {
    var headers = splitTableRow(headerLine);
    var aligns = splitTableRow(separatorLine).map(function (cell) {
      var left = cell.charAt(0) === ':';
      var right = cell.charAt(cell.length - 1) === ':';
      if (left && right) return 'center';
      if (right) return 'right';
      return '';
    });

    function cell(tag, content, index) {
      var align = aligns[index] ? ' style="text-align:' + aligns[index] + '"' : '';
      return '<' + tag + align + '>' + renderInline(content) + '</' + tag + '>';
    }

    var html = ['<div class="md-table-wrap"><table><thead><tr>'];
    headers.forEach(function (content, index) {
      html.push(cell('th', content, index));
    });
    html.push('</tr></thead><tbody>');
    rows.forEach(function (row) {
      var cells = splitTableRow(row);
      html.push('<tr>');
      for (var i = 0; i < headers.length; i += 1) {
        html.push(cell('td', cells[i] == null ? '' : cells[i], i));
      }
      html.push('</tr>');
    });
    html.push('</tbody></table></div>');
    return html.join('');
  }

  function render(markdown) {
    var source = String(markdown == null ? '' : markdown).replace(/\r\n?/g, '\n');
    if (!source.trim()) return '';

    var codeBlocks = [];
    source = source.replace(/```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g, function (match, lang, code) {
      var language = String(lang || '').trim();
      var clean = code.replace(/\n$/, '');
      var token = TOKEN_START + 'CODE' + codeBlocks.length + TOKEN_END;
      codeBlocks.push(
        '<div class="md-code">' +
          '<div class="md-code-head"><span>' + escapeHtml(language || 'code') + '</span></div>' +
          '<pre><code>' + escapeHtml(clean) + '</code></pre>' +
        '</div>'
      );
      return token;
    });

    var lines = source.split('\n');
    var html = [];
    var paragraph = [];
    var quote = [];
    var listType = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push('<p>' + renderInline(paragraph.join('\n')) + '</p>');
      paragraph = [];
    }

    function flushQuote() {
      if (!quote.length) return;
      html.push('<blockquote><p>' + renderInline(quote.join('\n')) + '</p></blockquote>');
      quote = [];
    }

    function closeList() {
      if (!listType) return;
      html.push('</' + listType + '>');
      listType = null;
    }

    function flushAll() {
      flushParagraph();
      flushQuote();
      closeList();
    }

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      var trimmed = line.trim();

      if (!trimmed) {
        flushAll();
        continue;
      }

      var codeIndex = trimmed.match(new RegExp(TOKEN_START + 'CODE(\\d+)' + TOKEN_END));
      if (codeIndex && trimmed === codeIndex[0]) {
        flushAll();
        html.push(codeBlocks[Number(codeIndex[1])]);
        continue;
      }

      if (trimmed.indexOf('|') !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        flushAll();
        var rows = [];
        var j = i + 2;
        while (j < lines.length && lines[j].trim() && lines[j].indexOf('|') !== -1) {
          rows.push(lines[j]);
          j += 1;
        }
        html.push(renderTable(trimmed, lines[i + 1], rows));
        i = j - 1;
        continue;
      }

      var heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushAll();
        var level = heading[1].length;
        html.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushAll();
        html.push('<hr>');
        continue;
      }

      var quoteMatch = line.match(/^\s{0,3}>\s?(.*)$/);
      if (quoteMatch) {
        flushParagraph();
        closeList();
        quote.push(quoteMatch[1]);
        continue;
      }
      flushQuote();

      var listMatch = line.match(/^\s{0,3}([-*+]|\d+[.)])\s+(.+)$/);
      if (listMatch) {
        flushParagraph();
        var nextType = /^\d/.test(listMatch[1]) ? 'ol' : 'ul';
        if (listType && listType !== nextType) closeList();
        if (!listType) {
          listType = nextType;
          html.push('<' + listType + '>');
        }
        html.push('<li>' + renderInline(listMatch[2]) + '</li>');
        continue;
      }
      closeList();

      paragraph.push(trimmed);
    }

    flushAll();
    return html.join('');

  }

  Jotang.markdown = { render: render, renderInline: renderInline };
})(window);
