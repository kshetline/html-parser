import { ClosureState, CData, CommentElement, DeclarationElement, DocType, DomElement, DomNode, ProcessingElement,
  TextElement, UnmatchedClosingTag } from './dom';
import fs from 'fs';
import { isWhitespace, minimalEscape } from './characters';

const copyScript = fs.readFileSync('./src/copy-script.js', { encoding: 'utf8' });

type HtmlColor = 'attrib' | 'background' | 'comment' | 'entity' | 'error' | 'foreground' |
                 'markup' | 'tag' | 'value' | 'whitespace';

export interface HtmlStyleOptions {
  colors?: Record<HtmlColor, string>;
  dark?: boolean;
  font?: string;
  showWhitespace?: boolean;
  stylePrefix?: string;
}

const DEFAULT_OPTIONS = {
  dark: true,
  font: '12px Menlo, "Courier New", monospace',
  showWhitespace: false,
  stylePrefix: 'fh'
};

const DEFAULT_DARK_THEME: Record<HtmlColor, string> = {
  attrib: '#9CDCFE',
  background: '#1E1E1E',
  comment: '#699856',
  entity: '#6D9CBE',
  error: '#BC3F3C',
  foreground: '#D4D4D4',
  markup: '#808080',
  tag: '#569CD6',
  value: '#CE9178',
  whitespace: '#605070'
};

const DEFAULT_LIGHT_THEME: Record<HtmlColor, string> = {
  attrib: '#0000FF',
  background: '#FFFFFF',
  comment: '#80B0B0',
  entity: '#0000FF',
  error: '#D40000',
  foreground: '#222222',
  markup: '#808080',
  tag: '#000080',
  value: '#008088',
  whitespace: '#C0D0F0'
};

const COLORS = Object.keys(DEFAULT_LIGHT_THEME);

export function stylizeAsDocument(elem: DomElement, title?: string): string;
// tslint:disable-next-line:unified-signatures
export function stylizeAsDocument(elem: DomElement, options?: HtmlStyleOptions): string;

export function stylizeAsDocument(elem: DomElement, titleOrOptions?: string | HtmlStyleOptions, options?: HtmlStyleOptions): string {
  let title = 'Stylized HTML';

  if (typeof titleOrOptions === 'string')
    title = titleOrOptions;
  else
    options = titleOrOptions;

  options = processOptions(options);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
  <title>${title}</title>
  <style>
${generateCss(options)}  </style>
</head>
<body class="${options.stylePrefix}-html">${stylize(elem, options)}<script>
${copyScript.replace(/'\*-whitespace'/g, `'${options.stylePrefix}-whitespace'`)}
</script></body></html>`;
}

export function stylize(elem: DomElement, options?: HtmlStyleOptions): string {
  const pf = options.stylePrefix + '-';
  const ws = options.showWhitespace ? pf : null;

  if (elem instanceof CommentElement)
    return markup(elem.toString(), pf + 'comment', ws);
  else if (elem instanceof CData) {
    return markup('<![CDATA[', pf + 'markup', null) +
      markup(elem.content, null, ws) +
      markup(']]>', pf + 'markup', null);
  }
  else if (elem instanceof DocType) {
    return elem.toString().replace(/("[^"]*?"\s*|[^ ">]+\s*|.+)/g, match => {
      if (match.startsWith('"'))
        return markup(match, pf + 'value', ws);
      else if (/^\w/.test(match))
        return markup(match, pf + 'attrib', ws);
      else
        return markup(match, pf + 'markup', ws);
    });
  }
  else if (elem instanceof DeclarationElement || elem instanceof ProcessingElement)
    return markup(elem.toString(), pf + 'markup', ws);
  else if (elem instanceof TextElement)
    return markup(elem.toString(), null, ws);
  else if (elem instanceof UnmatchedClosingTag)
    return markup(elem.toString(), pf + 'error', ws);
  else if (elem instanceof DomNode) {
    const result: string[] = [];

    if (!elem.synthetic) {
      result.push(markup('<', pf + 'markup', null));
      result.push(markup(elem.tag, pf + 'tag', null));

      elem.attributes.forEach((attrib, index) => {
        result.push(markup(elem.spacing[index], null, ws));
        result.push(markup(attrib, pf + 'attrib', null));
        result.push(markup(elem.equals[index] || '', null, ws));
        result.push(markup(elem.quotes[index] + elem.values[index] + elem.quotes[index], pf + 'value', ws));
      });

      result.push(markup(elem.innerWhitespace, null, ws));

      if (elem.closureState === ClosureState.SELF_CLOSED)
        result.push(markup('/>', pf + 'markup', null));
      else
        result.push(markup('>', pf + 'markup', null));
    }

    if (elem.children)
      elem.children.forEach(child => result.push(stylize(child, options)));

    if (!elem.synthetic && elem.closureState === ClosureState.EXPLICITLY_CLOSED) {
      const terminated = elem.endTagText.endsWith('>');

      result.push(markup('</', pf + (terminated ? 'markup' : 'error'), null));

      if (terminated) {
        result.push(markup(elem.endTagText.substring(2, elem.endTagText.length - 1), pf + 'tag', ws));
        result.push(markup('>', pf + 'markup', null));
      }
      else
        result.push(markup(elem.endTagText.substr(2), pf + 'error', null));
    }

    return result.join('');
  }

  return null;
}

function processOptions(options: HtmlStyleOptions): HtmlStyleOptions {
  options = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options || {});
  options.colors = Object.assign(Object.assign({},
    options.dark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME), options.colors);

  return options;
}

function generateCss(options: HtmlStyleOptions) {
  const prefix = options.stylePrefix;

  let css =
`  .${prefix}-html {
    background-color: ${options.colors.background};
    color: ${options.colors.foreground};
    font: ${options.font};
    white-space: pre;
  }

`;

  COLORS.forEach(color => css +=
`  .${prefix}-${color} { color: ${(options.colors as any)[color]}; }
`);

  return css;
}

const whitespaces: Record<string, string> = {
  ' ': '·',
  '\t': '→\t',
  '\n': '↵\n',
  '\r': '␍\r',
  '\r\n': '␍↵\r\n'
};

function markup(s: string, qlass: string, separateWhitespace: string): string {
  if (!separateWhitespace && !qlass)
    return minimalEscape(s);
  else if (separateWhitespace) {
    return s.replace(/\s+|\S+/g, match => {
      if (isWhitespace(match.charAt(0))) {
        match = match.replace(/\r\n|./gs, ch => whitespaces[ch] || String.fromCharCode(0x2400 + ch.charCodeAt(0)));

        return markup(match, separateWhitespace + 'whitespace', null);
      }
      else if (qlass)
        return markup(match, qlass, null);
      else
        return minimalEscape(match);
    });
  }

  return `<span class="${qlass}">${minimalEscape(s)}</span>`;
}
