import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

for (const language of ['fr', 'en']) {
  const suffix = language === 'en' ? '.en' : '';
  const guided = 'formation-guidee' + suffix + '.html';
  const alternate = 'formation-guidee' + (language === 'en' ? '' : '.en') + '.html';

  test(`${language}: public training entries lead to the current guided course`, () => {
    const search = read('app' + suffix + '.js');
    const lastKnowledgePage = read('partie-5' + suffix + '.html');
    assert.ok(search.includes(`go:'${guided}'`));
    assert.ok(!search.includes(`go:'formation${suffix}.html'`));
    assert.ok(lastKnowledgePage.includes(`class="btn" href="${guided}"`));
    assert.ok(!lastKnowledgePage.includes(`class="btn" href="formation${suffix}.html"`));
  });

  test(`${language}: guided header keeps language, session mount and current navigation accessible`, () => {
    const html = read(guided);
    const header = html.match(/<header class="fg-header">([\s\S]*?)<\/header>/)?.[1];
    assert.ok(header);
    assert.match(header, /<nav class="fg-header-nav" aria-label="[^"]+">/);
    assert.ok(header.includes(`href="${guided}" aria-current="page"`));
    assert.ok(header.includes(`href="${alternate}" lang="`));
    assert.match(header, /class="fg-header-languages" role="group" aria-label=/);
    assert.ok(html.includes('href="formation-parcours.css"'));
    assert.ok(html.indexOf('src="formation-attestation.js"') < html.indexOf(`src="formation-guidee${suffix}.js"`));
  });

  for (const number of [1, 2, 3, 4, 5]) {
    const oldPage = 'formation' + (number === 1 ? '' : '-' + number) + suffix + '.html';
    test(`${oldPage}: old course stays available with a non-destructive transition notice`, () => {
      const html = read(oldPage);
      const notice = html.match(/<aside class="legacy-training-notice"[\s\S]*?<\/aside>/)?.[0];
      assert.ok(notice);
      assert.ok(notice.includes(`href="${guided}"`));
      assert.ok(notice.includes(language === 'en' ? 'validations are not transferred' : 'validations ne sont pas transférées'));
      assert.ok(html.includes('src="formation.js"'));
      assert.ok(html.includes('href="formation-parcours.css"'));
      assert.ok(!notice.includes('localStorage'));
    });
  }
}

// Le lien vers le portail des applications MRI : sur chaque page à coquille, dans le
// sommaire et dans le pied de page ; sur la formation guidée, dans l'en-tête et le pied.
const PORTAIL = 'https://frankyray21.github.io/Portail-Applications/';
for (const language of ['fr', 'en']) {
  const suffix = language === 'en' ? '.en' : '';
  for (const page of ['index', 'partie-2', 'partie-3', 'partie-4', 'partie-5', 'formation', 'formation-2', 'formation-3', 'formation-4', 'formation-5']) {
    test(`${page}${suffix}.html: the MRI portal is reachable from the sidebar and the footer`, () => {
      const html = read(page + suffix + '.html');
      const sidebar = html.match(/<aside class="toc">([\s\S]*?)<\/aside>/)?.[1];
      const footer = html.match(/<footer class="foot">([\s\S]*?)<\/footer>/)?.[1];
      assert.ok(sidebar && footer);
      assert.ok(sidebar.includes(`class="toc-portail" href="${PORTAIL}"`));
      assert.ok(footer.includes(`href="${PORTAIL}"`));
      assert.ok(html.includes(language === 'en' ? 'all MRI apps, in French' : 'toutes les applications'));
    });
  }

  test(`${language}: the guided course keeps the MRI portal in its header and its footer`, () => {
    const html = read('formation-guidee' + suffix + '.html');
    const header = html.match(/<header class="fg-header">([\s\S]*?)<\/header>/)?.[1];
    const footer = html.match(/<footer class="fg-foot">([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(header && footer);
    assert.ok(header.includes(`class="fg-portail" href="${PORTAIL}"`));
    assert.ok(footer.includes(`href="${PORTAIL}"`));
  });
}
