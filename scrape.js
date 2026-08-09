const { chromium } = require('playwright');
const fs = require('fs');

const URL =
  'https://script.google.com/macros/s/AKfycbyHZa8NgMdsxHIx1Eg5mguhTw00iP7bnbgSgOo5LRm357XuiqzMJXCNmVSUDFlohZAC/exec';

(async () => {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage();

  console.log('Opening IIM timetable...');

  await page.goto(URL, {
    waitUntil: 'networkidle',
    timeout: 120000
  });

  // Wait until the timetable actually appears.
  await page.waitForSelector('#table table', {
    timeout: 120000
  });

  console.log('Timetable loaded.');

  const rows = await page.$$eval('#table table tr', rows =>
    rows.map(row =>
      Array.from(row.querySelectorAll('th, td')).map(cell =>
        cell.innerText.trim()
      )
    )
  );

  console.log(`Extracted ${rows.length} rows.`);

  const output = {
    updatedAt: new Date().toISOString(),
    source: URL,
    rows: rows
  };

  fs.writeFileSync(
    'timetable.json',
    JSON.stringify(output, null, 2)
  );

  console.log('Saved timetable.json');

  await browser.close();
})();
