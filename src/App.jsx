import React, { useState, useRef, useEffect, useMemo } from 'react'
// Importa a biblioteca
import { GoogleGenerativeAI } from '@google/generative-ai'

// --- Configuração das Categorias ---
var lastQuestions = []
const categories = [
  {
    id: 'art',
    name: 'Arte',
    color: 'bg-red-500',
    icon: props => (
      <svg
        {...props}
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
      >
        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM12 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-5 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z' />
      </svg>
    )
  },
  {
    id: 'science',
    name: 'Ciência',
    color: 'bg-green-500',
    icon: props => (
      <svg
        {...props}
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
      >
        <path d='M11 2v5.33l-4 4L3 8V5c0-1.1.9-2 2-2h6zm10 3v3l-4 3 4 4v3h-6c-1.1 0-2-.9-2-2v-3.33l-4-4 4-4V5c0-1.1.9-2 2-2h6zM5 10v9h6c1.1 0 2-.9 2-2v-3.33l-4-4L5 10z' />
      </svg>
    )
  },
  {
    id: 'sports',
    name: 'Esporte',
    color: 'bg-blue-500',
    icon: props => (
      <svg
        {...props}
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
      >
        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2V7zm0 4h2v6h-2v-6z' />
      </svg>
    )
  },
  {
    id: 'geography',
    name: 'Geografia',
    color: 'bg-yellow-500',
    icon: props => (
      <svg
        {...props}
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
      >
        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z' />
      </svg>
    )
  },
  {
    id: 'entertainment',
    name: 'Entretenimento',
    color: 'bg-pink-500',
    icon: props => (
      <svg
        {...props}
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
      >
        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v2h-4v-2zm-4 4h12v2H6v-2zm4-8h4v2h-4V7z' />
      </svg>
    )
  },
  {
    id: 'history',
    name: 'História',
    color: 'bg-purple-500',
    icon: props => (
      <svg
        {...props}
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='currentColor'
      >
        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v5h-2V7zm0 6h2v2h-2v-2z' />
      </svg>
    )
  }
]

