import { task, desc, option, fs, setGlobalOptions } from 'foy'
setGlobalOptions({ loading: false, strict: true })
task('watch', async (ctx) => {
  // Your build tasks
  await Promise.all([
    ctx.exec('pnpm run watch:ext'),
    ctx.cd('./media-src').exec('pnpm start'),
  ])
})

task('build', async (ctx) => {
  await Promise.all([
    ctx.exec('pnpm run build:ext'),
    ctx.cd('./media-src').exec('pnpm build'),
  ])
  await ctx.exec('git add -A')
})
