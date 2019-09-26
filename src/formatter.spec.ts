import { expect } from 'chai';
import fs from 'fs';
import { HtmlParser } from './html-parser';
import { DomNode } from './dom';
import { formatHtml, ValueQuoteStyle, ValueQuoting } from './formatter';
import { stylizeHtml } from './stylizer';
import { SMALL_SAMPLE } from './html-parser.spec';

describe('formatter', () => {
  const content = fs.readFileSync('./test/sample.html', 'utf-8');
  const parser = new HtmlParser();
  let dom: DomNode;
  let reformatted: string;

  before(async () => {
    dom = (await parser.parse(content)).domRoot;
  });

  it('should format HTML', () => {
    formatHtml(dom, {
      indent: 2,
      continuationIndent: 4,
      valueQuoting: ValueQuoting.UNQUOTE_SIMPLE_VALUES
    });

    try {fs.mkdirSync('./test-output'); } catch (err) {}
    fs.writeFileSync('./test-output/sample-reformatted.html', stylizeHtml(dom,
      { showWhitespace: true, title: 'Reformatted HTML'}), { encoding: 'utf8' });

    reformatted = dom.toString();

    expect(reformatted).contains('foo="=bar/baz&"');
    expect(reformatted).contains(' class=inner-wrapper ');
  });

  it('should transform quotes to single quotes', async () => {
    parser.reset();
    dom = (await parser.parse(SMALL_SAMPLE)).domRoot;
    formatHtml(dom, {
      indent: 2,
      continuationIndent: 4,
      valueQuoting: ValueQuoting.ALWAYS_QUOTE,
      valueQuoteStyle: ValueQuoteStyle.SINGLE
    });

    reformatted = dom.toString();

    expect(reformatted).contains("charset='utf-8'");
    expect(reformatted).contains(" alt='can&apos;t'/>");
  });

  it('should unquote integers', async () => {
    parser.reset();
    dom = (await parser.parse(SMALL_SAMPLE)).domRoot;
    formatHtml(dom, {
      indent: 2,
      continuationIndent: 4,
      valueQuoting: ValueQuoting.UNQUOTE_INTEGERS
    });

    reformatted = dom.toString();

    expect(reformatted).contains('charset="utf-8"');
    expect(reformatted).contains(' width=32 height=32 ');
  });

  it('should unquote simple values and add spaces around =', async () => {
    parser.reset();
    dom = (await parser.parse(SMALL_SAMPLE)).domRoot;
    formatHtml(dom, {
      indent: 2,
      continuationIndent: 4,
      spaceAroundAttributeEquals: true,
      valueQuoting: ValueQuoting.UNQUOTE_SIMPLE_VALUES
    });

    reformatted = dom.toString();

    expect(reformatted).contains('charset = utf-8');
    expect(reformatted).contains(' width = 32 height = 32 ');
  });
});