// --- Schema de Resposta da API Gemini ---
const geminiSchema = {
  type: 'OBJECT',
  properties: {
    pergunta: { type: 'STRING' },
    alternativas: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    respostaCorreta: { type: 'STRING' }
  },
  required: ['pergunta', 'alternativas', 'respostaCorreta']
}

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
  const rawApiKey = process.env.REACT_APP_GEMINI_API_KEY
  const [apiKey, setApiKey] = useState(undefined)

  useEffect(() => {
    if (!rawApiKey || rawApiKey === 'undefined') {
      setError(
        'A chave da API Gemini não está configurada. Verifique o arquivo .env.local.'
      )
      setApiKey(null)
    } else {
      setError(null)
      setApiKey(rawApiKey)
    }
  }, [rawApiKey])

  // Instanciar o cliente GenAI
  const genAI = useMemo(() => {
    if (apiKey) {
      return new GoogleGenerativeAI(apiKey)
    }
    return null
  }, [apiKey])

  // Limpa o intervalo se o componente for desmontado
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current)
      }
    }
  }, [])

  // --- Lógica Principal: "Girar" as Categorias ---
  const spinWheel = () => {
    if (!genAI) {
      setError(
        'A chave da API Gemini não está configurada. Verifique o arquivo .env.local.'
      )
      return
    }

    setGameState('spinning')
    setCurrentQuestion(null)
    setResult(null)
    setError(null)
    setSelectedCategory(null)

    const spinDuration = 4000
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

  // --- Lógica da API Gemini (ATUALIZADA) ---
  // --- Lógica da API Gemini (ATUALIZADA com Retry) ---
  const fetchQuestion = async categoryName => {
    if (!genAI) {
      setError('Cliente GenAI não inicializado. Verifique a API Key.')
      setGameState('idle')
      return
    }

    // Instrução do sistema (Atualizada)
    const systemInstruction = {
      role: 'system',
      parts: [
        {
          text: `
        **Seu Papel:** Você é um assistente de IA altamente qualificado, especializado em criar perguntas de trivia para um jogo de família chamado 'Questionados'.

        **Seu Objetivo:** Gerar UMA (1) pergunta de múltipla escolha em português do Brasil.

        **Tema da Pergunta:** A pergunta deve ser estritamente sobre o tema: ${categoryName}.

        **Público-Alvo:** Famílias (crianças e adultos).
        * O vocabulário deve ser simples, claro e acessível para todas as idades.
        * O tom deve ser amigável, divertido e estimulante.

        **Qualidade da Pergunta:**
        * A pergunta deve ser interessante e estimular a curiosidade e o aprendizado sobre o tema.
        * Nível de dificuldade: Fácil a Médio. Evite perguntas excessivamente obscuras, técnicas ou que exijam conhecimento muito específico.
        * Evite perguntas que possam ser respondidas com "Sim" ou "Não".

        **Requisitos das Alternativas:**
        * Forneça exatamente 4 alternativas de resposta.
        * As alternativas devem ser CURTAS e diretas, de preferência com uma ou duas palavras (ex: "Paris", "Verde", "1990", "Cachorro").
        * Apenas uma alternativa pode ser a correta.

        **Requisito da Resposta Correta:**
        * O valor do campo "respostaCorreta" deve ser o TEXTO EXATO de uma das 4 opções listadas em "alternativas". Esta é uma regra CRÍTICA para o funcionamento do jogo.

        **Restrição de Repetição:**
        * Gere uma pergunta nova e única. EVITE gerar perguntas idênticas ou muito similares às seguintes: ${lastQuestions.join(
          ', '
        )}.

        **Formato de Saída OBRIGATÓRIO:**
        * Responda APENAS com o objeto JSON.
        * Não inclua NENHUM texto, explicação, introdução ou marcadores de formatação (como \`\`\`json) antes ou depois do objeto JSON.
        * O JSON deve seguir este schema: { "pergunta": "...", "alternativas": ["...", "...", "...", "..."], "respostaCorreta": "..." }
      `.trim()
        }
      ]
    }

    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: geminiSchema
    }
    const userQuery = `
      Gere uma pergunta sobre ${categoryName}.
      As 4 alternativas devem ser curtas (uma ou duas palavras se possível).
      A "respostaCorreta" deve ser o texto exato de uma das alternativas.
    `.trim()
    // --- Fim Configurações ---

    // *** INÍCIO DA LÓGICA DE RETRY ***
    const MAX_RETRIES = 3
    let delay = 1000 // Começa com 1 segundo de espera

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: systemInstruction
        })

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: userQuery }] }],
          generationConfig: generationConfig
        })

        const response = result.response
        const jsonText = response.text()

        if (!jsonText) {
          throw new Error('Resposta da API em formato inesperado.')
        }

        const parsedQuestion = JSON.parse(jsonText)
        setCurrentQuestion(parsedQuestion)
        setGameState('question')

        // SUCESSO! Sai da função.
        return
      } catch (err) {
        console.warn(
          `Tentativa ${i + 1} de ${MAX_RETRIES} falhou:`,
          err.message
        )

        // Verifica se é um erro '503' (sobrecarregado) e se ainda não atingiu o limite de tentativas
        const isOverloaded = err.message && err.message.includes('503')

        if (isOverloaded && i < MAX_RETRIES - 1) {
          // É um erro 503, vamos esperar e tentar de novo
          const jitter = Math.random() * 500 // Adiciona um "jitter" para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, delay + jitter))
          delay *= 2 // Dobra o tempo de espera (exponential backoff)
        } else {
          // É um erro diferente ou atingimos o limite de tentativas
          console.error('Erro final ao buscar pergunta:', err)
          setError(
            `Falha ao buscar pergunta. Tente novamente. (${err.message})`
          )
          setGameState('idle')

          // FALHA! Sai da função.
          return
        }
      }
    }
    // *** FIM DA LÓGICA DE RETRY ***
  }

  // --- Lógica de Resposta ---
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

  // --- Lógica para Jogar Novamente ---
  const playAgain = () => {
    setGameState('idle')
    setCurrentQuestion(null)
    setResult(null)
    setSelectedCategory(null)
    setSpinningIndex(null)
    setError(null) // Limpa o erro ao tentar novamente
  }

  // --- Componentes de Renderização ---

  // Renderiza o Placar (Scoreboard)
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
            <category.icon className='w-6 h-6 sm:w-8 sm:h-8 text-white' />
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

  // Renderiza a Tela de Pergunta/Resultado/Girar
  const renderCentralArea = () => {
    if (error) {
      return (
        <div className='w-full max-w-lg p-6 bg-red-800/80 rounded-lg shadow-lg text-center h-auto flex flex-col justify-center'>
          <h3 className='text-xl font-bold text-white mb-2'>Erro</h3>
          <p className='text-red-100'>{error}</p>
          {!apiKey ? (
            <p className='text-red-100 mt-2'>
              Verifique o .env.local e atualize a página.
            </p>
          ) : (
            <button
              onClick={playAgain} // Volta para a tela inicial para tentar girar de novo
              className='w-full p-3 mt-4 bg-white text-gray-800 rounded-lg font-bold
                       text-lg hover:scale-105 active:scale-100 transition-transform shadow-md'
            >
              Tentar Novamente
            </button>
          )}
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
            onClick={spinWheel} // Mudei de playAgain para spinWheel
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
            Sorteando Categoria...
          </h3>
        </div>
      )
    }

    if (gameState === 'idle') {
      return (
        <div className='w-full max-w-lg p-6 text-center h-48 flex items-center justify-center'>
          <button
            onClick={spinWheel}
            disabled={!genAI} // Desabilita se o cliente genAI não estiver pronto
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

  // --- Renderização Principal do App ---
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
        Criado para fins educacionais.
      </footer>
    </div>
  )
}
