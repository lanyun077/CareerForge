// Exercise the actual private fallback functions without network, model or database access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/services/roleService.ts', 'utf8');
const ast = ts.createSourceFile('roleService.ts', source, ts.ScriptTarget.Latest, true);
const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && ['parseList', 'fallbackJob'].includes(node.name?.text));
assert.equal(functions.length, 2);
const code = ts.transpileModule(functions.map((node) => node.getText(ast)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const fallbackJob = new Function(code + '\nreturn fallbackJob;')();
const fixtures = JSON.parse(fs.readFileSync('test-data/jobs/gitlab-public-samples.json', 'utf8')).samples;

const ai = fallbackJob(`${fixtures[0].title}\nWhat you'll bring\n${fixtures[0].excerpts.slice(0, 4).map((x) => x.quote).join('\n')}\nPreferred requirements\n${fixtures[0].excerpts[4].quote}`);
assert.equal(ai.title, 'AI Engineer');
assert(ai.requiredSkills.includes('Python / JavaScript / TypeScript（至少一种）'));
assert(!ai.requiredSkills.includes('Python'));
assert(!ai.requiredSkills.includes('Java'));
assert(!ai.requiredSkills.includes('CI/CD'));
assert(ai.preferredSkills.some((s) => s.includes('GitLab')));
assert(ai.preferredSkills.some((s) => s.includes('CI/CD')));
const fullStructure = fallbackJob(`AI Engineer\nGitLab builds a platform using JavaScript and Python.\nWhat you'll do\nDevelop GitLab integrations with TypeScript.\nWhat you'll bring\nStrong Python experience\nPreferred requirements\nExperience with GitLab platform and CI/CD workflows`);
assert.deepEqual(fullStructure.requiredSkills, ['Python']);
assert(fullStructure.preferredSkills.some((s) => s.includes('GitLab')));
assert(!fullStructure.requiredSkills.includes('GitLab'));
assert(!fullStructure.requiredSkills.includes('JavaScript'));
assert(!fullStructure.requiredSkills.includes('TypeScript'));
assert.deepEqual(fallbackJob('Backend Engineer\nPython and PostgreSQL').requiredSkills, ['Python', 'PostgreSQL']);

const ruby = fallbackJob(`${fixtures[1].title}\nWhat you'll bring\n${fixtures[1].excerpts.map((x) => x.quote).join('\n')}`);
assert.equal(ruby.title, fixtures[1].title);
assert(ruby.requiredSkills.includes('Ruby'));
assert(ruby.requiredSkills.includes('Rails'));
assert(!ruby.requiredSkills.some((s) => /Python|Vue/.test(s)));
assert(ruby.preferredSkills.some((s) => /Python.*Vue/.test(s)));
assert(ruby.requiredSkills.some((s) => s.includes('REST and/or GraphQL')));

const english = fallbackJob('Frontend Engineer\nResponsibilities\nBuild user interfaces\nRequirements\nJavaScript and React\nNice-to-have\nPython\nBonus\nTypeScript\nQualifications\nSQL');
assert.deepEqual(english.requiredSkills, ['JavaScript', 'React', 'SQL']);
assert.deepEqual(english.preferredSkills, ['Python', 'TypeScript']);
assert.deepEqual(english.responsibilities, ['Build user interfaces']);

const chinese = fallbackJob('后端开发工程师\n岗位职责\n设计接口与维护系统\n任职要求\n熟悉 Java 和 MySQL\n加分项\n了解 Python\n优先条件\nRedis\n技能要求\nLinux');
assert.deepEqual(chinese.requiredSkills, ['Java', 'MySQL', 'Linux']);
assert.deepEqual(chinese.preferredSkills, ['Python', 'Redis']);
assert.deepEqual(chinese.responsibilities, ['设计接口与维护系统']);
const alternatives = fallbackJob('后端工程师\n任职要求\nPython 或 Java 至少一种\nVue experience is a plus');
assert.deepEqual(alternatives.requiredSkills, ['Python / Java（至少一种）']);
assert.deepEqual(alternatives.preferredSkills, ['Vue']);
console.log('✓ 真实英文 JD 标题、任选技能、必备/加分区分、技术词边界及中英文分节');

const path = require('node:path');
const cache = new Map();
function load(file) {
  const resolved = path.resolve(file);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const mod = { exports: {} };
  cache.set(resolved, mod);
  const compiled = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (id) => {
    if (id === '@/lib/llm/client') return { chatJSON: async () => null };
    if (!id.startsWith('.') && !id.startsWith('@/')) return require(id);
    let target = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(resolved), id);
    target = fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts');
    return load(target);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, mod, mod.exports);
  return mod.exports;
}
async function checkPreview() {
  const { importJobPosting } = load('src/lib/services/roleService.ts');
  const text = `AI Engineer\nWhat you'll bring\nStrong proficiency in at least one modern scripting language (Python, JavaScript/TypeScript, or similar) and a solid understanding of REST APIs, GraphQL, and integration patterns.\nPreferred requirements\nExperience with GitLab platform and CI/CD workflows`;
  const job = await importJobPosting(text, { preview: true });
  const required = job.requirements.requiredSkills;
  const choice = required.find((skill) => skill.label === 'Python / JavaScript / TypeScript（至少一种）');
  assert(choice);
  assert.deepEqual(choice.keywords, ['Python', 'JavaScript', 'TypeScript']);
  const resume = 'I built Python services.';
  assert(choice.keywords.some((keyword) => resume.toLowerCase().includes(keyword.toLowerCase())), 'A Python resume must match the alternative language requirement');
  assert(required.some((skill) => skill.label === 'REST'));
  assert(required.some((skill) => skill.label === 'GraphQL'));
  assert(!required.some((skill) => skill.label === 'GitLab'));
  assert.deepEqual(job.requirements.preferredSkills.find((skill) => skill.label === 'CI/CD').keywords, ['CI/CD']);
  const cn = await importJobPosting('后端工程师\n任职要求\nPython 或 Java 至少一种', { preview: true });
  assert.deepEqual(cn.requirements.requiredSkills[0].keywords, ['Python', 'Java']);
  console.log('✓ 真实 JD 导入预览：任选语言可匹配简历，括号外 API 技能独立，CI/CD 不作任选');
}
checkPreview().catch((error) => { console.error(error); process.exitCode = 1; });
