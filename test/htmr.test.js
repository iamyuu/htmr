/* eslint-env jest */
import React from 'react';
import ReactDOM from 'react-dom';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import renderer from 'react-test-renderer';
import { render } from '@testing-library/react';
import snapshot from 'jest-snapshot';
import diff from 'jest-diff';
import { oneLineTrim } from 'common-tags';

import htmrServer from '../src';
import htmrBrowser from '../src/index.browser';

describe('core', () => {
  test('it works', () => {
    const html = '<p>This is cool</p>';
    testRender(html);
  });

  test('make sure HTML is string', () => {
    const error = new Error('Expected HTML string');
    const fixtures = [null, [], {}, 1, true];

    // server & browser
    expect.assertions(fixtures.length * 2);

    fixtures.forEach((fixture) => {
      expect(() => htmrServer(fixture)).toThrow(error);
      expect(() => htmrBrowser(fixture)).toThrow(error);
    });
  });

  test('self closing component', () => {
    const html = oneLineTrim`
    <div>
      <img src="https://www.google.com/logo.png" />
    </div>`;

    testRender(html);
  });

  test('multi children', () => {
    const html = '<p>Multi</p><p>Component</p>';

    testRender(html);
  });

  test('element inside text node', () => {
    const html = 'what are <strong>you</strong> doing?';
    testRender(html);
  });

  test('ignore comment', () => {
    const html = '<!-- comment should be ignored--><div>no comment</div>';
    testRender(html);
  });

  test('ignore multiline html comment', () => {
    const html = [
      '<!--<div>\n<p>multiline</p> \t</div>-->',
      '<div>no multiline comment</div>',
    ].join('');

    testRender(html);
  });
});

describe('attributes', () => {
  test('correctly map HTML attributes to react props', () => {
    const html = oneLineTrim`
    <div>
      <label class="input-text" for="name"></label>
      <div id="test" data-type="calendar" aria-describedby="info" spellcheck="true" contenteditable></div>
      <link xml:lang="en" xlink:actuate="other" />
      <svg viewbox="0 0 24 24" fill-rule="evenodd" color-interpolation-filters="sRGB">
        <path fill="#ffa0"></path>
      </svg>
      <img srcset="https://img.src" crossorigin="true"></img>
      <iframe srcdoc="<p>html</p>" allowfullscreen></iframe>
      <input autocomplete="on" autofocus readonly="readonly" maxlength="10" />
      <button accesskey="s">Stress reliever</button>
      <time datetime="2018-07-07">July 7</time>
    </div>`;

    testRender(html);
  });

  // https://github.com/pveyes/htmr/issues/103
  test('correctly handle boolean attributes', () => {
    const html = '<iframe allowfullscreen />';

    const { container } = render(htmrBrowser(html));
    expect(
      container.querySelector('iframe').getAttribute('allowfullscreen')
    ).toEqual('');
  });

  test('convert style values', () => {
    const html = [
      '<div style="margin: 0 auto; padding: 0 10px">',
      '<span style="font-size: 12"></span>',
      '</div>',
    ].join('');

    testRender(html);
  });

  test('css vendor prefixes', () => {
    const html = `
      <div style="-ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%">
        prefix
      </div>
    `;

    testRender(html);
  });

  test('css html entities', () => {
    const html =
      '<div style="font-family: Consolas, &quot;Liberation Mono &quot;"></div>';

    testRender(html);
  });

  test('ignore invalid style', () => {
    const html =
      '<div class="component-overflow" style="TITLE_2">Explore Categories</div>';
    testRender(html);
  });

  test('ignore partially invalid style', () => {
    const html =
      '<div class="component-overflow" style="TITLE_2; color:\'red\'">Explore Categories</div>';
    testRender(html);
  });

  test('style with url & protocol', () => {
    const html =
      '<div class="tera-promo-card--header" style="background-image:url(https://d1nabgopwop1kh.cloudfront.net/xx);"></div>';

    testRender(html);
  });

  test('preserve child of style tag', () => {
    const html = `
      <style>
        ul > li {
          list-style: none
        }
  
        div[data-id="test"]:not(.y) {
          display: none;
        }
      </style>
    `;

    testRender(html);
  });
});

describe('encoding', () => {
  test('unescape html entities', () => {
    const html = '<div class="entities">&amp; and &</div>';
    testRender(html);
  });

  test('decode html entities on defaultMap', () => {
    const html = '<div class="entities">&amp; and &</div>';
    testRender(html, {
      transform: {
        _: (node, props, children) => {
          if (typeof props === 'undefined') {
            return node;
          }

          return <p>{children}</p>;
        },
      },
    });
  });

  test('decode html attributes', () => {
    const html = '<a href="https://www.google.com/?a=b&amp;c=d">test</a>';
    testRender(html);
  });
});

