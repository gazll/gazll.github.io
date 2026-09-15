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
