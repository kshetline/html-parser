import commander from 'commander';
import fg from 'fast-glob';
import fs from 'fs';

import { DomElement } from './dom';
import { HtmlParser } from './html-parser';
import { processMillis } from './util';

const keepAlive = setInterval(() => {}, 100);
const logDomTreeFlag = false;
const logErrorsFlag = true;
const logFilesFlag = true;
const logProgressFlag = false;
const logRebuiltFlag = false;
const logStatsFlag = true;

commander
  .option('-x, --exclude <exclude>', 'pattern for files/directories to exclude')
  .arguments('<globs...>')
  .action(async (globs: string[]) => {
    const options = {
      ignore: commander.exclude ? [commander.exclude] : undefined,
    };
    const files = fg.sync(globs, options);

    for (const file of files)
      await processFile(file);

    clearInterval(keepAlive);
  })
  .parse(process.argv);

async function processFile(file: string): Promise<void> {
  if (logFilesFlag)
    console.log('\n\n' + file);

  try {
    const content = fs.readFileSync(file, {encoding: 'utf8'});
    const startTime = processMillis();
    const parser = new HtmlParser();
    let rebuilt = '';

    await parser
      .onAttribute((leading, name, equals, value, quote) => {
        logProgress('attribute:', name + equals.trim() + quote + value + quote);
        rebuilt += leading + name + equals + quote + value + quote;
      })
      .onCData((depth, leading, cdata) => {
        logProgress('CDATA:', '<![CDATA[' + cdata + ']]>' + ' (' + depth + ')');
        rebuilt += leading + '<![CDATA[' + cdata + ']]>';
      })
      .onCloseTag((depth, leading, tag, trailing) => {
        logProgress('close:', '</' + tag + trailing + '>' + ' (' + depth + ')');
        rebuilt += leading + '</' + tag + trailing + '>';
      })
      .onComment((depth, leading, comment) => {
        logProgress('comment:', comment + ' (' + depth + ')');
        rebuilt += leading + '<!--' + comment + '-->';
      })
      .onDeclaration((depth, leading, declaration) => {
        logProgress('declaration:', '<!' + declaration + '>' + ' (' + depth + ')');
        rebuilt += leading + '<!' + declaration + '>';
      })
      .onEncoding(encoding => {
        if (logStatsFlag)
          console.log('*** Encoding: %s', encoding);

        return false;
      })
      .onEnd((trailing, domRoot, unclosed) => {
        rebuilt += trailing;

        const totalTime = processMillis() - startTime;
        let size = content.length / 1048576;
        const speed = (size / totalTime * 1000);

        if (logStatsFlag) {
          let unit = 'MB';

          if (size < 1) {
            unit = 'KB';
            size = content.length / 1024;
          }

          console.log('*** Finished %s%s in %s msec (%s MB/sec)', size.toFixed(2), unit, totalTime.toFixed(1), speed.toFixed(2));
          console.log('*** output matches input: ' + (rebuilt === content));
          console.log('*** unclosed tags: ' + unclosed);
        }

        if (rebuilt !== content && rebuilt !== content.replace(/\r\n|\n/g, '\n'))
          logErrors(rebuilt);
        else if (logRebuiltFlag)
          console.log(rebuilt);

        if (logDomTreeFlag)
          console.log(JSON.stringify(domRoot, (name, value) => {
            if (name === 'parent')
              return undefined;
            else if (value instanceof DomElement && value.content !== null)
              return value.toString();
            else
              return value;
          }, 2));
      })
      .onError((error, line, col, source) => {
        if (source)
          logErrors('*** %s ***', source);

        logErrors('*** %s: [%s, %s]', error, line, col);
        rebuilt += source || '';
      })
      .onOpenTagEnd((depth, leading, tag, end) => {
        logProgress('tag end:', end + ' (' + depth + ')');
        rebuilt += leading + end;
      })
      .onOpenTagStart((depth, leading, tag) => {
        logProgress('tag:', tag + ' (' + depth + ')');
        rebuilt += leading + '<' + tag;
      })
      .onProcessing((depth, leading, processing) => {
        logProgress('processing:', '<?' + processing + '>' + ' (' + depth + ')');
        rebuilt += leading + '<?' + processing + '>';
      })
      .onText((depth, leading, text, trailing) => {
        logProgress('text:', leading + text + trailing + ' (' + depth + ')');
        rebuilt += leading + text + trailing;
      })
      .onUnhandled((depth, leading, text, trailing = '') => {
        logProgress('???:', leading + text + trailing + ' (' + depth + ')');
        rebuilt += leading + text + trailing;
      })
      .parse(content);
  }
  catch (err) {
    console.error('Error reading file "%s": %s', file, err.toString());
  }
}

function logErrors(...args: any[]): void {
  if (logErrorsFlag)
    console.error(...args);
}

function logProgress(...args: any[]): void {
  if (logProgressFlag)
    console.log(...args);
}
