import DynamicAzureWrapper from '@/components/DynamicAzureWrapper'
import { getAzureChatConfig } from '@/lib/azureCommunication'

export default async function Home() {
  try {
    const chatConfig = await getAzureChatConfig()

    return (
      <div style={{ fontFamily: 'sans-serif' }}>
        <main>
          <DynamicAzureWrapper config={chatConfig} />
        </main>
      </div>
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load chat configuration.'
    return <div style={{ padding: '2rem' }}>Failed to initialize chat: {message}</div>
  }
}
