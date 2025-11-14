import React, { useState, useRef, useEffect } from 'react'

// --- Configuração das Categorias ---
// Define as categorias, cores e ícones (SVGs inline para simplicidade)
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
// Define a estrutura JSON que esperamos da API
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
  const [spinningIndex, setSpinningIndex] = useState(null) // Index (0-5) da categoria destacada durante o "giro"
  const [selectedCategory, setSelectedCategory] = useState(null) // Categoria sorteada
  const [currentQuestion, setCurrentQuestion] = useState(null) // {pergunta, alternativas, respostaCorreta}
  const [result, setResult] = useState(null) // 'correct' ou 'incorrect'
  const [gameState, setGameState] = useState('idle') // 'idle', 'spinning', 'question', 'result'
  const [error, setError] = useState(null)

  // Referência para o timer do "giro"
  const spinIntervalRef = useRef(null)

  // Tenta ler a API key do 'process.env' (para Vercel/Render/CRA)
  const rawApiKey = process.env.REACT_APP_GEMINI_API_KEY

  // Usa um estado para armazenar a chave validada
  const [apiKey, setApiKey] = useState(undefined)

  // Efeito para validar a chave da API na inicialização
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
    if (!apiKey) {
      setError(
        'A chave da API Gemini não está configurada. Verifique o arquivo .env.local.'
      )
      return
    }

    setGameState('spinning')
    setCurrentQuestion(null)
    setResult(null)
    setError(null)
    setSelectedCategory(null) // Limpa a seleção final anterior

    const spinDuration = 4000 // Duração total do "giro" (4 segundos)
    const spinInterval = 100 // Velocidade da troca de destaque (100ms)
    let currentSpinIndex = 0

    // Inicia o intervalo para animar o "spinningIndex"
    spinIntervalRef.current = setInterval(() => {
      setSpinningIndex(currentSpinIndex % categories.length)
      currentSpinIndex++
    }, spinInterval)

    // Define um timeout para parar o "giro" após 4 segundos
    setTimeout(() => {
      clearInterval(spinIntervalRef.current) // Para a animação

      // Sorteia a categoria final
      const finalCategoryIndex = Math.floor(Math.random() * categories.length)
      const finalCategory = categories[finalCategoryIndex]

      setSelectedCategory(finalCategory) // Define a categoria final
      setSpinningIndex(finalCategoryIndex) // Mantém o destaque na categoria final

      fetchQuestion(finalCategory.name) // Busca a pergunta
    }, spinDuration)
  }

  // --- Lógica da API Gemini ---
  const fetchQuestion = async categoryName => {
    if (!apiKey) {
      setError('Chave da API não encontrada durante a busca.')
      setGameState('idle')
      return
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`

    const systemPrompt = `
      Você é um assistente de IA gerador de trivia para um jogo chamado 'Questionados'. 
      O público-alvo do jogo é a familia.
      Sua tarefa é criar uma pergunta de múltipla escolha em português do Brasil.
      A pergunta deve ser sobre o tema: ${categoryName}.
      O vocabulário deve ser simples.
      A pergunta deve estimular o aprendizado no tema.
      Responda APENAS com o formato JSON solicitado.
    `

    const userQuery = `
      Gere uma pergunta sobre ${categoryName}.
      As 4 alternativas devem ser curtas (uma ou duas palavras se possível).
      A "respostaCorreta" deve ser o texto exato de uma das alternativas.
    `

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema
      }
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Erro da API: ${response.statusText}`)
      }

      const result = await response.json()

      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text
      if (!jsonText) {
        throw new Error('Resposta da API em formato inesperado.')
      }

      const parsedQuestion = JSON.parse(jsonText)
      setCurrentQuestion(parsedQuestion)
      setGameState('question')
    } catch (err) {
      console.error('Erro ao buscar pergunta:', err)
      setError(`Falha ao buscar pergunta. Tente novamente. (${err.message})`)
      setGameState('idle')
    }
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
    setSpinningIndex(null) // Limpa o destaque do "giro"
  }

  // --- Componentes de Renderização ---

  // Renderiza o Placar (Scoreboard) - AGORA COM ANIMAÇÃO
  const renderScoreboard = () => (
    <div className='grid grid-cols-3 sm:grid-cols-6 gap-2 p-2 rounded-lg bg-gray-900/50 shadow-inner'>
      {categories.map((category, index) => {
        // Destaque final (permanece após o giro)
        const isSelected =
          selectedCategory &&
          selectedCategory.id === category.id &&
          (gameState === 'question' || gameState === 'result')
        // Destaque da animação (pisca durante o giro)
        const isSpinning = gameState === 'spinning' && spinningIndex === index

        let highlightClass = 'scale-100 opacity-70' // Padrão
        if (isSelected) {
          highlightClass = 'scale-110 opacity-100 shadow-lg shadow-white/30' // Destaque final
        } else if (isSpinning) {
          highlightClass = 'scale-110 opacity-100 shadow-lg shadow-blue-400/50' // Destaque do "giro"
        }

        return (
          <div
            key={category.id}
            className={`flex flex-col items-center p-2 rounded-lg ${category.color} ${highlightClass} transition-all duration-150 transform-gpu`}
          >
            <category.icon className='w-6 h-6 sm:w-8 sm:h-8 text-white' />
            {/* Texto da categoria (volta) */}
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
    // Se houver um erro, mostra a mensagem de erro
    if (error) {
      return (
        <div className='w-full max-w-lg p-6 bg-red-800/80 rounded-lg shadow-lg text-center h-48 flex flex-col justify-center'>
          <h3 className='text-xl font-bold text-white mb-2'>
            Erro de Configuração
          </h3>
          <p className='text-red-100'>{error}</p>
        </div>
      )
    }

    // Mostra a tela da Pergunta
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

    // Mostra a tela de Resultado (Certo/Errado)
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

    // Mostra "Girando..."
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

    // Mostra o botão "GIRAR!" (Estado 'idle')
    if (gameState === 'idle') {
      return (
        <div className='w-full max-w-lg p-6 text-center h-48 flex items-center justify-center'>
          <button
            onClick={spinWheel}
            disabled={!!error} // Desabilita se houver erro na API key
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
      {/* Cabeçalho e Placar */}
      <header className='w-full max-w-2xl mb-4'>
        <h1
          className='text-4xl font-extrabold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-500'
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
        >
          Questionados
        </h1>
        {renderScoreboard()}
      </header>

      {/* Corpo Principal (Área de Interação) */}
      <main className='flex flex-col items-center justify-center flex-grow w-full my-8'>
        {renderCentralArea()}
      </main>

      {/* Rodapé */}
      <footer className='w-full text-center p-4 text-gray-500 text-sm'>
        Criado para fins educacionais.
      </footer>
    </div>
  )
}
