import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import ts from 'typescript';

// Resolve .js specifiers to their .ts counterparts when possible so refactors
// that switched files to TypeScript continue to work without changing imports.
export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (!specifier.endsWith('.js')) {
      throw error;
    }

    const tsSpecifier = specifier.replace(/\.js$/, '.ts');
    return defaultResolve(tsSpecifier, context, defaultResolve);
  }
}

export async function load(url, context, defaultLoad) {
  if (!url.endsWith('.ts')) {
    return defaultLoad(url, context, defaultLoad);
  }

  const source = await readFile(fileURLToPath(url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      esModuleInterop: true
    },
    fileName: fileURLToPath(url)
  });

  return {
    format: 'module',
    source: outputText,
    shortCircuit: true
  };
}