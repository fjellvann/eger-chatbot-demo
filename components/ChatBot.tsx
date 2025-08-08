'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Send, Bot, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import treatmentCatalog from '@/data/treatment-catalog.json'
import chatFlow from '@/data/chatbot-flow.json'

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
  const [currentStep, setCurrentStep] = useState('welcome')
  const [userProfile, setUserProfile] = useState<UserProfile>({
    concerns: [],
    goals: []
  })
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Start conversation
    const welcomeStep = chatFlow.flow.welcome
    addBotMessage(welcomeStep.message)
    setTimeout(() => {
      const introduceStep = chatFlow.flow.introduce
      addBotMessage(introduceStep.message, introduceStep.options)
      setCurrentStep('introduce')
    }, 1500)
  }, [])

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
    
    setTimeout(() => {
      const nextStepId = chatFlow.flow[currentStep].next
      if (nextStepId) {
        processNextStep(nextStepId)
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
    const step = chatFlow.flow[nextStep]
    if (!step) {
      generateRecommendations()
      return
    }
    
    setCurrentStep(nextStep)
    
    if (step.type === 'recommendation' || nextStep === 'recommendation') {
      generateRecommendations()
    } else if (step.type === 'multiSelect') {
      // For multi-select, show the options
      addBotMessage(step.message, step.options)
    } else if (step.type === 'quickReply') {
      // For quick reply, show the options
      addBotMessage(step.message, step.options)
    } else {
      // Default message type
      addBotMessage(step.message, step.options)
      // If there's a next step defined and no options, continue
      if (step.next && !step.options) {
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
      const message = `Basert på dine behov, anbefaler jeg disse behandlingene:\n\n`
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
    const bookingMessage = `
Ønsker du å bestille time for en av disse behandlingene?

Vi har klinikker på Karl Johan, Sandvika og Majorstuen.

Ring oss gjerne for en uforpliktende konsultasjon:
📍 Karl Johan: 22 33 60 60
📍 Sandvika: 902 57 677
📍 Majorstuen: 23 21 54 00
    `
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-stone-700 text-stone-50 rounded-full p-4 shadow-lg hover:bg-stone-800 transition-all duration-200"
      >
        <Bot size={24} />
      </button>
    )
  }

  return (
    <div className="w-full max-w-md h-[80vh] bg-stone-50 rounded-2xl shadow-2xl flex flex-col font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-700 to-stone-800 text-stone-50 p-5 rounded-t-2xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <div>
            <h3 className="font-medium text-lg">Eger Skin Assistant</h3>
            <p className="text-xs opacity-80 font-light">Vi hjelper deg med å finne rett behandling</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:opacity-70 transition-opacity">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, messageIndex) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] ${
                  message.type === 'user'
                    ? 'bg-stone-600 text-stone-50 rounded-2xl rounded-br-md'
                    : 'bg-white text-stone-800 rounded-2xl rounded-bl-md border border-stone-200'
                } p-4 shadow-sm`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Quick reply options - only show for the latest bot message */}
                {message.options && messageIndex === messages.length - 1 && (
                  <div className="mt-3 space-y-2">
                    {chatFlow.flow[currentStep]?.type === 'multiSelect' ? (
                      <>
                        {message.options.map((option, idx) => (
                          <button
                            key={idx}
                            onClick={() => toggleOption(option.value)}
                            className={`block w-full text-left px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-light ${
                              selectedOptions.includes(option.value)
                                ? 'bg-stone-700 text-stone-50'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
                            }`}
                          >
                            {option.text} {selectedOptions.includes(option.value) && '✓'}
                          </button>
                        ))}
                        {selectedOptions.length > 0 && (
                          <button
                            onClick={handleMultiSelect}
                            className="block w-full px-4 py-2.5 bg-stone-700 text-stone-50 rounded-lg hover:bg-stone-800 transition-all duration-200 text-sm font-medium"
                          >
                            Fortsett med {selectedOptions.length} valg
                          </button>
                        )}
                      </>
                    ) : (
                      message.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleOptionClick(option)}
                          className="block w-full text-left px-4 py-2.5 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-all duration-200 text-sm font-light border border-stone-200"
                        >
                          {option.text}
                        </button>
                      ))
                    )}
                  </div>
                )}
                
                {/* Treatment recommendations */}
                {message.recommendations && (
                  <div className="mt-3 space-y-3">
                    {message.recommendations.map((treatment) => (
                      <div key={treatment.id} className="bg-stone-50 rounded-lg p-4 shadow-sm border border-stone-200">
                        <h4 className="font-medium text-stone-800">{treatment.name}</h4>
                        <p className="text-xs text-stone-600 mt-1 font-light">{treatment.description}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs font-light text-stone-700">{treatment.priceRange}</span>
                          {treatment.popular && (
                            <span className="text-xs bg-stone-200 text-stone-700 px-2 py-1 rounded font-light">
                              Populær
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
              <div className="bg-white rounded-2xl rounded-bl-md p-3 border border-stone-200">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-stone-200 bg-white rounded-b-2xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Skriv din melding..."
            className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 font-light bg-stone-50"
          />
          <button
            onClick={handleSendMessage}
            className="bg-stone-700 text-stone-50 p-2.5 rounded-lg hover:bg-stone-800 transition-all duration-200"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}