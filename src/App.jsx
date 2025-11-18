import React, { useState, useRef, useEffect, useMemo } from 'react'
// MUDANÇA 1: Importar Groq
import Groq from 'groq-sdk'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPalette,
  faFlask,
  faFutbol,
  faGlobe,
  faTicket,
  faLandmark
} from '@fortawesome/free-solid-svg-icons'

// --- Configuração das Categorias ---
var lastQuestions = []
const categories = [
  {
    id: 'art',
    name: 'Arte',
    color: 'bg-red-500',
    icon: faPalette
  },
  {
    id: 'science',
    name: 'Ciência',
    color: 'bg-green-500',
    icon: faFlask
  },
  {
    id: 'sports',
    name: 'Esporte',
    color: 'bg-blue-500',
    icon: faFutbol
  },
  {
    id: 'geography',
    name: 'Geografia',
    color: 'bg-yellow-500',
    icon: faGlobe
  },
  {
    id: 'entertainment',
    name: 'Entretenimento',
    color: 'bg-pink-500',
    icon: faTicket
  },
  {
    id: 'history',
    name: 'História',
    color: 'bg-purple-500',
    icon: faLandmark
  }
]

export default function App () {
  // --- Estados do Jogo ---
  const [scores, setScores] = useState({
    art: 0,
    science: 0,
    sports: 0,
    geography: 0,
    entertainment: 0,
    history: 0
  })
  const [spinningIndex, setSpinningIndex] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [result, setResult] = useState(null)
  const [gameState, setGameState] = useState('idle')
  const [error, setError] = useState(null)

  const spinIntervalRef = useRef(null)

  // --- Configuração da API Key ---
  // MUDANÇA 2: Usar a variável de ambiente correta para Groq
  const rawApiKey = process.env.REACT_APP_GROQ_API_KEY
  const [apiKey, setApiKey] = useState(undefined)

  useEffect(() => {
    if (!rawApiKey || rawApiKey === 'undefined') {
      setError(
        'A chave da API Groq não está configurada. Verifique o ficheiro .env.local.'
      )
      setApiKey(null)
    } else {
      setError(null)
      setApiKey(rawApiKey)
    }
  }, [rawApiKey])

  // MUDANÇA 3: Instanciar o cliente Groq
  const groqClient = useMemo(() => {
    if (apiKey) {
      return new Groq({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Necessário para React client-side
      })
    }
    return null
  }, [apiKey])

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current)
      }
    }
  }, [])

  const spinWheel = () => {
    if (!groqClient) {
      setError('A chave da API não está configurada.')
      return
    }

    setGameState('spinning')
    setCurrentQuestion(null)
    setResult(null)
    setError(null)
    setSelectedCategory(null)

    const spinDuration = 3000 // Reduzi um pouco para ser mais rápido
    const spinInterval = 100
    let currentSpinIndex = 0

    spinIntervalRef.current = setInterval(() => {
      setSpinningIndex(currentSpinIndex % categories.length)
      currentSpinIndex++
    }, spinInterval)

    setTimeout(() => {
      clearInterval(spinIntervalRef.current)

      const finalCategoryIndex = Math.floor(Math.random() * categories.length)
      const finalCategory = categories[finalCategoryIndex]

      setSelectedCategory(finalCategory)
      setSpinningIndex(finalCategoryIndex)

      fetchQuestion(finalCategory.name)
    }, spinDuration)
  }

  // --- Lógica da API Groq (MUDANÇA TOTAL AQUI) ---
  const fetchQuestion = async categoryName => {
    if (!groqClient) {
      setError('Cliente Groq não inicializado.')
      setGameState('idle')
      return
    }

    // Instrução do sistema
    const systemPrompt = `
      **Seu Papel:** Você é um assistente de IA para um jogo de trivia chamado 'Questionados'.
      **Formato de Saída:** Você DEVE responder APENAS com um JSON válido. Não escreva nada antes ou depois do JSON.
      **Estrutura do JSON:**
      {
        "pergunta": "Texto da pergunta",
        "alternativas": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
        "respostaCorreta": "Texto exato de uma das opções"
      }
      **Regras:**
      1. A pergunta deve ser sobre: ${categoryName}.
      2. Nível Fácil/Médio para famílias.
      3. 4 alternativas curtas.
      4. "respostaCorreta" deve ser idêntica a uma das alternativas.
      5. Evite repetir estas perguntas: ${lastQuestions.slice(-10).join(', ')}.
      6. Idioma: Português do Brasil.
    `.trim()

    const MAX_RETRIES = 3

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const completion = await groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Gera uma pergunta sobre ${categoryName}.` }
          ],
          // MUDANÇA AQUI: Use o modelo mais recente suportado (Llama 3.3)
          model: 'llama-3.3-70b-versatile', 
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })

        const jsonText = completion.choices[0]?.message?.content

        if (!jsonText) throw new Error('Resposta vazia da API.')

        const parsedQuestion = JSON.parse(jsonText)

        // Validação básica
        if (
          !parsedQuestion.pergunta ||
          !parsedQuestion.alternativas ||
          !parsedQuestion.respostaCorreta
        ) {
          throw new Error('JSON inválido ou incompleto.')
        }

        // Atualiza histórico
        lastQuestions.push(parsedQuestion.pergunta)
        if (lastQuestions.length > 20) lastQuestions.shift()

        setCurrentQuestion(parsedQuestion)
        setGameState('question')
        return // Sucesso
      } catch (err) {
        console.warn(`Tentativa ${i + 1} falhou:`, err)

        if (i === MAX_RETRIES - 1) {
          setError('Não foi possível gerar a pergunta. Tente novamente.')
          setGameState('idle')
        } else {
          // Pequena pausa antes de tentar de novo
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
  }

  const handleAnswer = answer => {
    if (gameState !== 'question') return

    const isCorrect = answer === currentQuestion.respostaCorreta
    if (isCorrect) {
      setResult('correct')
      setScores(prevScores => ({
        ...prevScores,
        [selectedCategory.id]: prevScores[selectedCategory.id] + 1
      }))
    } else {
      setResult('incorrect')
    }
    setGameState('result')
  }

  // --- Renderização (Mantida igual, apenas ajustando chamadas) ---
  const renderScoreboard = () => (
    <div className='grid grid-cols-3 sm:grid-cols-6 gap-2 p-2 rounded-lg bg-gray-900/50 shadow-inner'>
      {categories.map((category, index) => {
        const isSelected =
          selectedCategory &&
          selectedCategory.id === category.id &&
          (gameState === 'question' || gameState === 'result')
        const isSpinning = gameState === 'spinning' && spinningIndex === index

        let highlightClass = 'scale-100 opacity-70'
        if (isSelected) {
          highlightClass = 'scale-110 opacity-100 shadow-lg shadow-white/30'
        } else if (isSpinning) {
          highlightClass = 'scale-110 opacity-100 shadow-lg shadow-blue-400/50'
        }

        return (
          <div
            key={category.id}
            className={`flex flex-col items-center p-2 rounded-lg ${category.color} ${highlightClass} transition-all duration-150 transform-gpu`}
          >
            <FontAwesomeIcon
              icon={category.icon}
              className='w-6 h-6 sm:w-8 sm:h-8 text-white'
            />
            <span className='text-white font-semibold text-xs sm:text-sm mt-1'>
              {category.name}
            </span>
            <span className='text-white font-bold text-lg sm:text-2xl'>
              {scores[category.id]}
            </span>
          </div>
        )
      })}
    </div>
  )

  const renderCentralArea = () => {
    if (error) {
      return (
        <div className='w-full max-w-lg p-6 bg-red-800/80 rounded-lg shadow-lg text-center h-auto flex flex-col justify-center'>
          <h3 className='text-xl font-bold text-white mb-2'>Erro</h3>
          <p className='text-red-100'>{error}</p>
          <button
            onClick={() => {
              setError(null)
              setGameState('idle')
            }}
            className='w-full p-3 mt-4 bg-white text-gray-800 rounded-lg font-bold
                     text-lg hover:scale-105 active:scale-100 transition-transform shadow-md'
          >
            Tentar Novamente
          </button>
        </div>
      )
    }

    if (gameState === 'question' && currentQuestion) {
      return (
        <div className='w-full max-w-lg p-6 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg'>
          <h3 className='text-xl font-bold text-white mb-4 text-center'>
            {currentQuestion.pergunta}
          </h3>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {currentQuestion.alternativas.map((alt, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(alt)}
                className='p-4 bg-blue-600 text-white rounded-lg font-semibold
                           hover:bg-blue-500 active:scale-95 transition-all shadow-md'
              >
                {alt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (gameState === 'result') {
      const isCorrect = result === 'correct'
      return (
        <div
          className={`w-full max-w-lg p-6 ${
            isCorrect ? 'bg-green-600/90' : 'bg-red-700/90'
          } backdrop-blur-sm rounded-lg shadow-lg text-center`}
        >
          <h3 className='text-3xl font-extrabold text-white mb-3'>
            {isCorrect ? 'Correto!' : 'Incorreto!'}
          </h3>
          {!isCorrect && currentQuestion && (
            <p className='text-white text-lg mb-4'>
              A resposta era:{' '}
              <strong className='font-bold'>
                {currentQuestion.respostaCorreta}
              </strong>
            </p>
          )}
          <button
            onClick={spinWheel}
            className='w-full p-3 bg-white text-gray-800 rounded-lg font-bold
                       text-lg hover:scale-105 active:scale-100 transition-transform shadow-md'
          >
            Questionar Novamente!
          </button>
        </div>
      )
    }

    if (gameState === 'spinning') {
      return (
        <div className='w-full max-w-lg p-6 text-center h-48 flex flex-col items-center justify-center'>
          <svg
            className='animate-spin h-10 w-10 text-white'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
          >
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
            ></circle>
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            ></path>
          </svg>
          <h3 className='text-2xl font-bold text-white animate-pulse mt-4'>
            Gerando questão com IA...
          </h3>
        </div>
      )
    }

    if (gameState === 'idle') {
      return (
        <div className='w-full max-w-lg p-6 text-center h-48 flex items-center justify-center'>
          <button
            onClick={spinWheel}
            disabled={!groqClient}
            className='w-56 h-56 bg-white text-gray-800 rounded-full
                       text-3xl font-bold shadow-xl
                       hover:scale-105 active:scale-95 transition-transform
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
          >
            QUESTIONAR!
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div
      className='flex flex-col items-center justify-between min-h-screen w-full
                   bg-gradient-to-b from-gray-800 to-gray-900 text-white p-4 font-sans'
    >
      <header className='w-full max-w-2xl mb-4'>
        <h1
          className='text-4xl font-extrabold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-500'
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
        >
          Questionados
        </h1>
        {renderScoreboard()}
      </header>

      <main className='flex flex-col items-center justify-center flex-grow w-full my-8'>
        {renderCentralArea()}
      </main>

      <footer className='w-full text-center p-4 text-gray-500 text-sm'>
        Criado para fins educacionais. Powered by Groq.
      </footer>
    </div>
  )
}
// --- FIM DO CÓDIGO ---
