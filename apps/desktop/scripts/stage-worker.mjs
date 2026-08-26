import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDirectory, '..');
const repositoryRoot = path.resolve(appRoot, '..', '..');
const stageRoot = path.join(appRoot, 'worker-stage');
const desktopRequire = createRequire(path.join(appRoot, 'package.json'));

const internalPackages = [
  { name: 'config', source: path.join(repositoryRoot, 'packages', 'config') },
  { name: 'core', source: path.join(repositoryRoot, 'packages', 'core') },
  { name: 'openai-realtime', source: path.join(repositoryRoot, 'packages', 'openai-realtime') },
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function collectExternalDependencies(manifests) {
  const dependencies = {};
  for (const manifest of manifests) {
    for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
      if (!name.startsWith('@roomate-voice/')) dependencies[name] = version;
    }
  }
  return dependencies;
}

function installProductionDependencies() {
  // prism-media declares an older optional opusscript peer range while the tested root workspace
  // intentionally uses opusscript 0.1.x. Staging should mirror that already-working graph rather
  // than silently downgrade the runtime codec dependency.
  const args = [
    'install',
    '--omit=dev',
    '--ignore-scripts',
    '--legacy-peer-deps',
    '--no-audit',
    '--no-fund',
  ];

  if (process.platform === 'win32') {
    execFileSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `npm ${args.join(' ')}`],
      {
        cwd: stageRoot,
        stdio: 'inherit',
      },
    );
    return;
  }

  execFileSync('npm', args, {
    cwd: stageRoot,
    stdio: 'inherit',
  });
}

async function stageFfmpeg() {
  const ffmpegBinary = desktopRequire('ffmpeg-static');
  if (typeof ffmpegBinary !== 'string' || !existsSync(ffmpegBinary)) {
    throw new Error('ffmpeg-static did not provide a platform binary for this build.');
  }

  const ffmpegPackageRoot = path.dirname(desktopRequire.resolve('ffmpeg-static'));
  const ffmpegDirectory = path.join(stageRoot, 'ffmpeg');
  const executableName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

  await mkdir(ffmpegDirectory, { recursive: true });
  await cp(ffmpegBinary, path.join(ffmpegDirectory, executableName));

  for (const fileName of ['LICENSE', 'README.md']) {
    const source = path.join(ffmpegPackageRoot, fileName);
    if (existsSync(source)) {
      await cp(source, path.join(ffmpegDirectory, `ffmpeg-static-${fileName}`));
    }
  }
}

await rm(stageRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });

const botRoot = path.join(repositoryRoot, 'apps', 'bot');
const botManifest = await readJson(path.join(botRoot, 'package.json'));
const internalManifests = await Promise.all(
  internalPackages.map(({ source }) => readJson(path.join(source, 'package.json'))),
);
const externalDependencies = collectExternalDependencies([botManifest, ...internalManifests]);

await cp(path.join(botRoot, 'dist'), stageRoot, { recursive: true });

await writeFile(
  path.join(stageRoot, 'package.json'),
  `${JSON.stringify(
    {
      name: '@roomate-voice/packaged-worker',
      version: botManifest.version,
      private: true,
      type: 'module',
      dependencies: externalDependencies,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

installProductionDependencies();

for (const { name, source } of internalPackages) {
  const destination = path.join(stageRoot, 'node_modules', '@roomate-voice', name);
  await mkdir(destination, { recursive: true });
  await cp(path.join(source, 'dist'), path.join(destination, 'dist'), { recursive: true });
  await cp(path.join(source, 'package.json'), path.join(destination, 'package.json'));
}

await stageFfmpeg();

console.log(`Packaged Voice Worker staged at ${stageRoot}`);
