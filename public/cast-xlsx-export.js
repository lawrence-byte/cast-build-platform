// Minimal browser XLSX writer for user-facing spreadsheet exports.
// Produces a real .xlsx ZIP package with one worksheet; no external runtime dependency.
(function () {
  'use strict';

  const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const encoder = new TextEncoder();
  let crcTable;

  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function xml(s) {
    return String(s ?? '').replace(/[<>&"']/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[m]));
  }

  function colName(n) {
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function cellXml(value, ref) {
    if (value === null || value === undefined || value === '') return `<c r="${ref}"/>`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
    if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
  }

  function normalizeColumns(columns, rows) {
    if (columns && columns.length && typeof columns[0] === 'object') return columns;
    if (columns && columns.length) return columns.map((key) => ({ key, header: key }));
    const first = rows && rows[0];
    if (Array.isArray(first)) return first.map((_, i) => ({ key: i, header: `Column ${i + 1}` }));
    return Object.keys(first || {}).map((key) => ({ key, header: key }));
  }

  function worksheetXml(sheetName, columns, rows) {
    const cols = normalizeColumns(columns, rows);
    const header = cols.map((c, i) => cellXml(c.header || c.key || '', `${colName(i + 1)}1`)).join('');
    const body = rows.map((row, r) => {
      const rowNum = r + 2;
      const cells = cols.map((c, i) => {
        const value = typeof c.value === 'function' ? c.value(row) : Array.isArray(row) ? row[c.key] : row[c.key];
        return cellXml(value, `${colName(i + 1)}${rowNum}`);
      }).join('');
      return `<row r="${rowNum}">${cells}</row>`;
    }).join('');
    const widths = cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(12, Math.min(42, Number(c.width || 18)))}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <cols>${widths}</cols>
  <sheetData><row r="1">${header}</row>${body}</sheetData>
  <autoFilter ref="A1:${colName(Math.max(cols.length, 1))}${Math.max(rows.length + 1, 1)}"/>
</worksheet>`;
  }

  function dosDateTime(date) {
    const d = date || new Date();
    return {
      time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31),
      date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
    };
  }

  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }

  function zip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const dt = dosDateTime(new Date());
    files.forEach((file) => {
      const name = encoder.encode(file.name);
      const data = encoder.encode(file.content);
      const crc = crc32(data);
      const local = new Uint8Array([
        ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(dt.time), ...u16(dt.date),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
      ]);
      chunks.push(local, name, data);
      central.push(new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(dt.time), ...u16(dt.date),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ]), name);
      offset += local.length + name.length + data.length;
    });
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
      ...u32(centralSize), ...u32(offset), ...u16(0),
    ]);
    return new Blob([...chunks, ...central, end], { type: MIME });
  }

  function workbookFiles(sheetName, sheetXml) {
    const safeName = xml(String(sheetName || 'Export').slice(0, 31) || 'Export');
    return [
      { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>` },
      { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
    ];
  }

  function downloadXlsx(filename, sheetName, columns, rows) {
    const finalName = String(filename || 'export.xlsx').replace(/\.csv$/i, '.xlsx').replace(/\.xls$/i, '.xlsx');
    const dataRows = Array.isArray(rows) ? rows : [];
    const blob = zip(workbookFiles(sheetName, worksheetXml(sheetName, columns, dataRows)));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = finalName.endsWith('.xlsx') ? finalName : `${finalName}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  window.CastXlsxExport = { downloadXlsx, worksheetXml };
})();
