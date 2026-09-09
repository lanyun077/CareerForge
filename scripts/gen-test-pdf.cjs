// 生成带 FlateDecode 压缩内容流的测试 PDF（模拟 Word/WPS 导出的真实结构），验证 pdfjs-dist 解析
const zlib = require('zlib');
const fs = require('fs');

const objs = [];
objs[1] = '<</Type/Catalog/Pages 2 0 R>>';
objs[2] = '<</Type/Pages/Kids[3 0 R]/Count 1>>';
objs[3] = '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>';
const lines = [
  'Li Ming - Resume',
  'Computer Science, undergraduate',
  'Objective: Python Backend Developer Intern',
  'Skills: Python Flask MySQL Git RESTful API design',
  'Project: Order Management System, order and inventory modules',
  'Designed 12 tables, implemented 23 interfaces',
  'Slow query optimization: response time 800ms to 120ms',
  'pytest coverage 85 percent',
];
let content = 'BT /F1 12 Tf 60 750 Td 14 TL\n';
for (const l of lines) {
  const safe = l.replace(/[()\\]/g, ' ');
  content += `(${safe}) Tj T*\n`;
}
content += 'ET';
const compressed = zlib.deflateSync(Buffer.from(content, 'latin1'));
objs[4] = { dict: `<</Length ${compressed.length}/Filter/FlateDecode>>`, stream: compressed };
objs[5] = '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>';

let pdf = Buffer.from('%PDF-1.5\n%', 'latin1');
const offs = [];
for (let i = 1; i <= 5; i++) {
  offs[i] = pdf.length;
  if (i === 4) {
    pdf = Buffer.concat([
      pdf,
      Buffer.from(`4 0 obj${objs[4].dict}stream\n`, 'latin1'),
      objs[4].stream,
      Buffer.from('\nendstream\nendobj\n', 'latin1'),
    ]);
  } else {
    pdf = Buffer.concat([pdf, Buffer.from(`${i} 0 obj${objs[i]}endobj\n`, 'latin1')]);
  }
}
const xrefPos = pdf.length;
let xrefStr = 'xref\n0 6\n0000000000 65535 f \n';
for (let i = 1; i <= 5; i++) xrefStr += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
xrefStr += `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;
pdf = Buffer.concat([pdf, Buffer.from(xrefStr, 'latin1')]);

fs.writeFileSync('test-data/sample-compressed.pdf', pdf);
console.log('PDF written:', pdf.length, 'bytes');
