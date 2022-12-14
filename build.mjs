import archiver from 'archiver'
import esbuild from 'esbuild'
import fs, { promises as fsPromises } from 'fs'

const outdir = 'build'

async function deleteOldDir() {
  await fsPromises.rm(outdir, { recursive: true, force: true })
}

async function runEsbuild() {
  let nodeEnv = process.env.NODE_ENV || 'production' // eslint-disable-line
  await esbuild.build({
    entryPoints: [
      'src/content-script/wechat.mjs',
      'src/content-script/chatgpt.mjs',
      'src/background/index.mjs',
    ],
    bundle: true,
    outdir: outdir,
    treeShaking: true,
    minify: nodeEnv === 'production',
    define: {
      'process.env.NODE_ENV': `"${nodeEnv}"`,
    },
  })
}

async function zipFolder(dir) {
  const output = fs.createWriteStream(`${dir}.zip`)
  const archive = archiver('zip', {
    zlib: { level: 9 },
  })
  archive.pipe(output)
  archive.directory(dir, false)
  await archive.finalize()
}

async function copyFiles(entryPoints, targetDir) {
  await fsPromises.mkdir(targetDir)
  await Promise.all(
    entryPoints.map(async (entryPoint) => {
      await fsPromises.copyFile(entryPoint.src, `${targetDir}/${entryPoint.dst}`)
    }),
  )
}

async function build() {
  await deleteOldDir()
  await runEsbuild()

  const commonFiles = [
    { src: 'build/content-script/wechat.js', dst: 'content-script-wechat.js' },
    { src: 'build/content-script/chatgpt.js', dst: 'content-script-chatgpt.js' },
    { src: 'build/background/index.js', dst: 'background.js' },
    { src: 'src/logo.png', dst: 'logo.png' },
  ]

  // chromium
  await copyFiles(
    [...commonFiles, { src: 'src/manifest.json', dst: 'manifest.json' }],
    `./${outdir}/chromium`,
  )

  await zipFolder(`./${outdir}/chromium`)

  // firefox
  await copyFiles(
    [...commonFiles, { src: 'src/manifest.v2.json', dst: 'manifest.json' }],
    `./${outdir}/firefox`,
  )

  await zipFolder(`./${outdir}/firefox`)
}

build()
