'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Send, ArrowLeft } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import treatmentCatalog from '@/data/treatment-catalog.json'
import chatFlow from '@/data/chatbot-flow.json'

type ChatFlowStep = keyof typeof chatFlow.flow

interface Message {
  id: string
  type: 'user' | 'bot'
  content: string
  options?: Option[]
  recommendations?: Treatment[]
  timestamp: Date
}

interface Option {
  text: string
  value: string
  next?: string
}

interface Treatment {
  id: string
  name: string
  description: string
  priceRange: string
  benefits: string[]
  skinConcerns: string[]
  popular?: boolean
  combinations?: string[]
}

interface UserProfile {
  concerns: string[]
  goals: string[]
  skinType?: string
  ageGroup?: string
  experience?: string
  budget?: string
  timeline?: string
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentStep, setCurrentStep] = useState<ChatFlowStep>('introduce')
  const [userProfile, setUserProfile] = useState<UserProfile>({
    concerns: [],
    goals: []
  })
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [showChat, setShowChat] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const addBotMessage = (content: string, options?: Option[], recommendations?: Treatment[]) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content,
      options: options || undefined,
      recommendations: recommendations || undefined,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
    setIsTyping(false)
  }

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
  }

  const handleOptionClick = (option: Option) => {
    addUserMessage(option.text)
    setShowChat(true)
    processUserChoice(option)
  }

  const handleMultiSelect = () => {
    if (selectedOptions.length === 0) return
    
    const selectedTexts = selectedOptions.join(', ')
    addUserMessage(`Valgt: ${selectedTexts}`)
    
    // Update user profile
    if (currentStep === 'skinConcern') {
      setUserProfile(prev => ({ ...prev, concerns: selectedOptions }))
    } else if (currentStep === 'skinGoal') {
      setUserProfile(prev => ({ ...prev, goals: selectedOptions }))
    }
    
    setSelectedOptions([])
    setIsTyping(true)
    setShowChat(true)
    
    setTimeout(() => {
      const currentFlowStep = chatFlow.flow[currentStep]
      if ('next' in currentFlowStep && currentFlowStep.next) {
        processNextStep(currentFlowStep.next)
      }
    }, 1000)
  }

  const toggleOption = (value: string) => {
    setSelectedOptions(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    )
  }

  const processUserChoice = (option: Option) => {
    setIsTyping(true)
    
    // Update user profile based on current step
    updateUserProfile(option.value)
    
    setTimeout(() => {
      if (option.next) {
        processNextStep(option.next)
      }
    }, 1000)
  }

  const processNextStep = (nextStep: string) => {
    const step = chatFlow.flow[nextStep as ChatFlowStep]
    if (!step) {
      generateRecommendations()
      return
    }
    
    setCurrentStep(nextStep as ChatFlowStep)
    
    if ('type' in step && step.type === 'recommendation' || nextStep === 'recommendation') {
      generateRecommendations()
    } else if ('type' in step && step.type === 'multiSelect') {
      // For multi-select, we'll handle it differently
      setShowChat(false)
      setIsTyping(false)
    } else if ('message' in step) {
      addBotMessage(step.message, 'options' in step ? step.options : undefined)
      // If there's a next step defined and no options, continue
      if ('next' in step && step.next && !('options' in step)) {
        setTimeout(() => processNextStep(step.next), 1500)
      }
    }
  }

  const updateUserProfile = (value: string) => {
    const updates: Partial<UserProfile> = {}
    
    if (currentStep === 'skinType') updates.skinType = value
    if (currentStep === 'ageGroup') updates.ageGroup = value
    if (currentStep === 'experience') updates.experience = value
    if (currentStep === 'budget') updates.budget = value
    if (currentStep === 'timeline') updates.timeline = value
    
    setUserProfile(prev => ({ ...prev, ...updates }))
  }

  const generateRecommendations = () => {
    setIsTyping(true)
    
    setTimeout(() => {
      const recommendations = getPersonalizedRecommendations()
      const message = `Basert på dine behov, anbefaler jeg disse behandlingene:`
      addBotMessage(message, undefined, recommendations)
      
      // Add booking CTA after recommendations
      setTimeout(() => {
        addBookingCTA()
      }, 1500)
    }, 2000)
  }

  const getPersonalizedRecommendations = (): Treatment[] => {
    const allTreatments: Treatment[] = []
    
    // Flatten all treatments from catalog
    Object.values(treatmentCatalog.categories).forEach(category => {
      allTreatments.push(...category.treatments)
    })
    
    // Score treatments based on user profile
    const scoredTreatments = allTreatments.map(treatment => {
      let score = 0
      
      // Check concern matches
      userProfile.concerns.forEach(concern => {
        if (treatment.skinConcerns.includes(concern)) score += 3
      })
      
      // Check goal matches
      userProfile.goals.forEach(goal => {
        if (treatment.skinConcerns.includes(goal)) score += 2
      })
      
      // Boost popular treatments
      if (treatment.popular) score += 1
      
      // Consider budget
      if (userProfile.budget === 'low' && treatment.priceRange.includes('1')) score += 1
      if (userProfile.budget === 'unlimited') score += 1
      
      return { ...treatment, score }
    })
    
    // Sort by score and return top 3
    return scoredTreatments
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }

  const addBookingCTA = () => {
    const bookingMessage = `Ønsker du å bestille time for en av disse behandlingene?

Ring oss for en uforpliktende konsultasjon:
📍 Karl Johan: 22 33 60 60
📍 Sandvika: 902 57 677
📍 Majorstuen: 23 21 54 00`
    addBotMessage(bookingMessage)
  }

  const handleSendMessage = () => {
    if (!inputValue.trim()) return
    addUserMessage(inputValue)
    setInputValue('')
    
    // Simple response for free text
    setIsTyping(true)
    setTimeout(() => {
      addBotMessage('Takk for din melding. La meg veilede deg videre med noen spørsmål.')
      processNextStep(currentStep)
    }, 1000)
  }

  // Initial screen
  if (!showChat && messages.length === 0 && currentStep === 'introduce') {
    const introduceStep = chatFlow.flow.introduce
    return (
      <div className="w-full max-w-md min-h-[80vh] flex flex-col font-[family-name:var(--font-geist-sans)]">
        {/* Avatar */}
        <div className="flex justify-center mt-16 mb-10">
          <div className="w-28 h-28 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-5xl">✨</span>
          </div>
        </div>
        
        {/* Question */}
        <div className="text-center px-8 mb-10">
          <h1 className="text-2xl font-normal text-stone-800 mb-3">
            Hva kan vi hjelpe deg med?
          </h1>
          <p className="text-stone-500 font-light text-sm">
            Jeg ønsker å...
          </p>
        </div>
        
        {/* Options */}
        <div className="flex-1 px-6 space-y-3">
          {introduceStep.options?.map((option, idx) => (
            <button
              key={idx}
              onClick={() => {
                setMessages([{
                  id: Date.now().toString(),
                  type: 'user',
                  content: option.text,
                  timestamp: new Date()
                }])
                setShowChat(true)
                processUserChoice(option)
              }}
              className="w-full text-left px-6 py-4 bg-stone-50 border border-stone-200 rounded-full hover:bg-amber-50 hover:border-amber-200 transition-all duration-200 text-stone-700 font-light"
            >
              {option.text}
            </button>
          ))}
        </div>
        
        {/* Continue button */}
        <div className="px-6 py-8">
          <button 
            onClick={() => {
              const firstOption = introduceStep.options?.[0]
              if (firstOption) {
                handleOptionClick(firstOption)
              }
            }}
            className="w-full py-4 bg-blue-500 text-white rounded-full font-medium hover:bg-blue-600 transition-all duration-200 shadow-md"
          >
            Fortsett
          </button>
        </div>
      </div>
    )
  }

  // Multi-select screen
  const currentStepData = chatFlow.flow[currentStep]
  if (!showChat && currentStepData && 'type' in currentStepData && currentStepData.type === 'multiSelect') {
    const step = currentStepData
    return (
      <div className="w-full max-w-md min-h-[80vh] flex flex-col font-[family-name:var(--font-geist-sans)]">
        {/* Header */}
        <div className="px-6 pt-8 pb-6">
          <button 
            onClick={() => {
              setShowChat(true)
            }}
            className="text-stone-400 hover:text-stone-600 transition-colors mb-6 flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            <span className="font-light">Tilbake</span>
          </button>
          
          {/* Avatar */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-3xl">✨</span>
            </div>
          </div>
          
          <h2 className="text-2xl font-normal text-stone-800 mb-3 text-center">
            {'message' in step ? step.message : ''}
          </h2>
          <p className="text-stone-500 font-light text-sm text-center">
            Velg alle som passer
          </p>
        </div>
        
        {/* Options */}
        <div className="flex-1 px-6 py-2 space-y-3 overflow-y-auto">
          {'options' in step && step.options?.map((option, idx) => (
            <button
              key={idx}
              onClick={() => toggleOption(option.value)}
              className={`w-full text-left px-6 py-4 rounded-full transition-all duration-200 font-light flex items-center justify-between ${
                selectedOptions.includes(option.value)
                  ? 'bg-stone-50 border-2 border-blue-500 text-stone-800'
                  : 'bg-stone-50 border border-stone-200 text-stone-700 hover:bg-amber-50 hover:border-amber-200'
              }`}
            >
              <span>{option.text}</span>
              {selectedOptions.includes(option.value) && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
        
        {/* Continue button */}
        <div className="px-6 py-8">
          <button
            onClick={handleMultiSelect}
            disabled={selectedOptions.length === 0}
            className={`w-full py-4 rounded-full font-medium transition-all duration-200 shadow-md ${
              selectedOptions.length > 0
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            Fortsett
          </button>
        </div>
      </div>
    )
  }

  // Regular chat interface
  return (
    <div className="w-full max-w-md h-[80vh] bg-white rounded-3xl shadow-xl flex flex-col font-[family-name:var(--font-geist-sans)]">
      {/* Simple Header */}
      <div className="bg-stone-50 border-b border-stone-200 px-6 py-4 rounded-t-3xl flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center">
          <span className="text-xl">✨</span>
        </div>
        <div>
          <h3 className="font-normal text-stone-800">Eger Assistant</h3>
          <p className="text-xs text-stone-500 font-light">Vi hjelper deg</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, messageIndex) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white rounded-3xl rounded-br-md'
                    : 'bg-stone-50 text-stone-800 rounded-3xl rounded-bl-md'
                } px-5 py-3 shadow-sm`}
              >
                <div className="whitespace-pre-wrap font-light text-sm">{message.content}</div>
                
                {/* Quick reply options */}
                {message.options && messageIndex === messages.length - 1 && chatFlow.flow[currentStep]?.type !== 'multiSelect' && (
                  <div className="mt-4 space-y-2">
                    {message.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleOptionClick(option)}
                        className="block w-full text-left px-5 py-3 bg-white text-stone-700 rounded-full hover:bg-amber-50 transition-all duration-200 text-sm font-light border border-stone-200"
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Treatment recommendations */}
                {message.recommendations && (
                  <div className="mt-4 space-y-3">
                    {message.recommendations.map((treatment) => (
                      <div key={treatment.id} className="bg-white rounded-2xl p-4 border border-amber-100">
                        <h4 className="font-medium text-stone-800 text-sm">{treatment.name}</h4>
                        <p className="text-xs text-stone-600 mt-1 font-light">{treatment.description}</p>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-xs font-light text-stone-600">{treatment.priceRange}</span>
                          {treatment.popular && (
                            <span className="text-xs bg-amber-100 text-stone-700 px-3 py-1 rounded-full font-light">
                              Anbefalt
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-stone-50 rounded-3xl rounded-bl-md px-5 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
                  <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-stone-200 bg-stone-50 rounded-b-3xl">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Skriv din melding..."
            className="flex-1 px-5 py-3 border border-stone-200 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-200 font-light bg-white text-sm"
          />
          <button
            onClick={handleSendMessage}
            className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 transition-all duration-200 shadow-md"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}