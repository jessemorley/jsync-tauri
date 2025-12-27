import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const repo = 'jessemorley/jsync-tauri';

const bundleDir = 'src-tauri/target/release/bundle/macos';

if (!fs.existsSync(bundleDir)) {
  console.error('Bundle directory not found:', bundleDir);
  process.exit(1);
}

const files = fs.readdirSync(bundleDir);
const platforms = {};

// We look for .app.tar.gz and their corresponding .sig files
files.forEach(file => {
  if (file.endsWith('.app.tar.gz')) {
    const sigFile = `${file}.sig`;
    if (files.includes(sigFile)) {
      const signature = fs.readFileSync(path.join(bundleDir, sigFile), 'utf8').trim();
      
      // Determine architecture from filename or build context
      // Tauri usually names them like "app_0.1.0_aarch64.app.tar.gz"
      let arch = 'aarch64'; 
      if (file.includes('x64') || file.includes('x86_64')) arch = 'x86_64';
      if (file.includes('arm64') || file.includes('aarch64')) arch = 'aarch64';

      platforms[`darwin-${arch}`] = {
        signature: signature,
        url: `https://github.com/${repo}/releases/download/v${version}/${file}`
      };
    }
  }
});

if (Object.keys(platforms).length === 0) {
  console.error('No signed bundles found in', bundleDir);
  process.exit(1);
}

const updaterJson = {
  version: `v${version}`,
  notes: `Release v${version}`,
  pub_date: new Date().toISOString(),
  platforms: platforms
};

fs.writeFileSync('latest.json', JSON.stringify(updaterJson, null, 2));
console.log('Generated latest.json:');
console.log(JSON.stringify(updaterJson, null, 2));