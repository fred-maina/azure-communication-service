import * as dotenv from 'dotenv'
import { ChatClient } from '@azure/communication-chat'
import {
  AzureCommunicationTokenCredential,
  createIdentifierFromRawId
} from '@azure/communication-common'

dotenv.config()

export type AzureChatConfig = {
  endpointUrl: string
  userId: string
  token: string
  displayName: string
  threadId: string
}

const DEFAULT_TOPIC = 'MVP'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`)
  }
  return value
}

/**
 * Fetches chat configuration on the server so we can
 * keep credentials off the client and leverage SSR.
 */
export async function getAzureChatConfig(): Promise<AzureChatConfig> {
  const endpointUrl = requiredEnv('NEXT_PUBLIC_ACS_ENDPOINT_URL')
  const userId = requiredEnv('NEXT_PUBLIC_ACS_USER_ID')
  const token = requiredEnv('NEXT_PUBLIC_ACS_TOKEN')
  const displayName = process.env.AZURE_COMMUNICATION_DISPLAY_NAME ?? 'Coach MESH'

  const threadId =
    process.env.AZURE_COMMUNICATION_THREAD_ID ??
    (await createThread(endpointUrl, token, userId, displayName))

  return { endpointUrl, userId, token, displayName, threadId }
}

async function createThread(
  endpointUrl: string,
  token: string,
  userId: string,
  displayName: string
): Promise<string> {
  const participantId = createIdentifierFromRawId(userId)
  const chatClient = new ChatClient(endpointUrl, new AzureCommunicationTokenCredential(token))

  const { chatThread } = await chatClient.createChatThread(
    { topic: process.env.AZURE_COMMUNICATION_TOPIC ?? DEFAULT_TOPIC },
    {
      participants: [
        {
          id: participantId,
          displayName
        }
      ]
    }
  )

  return chatThread?.id ?? ''
}
