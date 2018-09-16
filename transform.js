const FAST_MODULE = `fastModule`;
const FAST_MODULE_W = `fastModuleWrapper`;

module.exports = function (fileInfo, api, options) {
  const j = api.jscodeshift;
  const source = fileInfo.source;
  const root = j(source);

  changeMainRequireBlock(j, root);

  const modules = findAndDeleteAllModulesDeclarations(j, root);

  insertAllFastRequires(j, root, modules);

  return root.toSource();
};

function findAndDeleteAllModulesDeclarations(j, root) {
  const modules = [];
  root
    .find(j.ExpressionStatement, { expression: { callee: { name: '__d' } } })
    .forEach((p) => {
      const moduleFactory = p.value.expression.arguments[0];
      const id = p.value.expression.arguments[1];

      if (p.value.expression.arguments[2]) throw new Error(`TODO deal with dependencyMap later if exists`);
      if (id.type != j.Literal || moduleFactory.type != j.FunctionExpression) throw new Error(`huh? ${p}`);

      modules.push({ id, moduleFactory, p });
    })
    .replaceWith();

  return modules;
}

const createFastModules = (j, modules) => {
  return modules.map((m) => `const ${FAST_MODULE}${m.id.value} = ${j(m.moduleFactory).toSource()};`);
}

const createFastModuleWrappers = (modules) => {
  return modules.map((m) => `const ${FAST_MODULE_W}${m.id.value} = { exports: void 0, factory: ${FAST_MODULE}${m.id.value}, hasError: !1, isInitialized: !1 };`);
}

const createFastRequireFunction = (modules) => {
  const cases = modules.map((m) => `case ${m.id.value}: return ${FAST_MODULE_W}${m.id.value};`);
  return `
function fastRequire(n) {
  switch (n) {
    ${cases.join('\n')}
    default: return undefined;
  }
}`;
}

function changeMainRequireBlock(j, root) {
  const mainRequireBlock = findMainRequireBlock(j, root);
  delete__dDeclaration(j, root, mainRequireBlock);
  deleteModuleMapDeclaration(j, root, mainRequireBlock);
  changeMapToFastRequireFn(j, root, mainRequireBlock);
}

function findMainRequireBlock(j, root) {
  const requireDeclarations = root.find(j.AssignmentExpression, { operator: '=', left: { object: { name: 'r' }, property: { name: 'require' } } });
  if (requireDeclarations.size() != 1) throw new Error(`Expected a single assignment expression of r.require`);
  const requireDeclaration = requireDeclarations.get();
  if (requireDeclaration.value.end > 1000) throw new Error(`Expected r.require declaration at the top of the bundle but was ${requireDeclaration.value.end}`);
  let mainRequireBlock = requireDeclaration.parent;
  while (mainRequireBlock.value.type != j.BlockStatement) {
    mainRequireBlock = mainRequireBlock.parent;
  }
  return mainRequireBlock;
}

function delete__dDeclaration(j, root, mainRequireBlock) {
  const dDeclaration = root.find(j.AssignmentExpression, { operator: '=', left: { object: { name: 'r' }, property: { name: '__d' } } })
    .filter((p) => hasParent(p, mainRequireBlock));
  if (dDeclaration.size() != 1) throw new Error(`Expected a single declaration of __d (module map registration) but was ${dDeclaration.size()}`);
  dDeclaration.get().value.right = 'undefined';
}

function deleteModuleMapDeclaration(j, root, mainRequireBlock) {
  const moduleMapDeclaration = root.find(j.VariableDeclaration, { declarations: [{ id: { name: 'e' } }] })
    .filter((p) => hasParent(p, mainRequireBlock));
  if (moduleMapDeclaration.size() != 1) throw new Error(`Expected a single declaration of e (module map), but was ${moduleMapDeclaration.size()}`);
  moduleMapDeclaration.replaceWith();
}

function changeMapToFastRequireFn(j, root, mainRequireBlock) {
  const mapUsage1 = root.find(j.VariableDeclarator, { id: { name: 'o' }, init: { object: { name: 'e' }, property: { name: 'n' } } })
    .filter((p) => hasParent(p, mainRequireBlock));
  if (mapUsage1.size() != 1) throw new Error(`Expected a single usage of "o = e[n]", but was ${mapUsage1.size()}`);
  mapUsage1.get().value.init = `fastRequire(n)`;

  const mapUsage2 = root.find(j.AssignmentExpression, { operator: '=', left: { name: 'a' }, right: { object: { name: 'e' }, property: { name: 'i' } } })
    .filter((p) => hasParent(p, mainRequireBlock));
  if (mapUsage2.size() != 1) throw new Error(`Expected a single usage of "a = e[i]", but was ${mapUsage2.size()}`);
  mapUsage2.get().value.right = `fastRequire(i)`;
}

function insertAllFastRequires(j, root, modules) {
  // const require56Statements = root.find(j.ExpressionStatement, { expression: { callee: { name: 'require' }, arguments: [{ value: 56 }] } });
  // if (require56Statements.size() != 1) throw new Error(`Expected a single usage of "require(56)", but was ${require56Statements.size()}`);
  // if (require56Statements.get().parentPath.parentPath.name != 'program') throw new Error(`Expected "require(56)" in the global scope`);

  const program = root.get().value.program;

  // const require56Start = program.body.findIndex((node) => node && node.start == require56Statements.get().value.start);
  // if (require56Start < 0) throw new Error(`Expected "require(56)" in the global scope`);

  const toAdd = createFastModules(j, modules)
    .concat(createFastModuleWrappers(modules))
    .concat(createFastRequireFunction(modules));
  // program.body.splice(require56Start, 0, ...toAdd);
  program.body.unshift(...toAdd);
}

function hasParent(p, parent) {
  while (p.parent) {
    if (p.value == parent.value) return true;
    p = p.parent;
  }
  return false;
}
