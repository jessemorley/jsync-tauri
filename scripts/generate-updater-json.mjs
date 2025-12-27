import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const repo = 'jessemorley/jsync-tauri';

// Recursively find files with a specific extension
function findFiles(dir, ext, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, ext, fileList);
    } else if (file.endsWith(ext)) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

console.log('Searching for bundles in src-tauri/target...');
const allTarGz = findFiles('src-tauri/target', '.app.tar.gz');
console.log('Found .tar.gz files:', allTarGz);

const platforms = {};

allTarGz.forEach(tarPath => {
  const sigPath = `${tarPath}.sig`;
  if (fs.existsSync(sigPath)) {
    const signature = fs.readFileSync(sigPath, 'utf8').trim();
    const fileName = path.basename(tarPath);
    
    let arch = 'aarch64';
    if (fileName.includes('x64') || fileName.includes('x86_64')) arch = 'x86_64';
    if (fileName.includes('arm64') || fileName.includes('aarch64')) arch = 'aarch64';

    platforms[`darwin-${arch}`] = {
      signature: signature,
      url: `https://github.com/${repo}/releases/download/v${version}/${fileName}`
    };
    console.log(`Added platform darwin-${arch} from ${fileName}`);
  } else {
    console.warn(`No signature found for ${tarPath}`);
  }
});

if (Object.keys(platforms).length === 0) {
  console.error('No signed bundles found.');
  process.exit(1);
}

const updaterJson = {
  version: `v${version}`,
  notes: `Release v${version}`,
  pub_date: new Date().toISOString(),
  platforms: platforms
};

fs.writeFileSync('latest.json', JSON.stringify(updaterJson, null, 2));
console.log('Generated latest.json successfully.');
