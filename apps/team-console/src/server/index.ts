import { resolve } from 'node:path'

import { createTeamConsoleApp } from './app'

const port = Number(process.env.PORT ?? 8787)
const staticDirectory = process.env.NODE_ENV === 'production' ? resolve('dist/web') : undefined
const app = createTeamConsoleApp({
  ...(staticDirectory === undefined ? {} : { staticDirectory }),
  onDecision: (entry) => {
    console.info(
      JSON.stringify({
        event: 'policy.decision',
        ...entry,
      }),
    )
  },
})

app.listen(port, '127.0.0.1', () => {
  console.info(`Team Console API listening on http://127.0.0.1:${port}`)
})