describe('options', () => {
  describe('transform', () => {
    test('custom component', () => {
      const html = '<p data-custom="true">Custom component</p>';

      const Paragraph = ({ children, ...props }) => (
        <p {...props} className="css-x243s">
          {children}
        </p>
      );

      testRender(html, { transform: { p: Paragraph } });
    });

    test('default mapping', () => {
      const html = '<article> <p>Default mapping</p> </article>';
      let i = 0;
      const defaultMap = (node, props, children) => {
        if (typeof props === 'undefined') {
          // we need to add key for elements inside array
          return <span key={i++}>{node}</span>;
        }

        return <div {...props}>{children}</div>;
      };

      testRender(html, { transform: { _: defaultMap } });
    });
  });

  describe('preserveAttributes', () => {
    test('allow preserve some attributes', () => {
      const html = `
        <div ng-if="x">
          <div tv-abc="d" tv-xxx="y"></div>
        </div>
      `;

      testRender(html, { preserveAttributes: ['ng-if', new RegExp('tv-')] });
    });
  });

  describe('dangerouslySetChildren', () => {
    test('should dangerously set html for required tags', () => {
      const html = `
        <pre>
          &lt;a href=&quot;/&quot;&gt;Test&lt;/a&gt;
        </pre>
      `;

      testRender(html, { dangerouslySetChildren: ['pre'] });
    });

    test('no dangerously render script tag', () => {
      const html = `
        <script data-cfasync="false" type="text/javascript">
          var gtm4wp_datalayer_name = "dataLayer";
          var dataLayer = dataLayer || [];
          dataLayer.push({"pagePostType":"post","pagePostType2":"single-post","pageCategory":["kalender-cuti"],"pagePostAuthor":"Candra Alif Irawan"});
        </script>
      `.trim();

      testRender(html);
    });

    test('dangerously render empty script tag', () => {
      const html = `<script type="text/javascript"></script>`.trim();

      testRender(html, { dangerouslySetChildren: ['script'] });
    });
  });
});

describe('whitespace', () => {
  test('allow whitespace only text nodes', () => {
    const html = '<span>Hello</span> <span>World</span>';
    testRender(html);
  });

  test('allow newline text node between tags', () => {
    const html = '<pre><span>Hello</span>\n<span>World</span></pre>';
    testRender(html);
  });

  test('remove whitespace on table elements', () => {
    const html = `
      <table>
        <tbody>
          <tr>
            <th> title</th>
          </tr>
          <tr>
            <td>entry </td>
          </tr>
        </tbody>
      </table>
    `.trim();

    testRender(html);
  });
});

expect.extend({
  toRenderConsistently({ server, browser }, html) {
    const serverRender = renderer.create(server);
    const browserRender = renderer.create(browser);

    const serverHtml = snapshot.utils.serialize(serverRender);
    const browserHtml = snapshot.utils.serialize(browserRender);

    const diffString = diff(serverHtml, browserHtml, {
      expand: this.expand,
      aAnnotation: 'Server render',
      bAnnotation: 'Browser render',
    });
    const pass = serverHtml === browserHtml;
    let messageExpectation;

    if (pass) {
      messageExpectation =
        'Expected server rendered HTML to not equal browser rendered HTML';
    } else {
      messageExpectation =
        'Expected server rendered HTML to equal browser rendered HTML';
    }

    const message = () =>
      messageExpectation +
      '\n\n' +
      'Server render:\n' +
      `  ${this.utils.printExpected(serverHtml)}\n` +
      'Browser render:\n' +
      `  ${this.utils.printReceived(browserHtml)}\n` +
      (diffString ? `\n\nDifference:\n\n${diffString}` : '');

    return { message, pass };
  },
});

/**
 * Test utilities
 */

function testRender(html, options) {
  const server = htmrServer(html, options);
  const browser = htmrBrowser(html, options);

  expect({ server, browser }).toRenderConsistently(html);

  // assert SSR
  expect(() => renderToString(server)).not.toThrow();
  expect(() => renderToStaticMarkup(server)).not.toThrow();

  // assert CSR
  const el = document.createElement('div');
  try {
    document.body.appendChild(el);
    expect(() => {
      ReactDOM.render(browser, el);
    }).not.toThrow();
  } finally {
    document.body.removeChild(el);
  }

  // assert snapshot, doesn't matter from server or browser
  // because we've already done assert equal between them
  expect(renderer.create(server)).toMatchSnapshot();
}
