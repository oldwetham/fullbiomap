// Image conversion for pipeline/10-figures.py: sharp (pinned devDependency) turns each source image into a webp
// for the full-size viewer (at most `max` px on the long side, never enlarged) and a thumbnail (`thumbMax` px).
// Usage: node pipeline/_images.mjs <jobs.json>   (prints one result per job as JSON on stdout)
// A job: {id, src, out?, thumb, max?, thumbMax, crop?: {left, top, width, height}, cropFrom?: {width, height}, density?, flatten?: '#ffffff'}.
// Without `out` only the thumbnail is written (tissue-unit illustrations open as their own SVG).
// Outputs are rewritten only when their bytes change, so reruns leave unchanged files alone.
import fs from 'node:fs';
import sharp from 'sharp';

sharp.cache(false);
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const write = (file, buf) => { if (!fs.existsSync(file) || !fs.readFileSync(file).equals(buf)) fs.writeFileSync(file, buf); };
const results = [];
for (const job of jobs) {
  // A crop given in another pixel space (cropFrom: the OCR's page size) is scaled to the image's own size.
  if (job.crop && job.cropFrom) job.scale = (await sharp(job.src).metadata()).width / job.cropFrom.width;
  // SVGs are rasterized at a density that gives the thumbnail (or full image) enough pixels; large drawings are capped.
  const input = () => {
    let img = sharp(job.src, {density: job.density ?? 72, limitInputPixels: 2 ** 31, failOn: 'error'}).rotate();
    if (job.crop) img = img.extract(job.scale ? Object.fromEntries(Object.entries(job.crop).map(([k, v]) => [k, Math.round(v * job.scale)])) : job.crop);
    if (job.flatten) img = img.flatten({background: job.flatten});
    return img;
  };
  const meta = await input().toBuffer({resolveWithObject: true}).then(r => r.info);
  const result = {id: job.id, sourceWidth: meta.width, sourceHeight: meta.height};
  if (job.out) {
    const {data, info} = await input().resize({width: job.max, height: job.max, fit: 'inside', withoutEnlargement: true}).webp({quality: 82, effort: 5}).toBuffer({resolveWithObject: true});
    write(job.out, data);
    Object.assign(result, {width: info.width, height: info.height, bytes: data.length});
  }
  const {data, info} = await input().resize({width: job.thumbMax, height: job.thumbMax, fit: 'inside', withoutEnlargement: true}).webp({quality: 74, effort: 5}).toBuffer({resolveWithObject: true});
  write(job.thumb, data);
  Object.assign(result, {thumbWidth: info.width, thumbHeight: info.height, thumbBytes: data.length});
  results.push(result);
}
process.stdout.write(JSON.stringify(results) + '\n');
