const { chromium } = require('playwright');
const fs = require('fs');

const URL =
  'https://script.google.com/macros/s/AKfycbyHZa8NgMdsxHIx1Eg5mguhTw00iP7bnbgSgOo5LRm357XuiqzMJXCNmVSUDFlohZAC/exec';

(async () => {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const page = await browser.newPage();

    console.log('Opening IIM timetable...');

    await page.goto(URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    console.log('Outer page loaded.');

    // Wait for Google Apps Script iframe
    await page.waitForSelector('#sandboxFrame', {
      timeout: 120000
    });

    console.log('Sandbox iframe found.');

    const frameElement = await page.$('#sandboxFrame');
    const frame = await frameElement.contentFrame();

    if (!frame) {
      throw new Error('Could not access timetable iframe.');
    }

    console.log('Iframe opened.');

    // Wait for getSheetData() to populate the timetable
    await frame.waitForSelector('#table table', {
      timeout: 120000
    });

    console.log('Timetable table found.');

    const rows = await frame.$$eval('#table table tr', rows =>
      rows.map(row =>
        Array.from(row.querySelectorAll('th, td')).map(cell =>
          cell.innerText.trim()
        )
      )
    );

    console.log(`Extracted ${rows.length} rows.`);

    if (rows.length < 2) {
      throw new Error('Timetable was found but contains no data.');
    }

    console.log('Header:', rows[0]);
    console.log('First data row:', rows[1]);

    const output = {
      updatedAt: new Date().toISOString(),
      source: URL,
      rowCount: rows.length,
      rows
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
