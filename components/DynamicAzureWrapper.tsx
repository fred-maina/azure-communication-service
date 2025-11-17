"use client"

import dynamic from "next/dynamic"
import React from 'react'

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