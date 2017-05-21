// @flow

import 'babel-polyfill';

import path from 'path';
import fs from 'fs';
import esprima from 'esprima';
import getInstalledPath from 'get-installed-path';
import documentation from 'documentation';
import { flatten } from 'lodash';

const getLocalName = (specifier) => {
  const map = {
    ImportDefaultSpecifier: s => s.local.name,
    ImportSpecifier: s => s.imported.name,
  };

  return map[specifier.type](specifier);
};

export const generate = (files) => {
  const contents = files.map(file => fs.readFileSync(file, 'utf8'));
  const programs = contents.map(content => esprima.parse(content, { sourceType: 'module' }));
  const imports = programs.reduce((acc, program) => {
    const programImports = program.body
      .filter(item => item.type === 'ImportDeclaration')
      .filter(item => item.source.value.startsWith('hexlet'));
    return [...acc, ...programImports];
  }, []);

  const packages = imports.reduce((acc, importDeclaration) => {
    const previousSpecifiers = acc[importDeclaration.source.value] || new Set();
    const filteredSpecifiers = importDeclaration.specifiers.filter(s => s.type !== 'ImportNamespaceSpecifier');
    const newSpecifiers = filteredSpecifiers.reduce((specifiers, specifier) =>
      specifiers.add(getLocalName(specifier)), previousSpecifiers);
    return { ...acc, [importDeclaration.source.value]: newSpecifiers };
  }, {});

  const promises = Object.keys(packages).map(async (packageName) => {
    const packagePath = getInstalledPath.sync(packageName);
    const allPackageDocs = await documentation.build([path.resolve(packagePath, 'src', 'index.js')], {});
    const functions = [...packages[packageName]];
    const packageDocsAll = functions.map((func) => {
      const docs = allPackageDocs.find(item => item.name === func);
      if (docs === undefined) {
        console.warn(`Documentation for function "${func}" not found!`);
      }
      return docs;
    });
    const packageDocs = packageDocsAll.filter(obj => obj !== undefined);
    return { packageName, packageDocs };
  });

  return Promise.all(promises);
};

export const write = (dir, docs) => {
  const promises = docs.map(async ({ packageName, packageDocs }) => {
    const md = await documentation.formats.md(packageDocs, {});
    const file = path.resolve(dir, `${packageName}.md`);
    fs.writeFileSync(file, md);
  });
  return Promise.all(promises);
};

const getJsFiles = dir => fs.readdirSync(dir)
  .filter(file => file.endsWith('js'))
  .map(file => path.resolve(dir, file));

export default async (outDir: string, items: Array<string>) => {
  const files = flatten(items.map((item) => {
    const fullPath = path.resolve(process.cwd(), item);
    const isDir = fs.lstatSync(fullPath).isDirectory();
    return isDir ? getJsFiles(item) : item;
  }));
  const pathnames = files.map(file => path.resolve(process.cwd(), file));
  const packagesDocs = await generate(pathnames);
  await write(outDir, packagesDocs);
};
