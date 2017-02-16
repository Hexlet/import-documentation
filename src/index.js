// @flow

import 'babel-polyfill';

import path from 'path';
import fs from 'fs';
import esprima from 'esprima';
import getInstalledPath from 'get-installed-path';
import documentation from 'documentation';

const getLocalName = specifier => {
  const map = {
    ImportDefaultSpecifier: (s) => s.local.name,
    ImportSpecifier: (s) => s.imported.name,
  };

  return map[specifier.type](specifier);
};

export const generate = files => {
  const contents = files.map(file => fs.readFileSync(file, 'utf8'));
  const programs = contents.map(content => esprima.parse(content, { sourceType: 'module' }));
  const imports = programs.reduce((acc, program) => {
    const programImports = program.body.filter(item => item.type === 'ImportDeclaration')
      .filter(item => item.source.value.startsWith('hexlet'));
    return [...acc, ...programImports];
  }, {});

  const packages = imports.reduce((acc, importDeclaration) => {
    const previousSpecifiers = acc[importDeclaration.source.value] || new Set();
    const filteredSpecifiers = importDeclaration.specifiers.filter(s => s.type !== 'ImportNamespaceSpecifier');
    const newSpecifiers = filteredSpecifiers.reduce((specifiers, specifier) =>
      specifiers.add(getLocalName(specifier)), previousSpecifiers);
    return { ...acc, [importDeclaration.source.value]: newSpecifiers };
  }, {});

  return Object.keys(packages).map(packageName => {
    const packagePath = getInstalledPath.sync(packageName);
    const allPackageDocs = documentation.buildSync([path.resolve(packagePath, 'src', 'index.js')]);
    const functions = [...packages[packageName]];
    const packageDocsAll = functions.map(func => {
      const docs = allPackageDocs.find(item => item.name === func);
      if (docs === undefined) {
        console.warn(`Documentation for function "${func}" not found!`);
      }
      return docs;
    });
    const packageDocs = packageDocsAll.filter(obj => obj !== undefined);
    return { packageName, packageDocs };
  });
};

export const write = (dir, docs) => {
  docs.forEach(({ packageName, packageDocs }) =>
    documentation.formats.md(packageDocs, {}, (err, res) => {
      if (err) {
        throw err;
      }
      fs.writeFileSync(path.resolve(dir, `${packageName}.md`), res);
    }));
};
