import fs from 'node:fs';
import path from 'node:path';
import * as sbx from './core.js';

export const isPackage = (file) => /\.(msix|msixbundle|appx|appxbundle)$/i.test(file);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Validate before booting: certificate trust and dependencies are explicit guest-only inputs. */
export function packageInputs({ app, cert, deps, console: consoleMode }) {
  if (!isPackage(app)) return null;
  if (consoleMode) throw new Error('Packaged apps use AUMID activation; --console is not supported.');
  if (cert && (!fs.existsSync(cert) || !fs.statSync(cert).isFile() || !/\.cer$/i.test(cert)))
    throw new Error(`Certificate must be an existing .cer file: ${cert}`);
  const depDir = deps ? path.resolve(deps) : path.join(path.dirname(path.resolve(app)), 'deps');
  if (deps && (!fs.existsSync(depDir) || !fs.statSync(depDir).isDirectory()))
    throw new Error(`Dependency folder not found: ${depDir}`);
  const dependencies = fs.existsSync(depDir) && fs.statSync(depDir).isDirectory()
    ? fs.readdirSync(depDir).filter(isPackage).sort().map((f) => path.join(depDir, f)) : [];
  return { cert, dependencies };
}

export async function installPackage(file, inputs, appId) {
  const guestDir = 'C:\\sbx-package';
  const pkg = await sbx.copyIn(file, `${guestDir}\\${path.basename(file)}`);
  let certPath;
  if (inputs.cert) certPath = (await sbx.copyIn(inputs.cert, `${guestDir}\\certificate.cer`)).path;
  const dependencies = [];
  for (const dep of inputs.dependencies)
    dependencies.push((await sbx.copyIn(dep, `${guestDir}\\deps\\${path.basename(dep)}`)).path);
  const command = `. '${sbx.GUEST.agent}\\package.ps1'; Install-SbxPackage -PackagePath ${q(pkg.path)}` +
    (certPath ? ` -CertificatePath ${q(certPath)}` : '') +
    (dependencies.length ? ` -DependencyPath @(${dependencies.map(q).join(',')})` : '') +
    (appId ? ` -ApplicationId ${q(appId)}` : '') + ' | ConvertTo-Json -Depth 8 -Compress';
  const result = await sbx.exec({ command, timeoutSec: 300 });
  if (result.timedOut || result.exitCode !== 0)
    throw new Error(`Package installation failed${result.timedOut ? ' (timed out)' : ''}: ${result.stderr || result.stdout}`);
  try { return JSON.parse(result.stdout.trim()); }
  catch { throw new Error(`Package installation returned invalid metadata: ${result.stdout}`); }
}

export function activationTarget({ path: executable, aumid }) {
  const shellTarget = /^shell:AppsFolder\\/i.test(executable || '');
  const target = aumid ?? (shellTarget ? executable.slice(17) : /^[^\\/:]+![^\\/:]+$/.test(executable || '') ? executable : null);
  if (aumid === '') throw new Error('AUMID must be PackageFamilyName!ApplicationId.');
  if (target) {
    if (!/^[^\\/:!\s]+![^\\/:!\s]+$/.test(target)) throw new Error('AUMID must be PackageFamilyName!ApplicationId.');
    return { aumid: target };
  }
  if (!executable) throw new Error('Specify an executable path or an AUMID.');
  return { path: executable };
}
