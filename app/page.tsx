// app/page.tsx

import React from 'react'
import DynamicAzureWrapper from "../components/DynamicAzureWrapper" // ⬅️ NEW IMPORT

/**
 * Entry point for the Next.js application, rendered on the server.
 */
export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      
      <header>
        <h1>Next.js + Azure Chat Integration (SSR Safe)</h1>
      </header>
      
      <main>
        {/* We simply render the Client Component wrapper */}
        <DynamicAzureWrapper />
      </main>
      
      <footer>
        <p style={{fontSize: 'small', color: '#666'}}>Powered by Next.js App Router</p>
      </footer>

    </div>
  )
}