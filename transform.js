const FAST_MODULE = `fastModule`;
const FAST_MODULE_W = `fastModuleWrapper`;

module.exports = function (fileInfo, api, options) {
  const j = api.jscodeshift;
  const source = fileInfo.source;
  const root = j(source);

  changeModuleMapDeclarationsAndRequireToFastRequireFunction(j, root);

  const modules = findAndDeleteAllModulesDeclarations(j, root);

  const moduleIds = modules.map((m) => m.id.value);

  const program = root.get().node.program;
  program.body.push(...createFastModules(j, modules));
  program.body.push(...createFastModuleWrappers(moduleIds));
  program.body.push(createFastRequireFunction(moduleIds));

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

const createFastModuleWrappers = (ids) => {
  return ids.map((id) => `const ${FAST_MODULE_W}${id} = { exports: void 0, factory: ${FAST_MODULE}${id}, hasError: !1, isInitialized: !1 };`);
}

const createFastRequireFunction = (ids) => {
  const cases = ids.map((id) => `case ${id}: return ${FAST_MODULE_W}${id};`);
  return `
function fastRequire(n) {
  switch (n) {
    ${cases.join('\n')}
    default: return undefined;
  }
}`;
}

function changeModuleMapDeclarationsAndRequireToFastRequireFunction(j, root) {
  const mainRequireBlock = findMainRequireBlock(j, root);
  delete__dDeclaration(j, root, mainRequireBlock);
  deleteModuleMapDeclaration(j, root, mainRequireBlock);
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
  dDeclaration.replaceWith();
}

function deleteModuleMapDeclaration(j, root, mainRequireBlock) {
  const moduleMapDeclaration = root.find(j.VariableDeclaration, { declarations: [{ id: { name: 'e' } }] })
    .filter((p) => hasParent(p, mainRequireBlock));
  if (moduleMapDeclaration.size() != 1) throw new Error(`Expected a single declaration of e (module map), but was ${moduleMapDeclaration.size()}`);
  moduleMapDeclaration.replaceWith();
}

function hasParent(p, parent) {
  while (p.parent) {
    if (p.value == parent.value) return true;
    p = p.parent;
  }
  return false;
}
