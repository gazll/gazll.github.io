import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanMovieTitle, extractDownloadUrls, extractFshareLinksFromHtml, extractPageTitle,
  parseLocs, robotsAllows, selectPostSitemaps, selectPostUrls, sitemapUrlsFromRobots
} from '../tools/crawl-thuviencine.mjs';

const SITE = 'https://thuviencine.uk/';

test('sitemap helpers select every post sitemap and skip the homepage', () => {
  const index = '<?xml version="1.0"?><sitemapindex>\n'
    + '<sitemap><loc>http://thuviencine.uk/post-sitemap.xml</loc></sitemap>\n'
    + '<sitemap><loc>https://thuviencine.uk/post-sitemap7.xml</loc></sitemap>\n'
    + '<sitemap><loc>https://thuviencine.uk/page-sitemap.xml</loc></sitemap>\n'
    + '</sitemapindex>';
  const posts = '<urlset>\n'
    + '<url><loc>https://thuviencine.uk/</loc></url>\n'
    + '<url><loc>https://thuviencine.uk/phim-keo-ngot/?a=1&amp;b=2</loc></url>\n'
    + '</urlset>';
  assert.deepEqual(selectPostSitemaps(index, SITE), [
    'https://thuviencine.uk/post-sitemap.xml', 'https://thuviencine.uk/post-sitemap7.xml'
  ]);
  assert.deepEqual(selectPostUrls(posts, SITE), ['https://thuviencine.uk/phim-keo-ngot/?a=1&b=2']);
  assert.deepEqual(parseLocs('<x><loc>/relative</loc></x>', SITE), ['https://thuviencine.uk/relative']);
});

test('movie pages yield only same-site download ids, not related movie links', () => {
  const html = '<a href="https://thuviencine.uk/download?id=9953&amp;from=post">Download</a>\n'
    + '<a href="/download/?id=9953&amp;from=post">duplicate</a>\n'
    + '<a href="/phim-other-fshare/">related movie</a>\n'
    + '<a href="https://other.example/download?id=1">foreign</a>';
  assert.deepEqual(extractDownloadUrls(html, SITE + 'phim-keo-ngot/', SITE), [
    'https://thuviencine.uk/download?id=9953&from=post'
  ]);
});

test('title extraction removes the site wrapper but keeps the movie name', () => {
  const html = '<meta content="Tải phim Kẹo Ngọt Tình Yêu: Phần 1 - Our Sticky Love: Season 1 (2026) link Fshare - CineTV" property="og:title">\n'
    + '<title>fallback</title>';
  assert.equal(extractPageTitle(html), 'Kẹo Ngọt Tình Yêu: Phần 1 - Our Sticky Love: Season 1 (2026)');
  assert.equal(cleanMovieTitle('Download - A Film (2024) - CineTV'), 'A Film (2024)');
});

test('download pages return canonical unique Fshare links from href and data attributes', () => {
  const html = '<a href="https://www.fshare.vn/folder/abcd1234">Folder</a>\n'
    + '<a data-url="https://fshare.vn/file/efgh5678">File</a>\n'
    + '<script>const duplicate = "https://www.fshare.vn/folder/ABCD1234";</script>';
  assert.deepEqual(extractFshareLinksFromHtml(html), [
    'https://www.fshare.vn/folder/ABCD1234', 'https://www.fshare.vn/file/EFGH5678'
  ]);
});

test('robots rules allow the wildcard root and obey the longest matching rule', () => {
  const robots = 'User-agent: *\nAllow: /\nDisallow: /private\nAllow: /private/public\n\nUser-agent: BadBot\nDisallow: /';
  assert.equal(robotsAllows(robots, SITE + 'phim-a/'), true);
  assert.equal(robotsAllows(robots, SITE + 'private/a/'), false);
  assert.equal(robotsAllows(robots, SITE + 'private/public/a/'), true);
  assert.deepEqual(sitemapUrlsFromRobots('Sitemap: /sitemap.xml', SITE), ['https://thuviencine.uk/sitemap.xml']);
});

// The Telegram harvester shares this file: both are raw sources for the movie
// catalog and both are only helpers around extractFshareLinks.
test('telegram: links hidden in entities, buttons and previews are found, and a caption is borrowed', async () => {
  const { recordsFromMessage, resolveTitles, rawLine, chatReference } = await import('../tools/crawl-telegram.mjs');
  const post = {
    id: 5,
    message: '🎬 #phimmoi Dune: Part Two (2024) 4K — fshare.vn/file/TEXT0001',
    entities: [{ className: 'MessageEntityTextUrl', url: 'https://fshare.vn/folder/ENTITY01' }],
    replyMarkup: { rows: [{ buttons: [{ url: 'https://www.fshare.vn/file/BUTTON01' }] }] },
    media: { webpage: { url: 'https://www.fshare.vn/file/PREVIEW1' } }
  };
  assert.deepEqual(recordsFromMessage(post).map(rawLine), [
    'Dune: Part Two (2024) 4K https://www.fshare.vn/file/TEXT0001',
    'Dune: Part Two (2024) 4K https://www.fshare.vn/folder/ENTITY01',
    'Dune: Part Two (2024) 4K https://www.fshare.vn/file/BUTTON01',
    'Dune: Part Two (2024) 4K https://www.fshare.vn/file/PREVIEW1'
  ]);
  // An album file with no caption and a bare-link reply both borrow the post's title.
  const album = recordsFromMessage({ id: 6, message: 'https://www.fshare.vn/file/ALBUM001', groupedId: 77n });
  const reply = recordsFromMessage({ id: 7, message: 'fshare.vn/file/REPLY001', replyTo: { replyToMsgId: 5 } });
  const titles = { groups: new Map([['77', 'Album caption']]), messages: new Map([[5, 'Dune: Part Two (2024) 4K']]) };
  assert.deepEqual(resolveTitles([...album, ...reply], titles).map(rawLine), [
    'Album caption https://www.fshare.vn/file/ALBUM001',
    'Dune: Part Two (2024) 4K https://www.fshare.vn/file/REPLY001'
  ]);
  assert.deepEqual(['@foo', 'https://t.me/c/1234/56', 't.me/bar', -1001234567890].map(chatReference), ['@foo', '-1001234', 'bar', '-1001234567890']);
});
