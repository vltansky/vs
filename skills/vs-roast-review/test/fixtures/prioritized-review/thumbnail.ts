import { execSync } from 'node:child_process';

export function generateThumbnail(sourcePath: string, outputPath: string, size: string) {
  return execSync(`convert ${sourcePath} -resize ${size} ${outputPath}`, {
    stdio: 'pipe',
  });
}
