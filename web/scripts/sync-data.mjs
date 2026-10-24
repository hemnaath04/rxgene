import { cpSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(import.meta.dirname, '..')
const srcData = resolve(repoRoot, 'src', 'data')

// Copy data/cpic to src/data/cpic
cpSync(resolve(repoRoot, '..', 'data', 'cpic'), resolve(srcData, 'cpic'), {
  recursive: true,
  force: true
})

// Copy data/inhibitors.json to src/data/inhibitors.json
cpSync(resolve(repoRoot, '..', 'data', 'inhibitors.json'), resolve(srcData, 'inhibitors.json'), {
  force: true
})

// Copy data/alert_levels.json to src/data/alert_levels.json (curated alert levels, R29/R30)
cpSync(resolve(repoRoot, '..', 'data', 'alert_levels.json'), resolve(srcData, 'alert_levels.json'), {
  force: true
})

console.log(
  'Data synced: data/cpic -> src/data/cpic, data/inhibitors.json -> src/data/inhibitors.json, data/alert_levels.json -> src/data/alert_levels.json'
)
