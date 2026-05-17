// deps/DepTree.js — build a shallow dependency tree from node_modules
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Build a shallow dependency tree for a project.
 * @param {string} projectDir
 * @param {{ depth?: number }} opts
 * @returns {TreeNode}
 */
export function buildTree(projectDir, { depth = 2 } = {}) {
  const pkg = loadPkg(projectDir);
  if (!pkg) return { name: 'unknown', error: 'No package.json' };

  const direct = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  return {
    name:     pkg.name ?? 'root',
    version:  pkg.version ?? '0.0.0',
    children: Object.keys(direct).map((dep) => buildNode(projectDir, dep, depth - 1)),
  };
}

function buildNode(projectDir, name, remaining) {
  const pkgPath = join(projectDir, 'node_modules', name, 'package.json');
  if (!existsSync(pkgPath)) return { name, version: '(not installed)', children: [] };
  const pkg      = loadPkg(join(projectDir, 'node_modules', name));
  const version  = pkg?.version ?? '?';
  const children = remaining > 0 && pkg?.dependencies
    ? Object.keys(pkg.dependencies).slice(0, 10).map((dep) => buildNode(projectDir, dep, remaining - 1))
    : [];
  return { name, version, children };
}

function loadPkg(dir) {
  const p = join(dir, 'package.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * Render tree as indented text.
 * @param {TreeNode} node
 * @param {string} prefix
 * @returns {string}
 */
export function renderTree(node, prefix = '') {
  const lines = [`${prefix}${node.name}@${node.version ?? '?'}`];
  const children = node.children ?? [];
  children.forEach((child, i) => {
    const last    = i === children.length - 1;
    const branch  = last ? '└── ' : '├── ';
    const childPfx = last ? '    ' : '│   ';
    lines.push(prefix + branch + child.name + '@' + (child.version ?? '?'));
    (child.children ?? []).forEach((gc) => {
      lines.push(prefix + childPfx + '├── ' + gc.name + '@' + (gc.version ?? '?'));
    });
  });
  return lines.join('\n');
}
