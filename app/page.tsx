import ChatBot from '@/components/ChatBot'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-neutral-50 to-stone-100 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
      <ChatBot />
    </div>
  )
}