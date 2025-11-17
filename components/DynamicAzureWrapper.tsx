"use client"

import dynamic from "next/dynamic"

const AzureCommunicationApp = dynamic(
  () => import("./AzureCommunicationApp"),
  { 
    ssr: false,
    loading: () => <div style={{textAlign: 'center', marginTop: '50px'}}>Loading Azure components...</div>
  }
)

export default function DynamicAzureWrapper() {
  return <AzureCommunicationApp />
}