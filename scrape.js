const { chromium } = require('playwright');
const fs = require('fs');

const URL =
  'https://script.google.com/macros/s/AKfycbyHZa8NgMdsxHIx1Eg5mguhTw00iP7bnbgSgOo5LRm357XuiqzMJXCNmVSUDFlohZAC/exec';

function findTimetableString(value) {
  if (typeof value === 'string') {
    if (
      value.includes('"Date"') &&
      value.includes('Course-Section-Session#-Faculty-Classroom')
    ) {
      return value;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTimetableString(item);
      if (found) return found;
    }
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = findTimetableString(item);
      if (found) return found;
    }
  }

  return null;
}

(async () => {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const page = await browser.newPage();

    console.log('Opening IIM timetable...');

    // Start listening BEFORE opening the page.
    const callbackPromise = page.waitForResponse(
      response =>
        response.url().includes('/callback') &&
        response.request().method() === 'POST',
      {
        timeout: 120000
      }
    );

    await page.goto(URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    console.log('Page opened. Waiting for getSheetData response...');

    const callbackResponse = await callbackPromise;

    console.log('Callback captured.');
    console.log('Status:', callbackResponse.status());

    let responseText = await callbackResponse.text();

    // Google RPC responses can contain an anti-XSSI prefix.
    responseText = responseText
      .replace(/^\)\]\}'\s*/, '')
      .trim();

    const rpcData = JSON.parse(responseText);

    const timetableString = findTimetableString(rpcData);

    if (!timetableString) {
      throw new Error(
        'Callback was captured but timetable data could not be found.'
      );
    }

    const rows = JSON.parse(timetableString);

    if (!Array.isArray(rows) || rows.length < 2) {
      throw new Error('Timetable data is empty or invalid.');
    }

    console.log(`SUCCESS: Extracted ${rows.length} timetable rows.`);
    console.log('Header:', rows[0]);
    console.log('First row:', rows[1]);

    const output = {
      updatedAt: new Date().toISOString(),
      source: URL,
      rowCount: rows.length,
      rows: rows
    };

    fs.writeFileSync(
      'timetable.json',
      JSON.stringify(output, null, 2)
    );

    console.log('SUCCESS: timetable.json created.');

  } catch (error) {
    console.error('SCRAPER ERROR:');
    console.error(error);

    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
