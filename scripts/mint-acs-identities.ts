import 'dotenv/config'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

import { CommunicationIdentityClient } from '@azure/communication-identity'

import { AI_ASSISTANT_USER, HARD_CODED_USERS } from '../lib/constants/users'

type SeedUser = {
  id: string
  displayName: string
  acsIdentity?: string
}

const OUTPUT_FILE = path.resolve(process.cwd(), 'lib/constants/mintedAcsIdentities.json')

async function main() {
  const connectionString = process.env.NEXT_ACS_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('NEXT_ACS_CONNECTION_STRING is not configured')
  }

  const client = new CommunicationIdentityClient(connectionString)
  const seeds: SeedUser[] = [...HARD_CODED_USERS, AI_ASSISTANT_USER]
  const minted: Record<string, string> = {}

  for (const user of seeds) {
    if (minted[user.id]) continue

    if (user.acsIdentity) {
      minted[user.id] = user.acsIdentity
      console.log(`Skipping ${user.displayName} (${user.id}); already using ${user.acsIdentity}`)
      continue
    }

    const identity = await client.createUser()
    minted[user.id] = identity.communicationUserId
    console.log(`Minted ${user.displayName} (${user.id}) -> ${identity.communicationUserId}`)
  }

  const ordered = Object.fromEntries(Object.entries(minted).sort(([a], [b]) => a.localeCompare(b)))
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
  await writeFile(OUTPUT_FILE, JSON.stringify(ordered, null, 2) + '\n', 'utf8')

  console.log(`\nSaved ${Object.keys(ordered).length} identities to ${OUTPUT_FILE}`)
  console.log('Commit this file to keep ACS user IDs stable across environments.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
