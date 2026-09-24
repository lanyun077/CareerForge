const assert = require('node:assert/strict');
const { load } = require('./test-core.cjs');
const { issueCollectionReceipt, resolveJobProvenance, jobContentHash } = load('src/lib/jobProvenance.ts');
const text = '真实来源测试：Python后端工程师，负责接口设计与数据库查询优化。';
const provenance = { sourceUrl: 'https://job-boards.greenhouse.io/example/jobs/123', collectedAt: new Date().toISOString(), method: 'greenhouse_api', contentHash: jobContentHash(text), availability: 'unknown' };
const receipt = issueCollectionReceipt(text, provenance);
assert.deepEqual(resolveJobProvenance(text, undefined, receipt), provenance);
assert.throws(() => resolveJobProvenance(text + 'changed', undefined, receipt), /正文已修改/);
assert.throws(() => resolveJobProvenance(text, provenance), /有效采集凭据/);
assert.throws(() => resolveJobProvenance(text, undefined, 'forged.signature'), /凭据无效/);
assert.throws(() => resolveJobProvenance(text, { sourceUrl: 'javascript:alert(1)' }), /HTTP/);
assert.throws(() => resolveJobProvenance(text, { sourceUrl: 'https://user:secret@example.com' }), /HTTP/);
const manual = resolveJobProvenance(text, { sourceUrl: 'https://example.com/jobs/1', company: 'Example', collectedAt: 'fake', contentHash: 'fake' });
assert.equal(manual.method, 'manual');
assert.equal(manual.contentHash, jobContentHash(text));
assert.notEqual(manual.collectedAt, 'fake');
const now = Date.now;
try { Date.now = () => now() + 31 * 60_000; assert.throws(() => resolveJobProvenance(text, undefined, receipt), /已过期/); }
finally { Date.now = now; }
console.log('✓ 岗位来源签名、正文篡改、伪造来源、过期和安全链接校验通过');
