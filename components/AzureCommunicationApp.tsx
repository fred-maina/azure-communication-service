"use client"

import { ChatClient } from '@azure/communication-chat'
import { AzureCommunicationTokenCredential } from '@azure/communication-common'

import type { CommunicationUserIdentifier } from '@azure/communication-common'
import {
  ChatComposite,
  fromFlatCommunicationIdentifier,
  useAzureCommunicationCallAdapter,
  useAzureCommunicationChatAdapter
} from '@azure/communication-react'
import { initializeIcons } from '@fluentui/react'
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'


const ENDPOINT_URL = "https://rohicommunicationservice.africa.communication.azure.com/"
const USER_ID = "8:acs:a46d38be-853b-45c8-a689-46e0cf9713e4_0000002b-314d-08dd-d214-4c3a0d00f601"
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjAxOUQzMTYyMzQ0RTQ4REEwNUU1OUQxMzYwNkYwQkFDRjU4QTQwRUMiLCJ4NXQiOiJBWjB4WWpST1NOb0Y1WjBUWUc4THJQV0tRT3ciLCJ0eXAiOiJKV1QifQ.eyJza3lwZWlkIjoiYWNzOmE0NmQzOGJlLTg1M2ItNDVjOC1hNjg5LTQ2ZTBjZjk3MTNlNF8wMDAwMDAyYi0zMTRkLTA4ZGQtZDIxNC00YzNhMGQwMGY2MDEiLCJzY3AiOjE3OTIsImNzaSI6IjE3NjMzNzYzMjUiLCJleHAiOjE3NjM0NjI3MjUsInJnbiI6InphIiwiYWNzU2NvcGUiOiJjaGF0LHZvaXAiLCJyZXNvdXJjZUlkIjoiYTQ2ZDM4YmUtODUzYi00NWM4LWE2ODktNDZlMGNmOTcxM2U0IiwicmVzb3VyY2VMb2NhdGlvbiI6ImFmcmljYSIsImlhdCI6MTc2MzM3NjMyNX0.HrOkS_o48aB6aL0KcjxzqRUyXrz-NF4Fd9SQjqsoPYi2BLYw9Y0jk1Fi1ZLrKxXUCSFwbmvP7KXAe8gOw-aQIaCo1qj_Y-I6W23YJJRE9MVt80vzPr-b-jq5brFzWuvTw03GCbVBhQvYezwnGNhutboxkvEKc9aJ8zpEccfIF_vmgm5Ju9mJqRIuOmQ6jovsiVORFHtckpy9ESA74yRTcHlJ1p0PgPbOYwEGPpEmBR6P71XbFdDqaeewY_nj6B13hJEOfsM6LwCgYZA6QZGKAlCqL2aTpqCw7cMMTdV6cNWo9xw4cijRxGk8y-t0UBOS7wDgKhiDFPGQkIuFhPMuGg'
const DISPLAY_NAME = 'Rohi Anon'
const richTextEditorEnabled = false

initializeIcons()


export default function AzureCommunicationApp(): JSX.Element {

  const { endpointUrl, userId, token, displayName, groupId, threadId } = useAzureCommunicationServiceArgs()

  const credential = useMemo(() => {
    try {
      return new AzureCommunicationTokenCredential(token)
    } catch {
      console.error('Failed to construct token credential')
      return undefined
    }
  }, [token])

  const callAdapterArgs = useMemo(
    () => ({
      userId: fromFlatCommunicationIdentifier(userId) as CommunicationUserIdentifier,
      displayName,
      credential,
      locator: {
        groupId
      }
    }),
    [userId, credential, displayName, groupId]
  )
  const callAdapter = useAzureCommunicationCallAdapter(callAdapterArgs)

  const chatAdapterArgs = useMemo(
    () => ({
      endpoint: endpointUrl,
      userId: fromFlatCommunicationIdentifier(userId) as CommunicationUserIdentifier,
      displayName,
      credential,
      threadId
    }),
    [endpointUrl, userId, displayName, credential, threadId]
  )
  const chatAdapter = useAzureCommunicationChatAdapter(chatAdapterArgs)

  if (!!callAdapter && !!chatAdapter) {
    return (
      <div style={{ height: '100vh', display: 'flex' }}>
        <div style={containerStyle}>
          <ChatComposite adapter={chatAdapter} options={{ richTextEditor: richTextEditorEnabled }} />
        </div>
      </div>
    )
  }
  if (credential === undefined) {
    return <h3>Failed to construct credential. Provided token is malformed.</h3>
  }
  return <h3>Initializing...</h3>
}

const containerStyle: CSSProperties = {
  border: 'solid 0.125rem olive',
  margin: '0.5rem',
  width: '100vw'
}

function useAzureCommunicationServiceArgs(): {
  endpointUrl: string
  userId: string
  token: string
  displayName: string
  groupId: string
  threadId: string
} {
  const [threadId, setThreadId] = useState('')
  useEffect(() => {
    (async () => {
      const client = new ChatClient(ENDPOINT_URL, new AzureCommunicationTokenCredential(TOKEN))
      const { chatThread } = await client.createChatThread(
        {
          topic: 'Composites Quickstarts'
        },
        {
          participants: [
            {
              id: fromFlatCommunicationIdentifier(USER_ID),
              displayName: DISPLAY_NAME
            }
          ]
        }
      )
      setThreadId(chatThread?.id ?? '')
    })()
  }, [])

  const groupId = useRef(uuidv4())

  return {
    endpointUrl: ENDPOINT_URL,
    userId: USER_ID,
    token: TOKEN,
    displayName: DISPLAY_NAME,
    groupId: groupId.current,
    threadId
  }
}