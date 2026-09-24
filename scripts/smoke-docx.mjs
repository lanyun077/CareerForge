import assert from 'node:assert/strict';
import JSZip from 'jszip';
const base = process.argv[2] || 'http://127.0.0.1:3210';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const zip = new JSZip();
zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>虚构测试简历：Python 与 React 项目经验</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格项目：订单系统</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>');
async function upload(data, name = 'test.docx') {
  const form = new FormData();
  form.append('file', new Blob([data]), name);
  const response = await fetch(`${base}/api/resume/parse-docx`, { method: 'POST', body: form });
  return { status: response.status, body: await response.json() };
}
const result = await upload(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
assert(result.body.ok, JSON.stringify(result));
assert(result.body.data.text.includes('Python 与 React') && result.body.data.text.includes('表格项目：订单系统'));
assert.equal((await upload('broken')).status, 422);
assert.equal((await upload('old word', 'old.doc')).status, 415);
assert.equal((await upload(new Uint8Array(5 * 1024 * 1024 + 1))).status, 413);
console.log('✓ DOCX 中文正文、表格提取与损坏/旧 DOC/超大文件检查通过');
